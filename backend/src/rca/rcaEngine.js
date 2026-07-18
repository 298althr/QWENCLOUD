// backend/src/rca/rcaEngine.js
// Cloud Infrastructure Root Cause Analyst engine.
//
// Implements the Bayesian likelihood-ratio causal inference methodology
// from the RCA spec:
//   1. Walk the affected node's ancestor chain through the topology DAG
//   2. Collect mutations (container restarts, config changes, deployments) in temporal window
//   3. Score each candidate mutation using Bayesian LR inference
//   4. Apply temporal decay (resource-class-specific half-life)
//   5. Apply hop attenuation (8% per dependency hop)
//   6. Rank candidates by posterior probability
//   7. Use Qwen API (thinking mode) for natural language reasoning over the causal chain
//   8. Return structured causal chain JSON per the output contract

const { v4: uuidv4 } = require("uuid");
const { buildTopology, getImpactAnalysis } = require("../utils/topology");
const { listAllContainers, inspectContainer } = require("../utils/docker");
const { qwen, selectModel } = require("../qwen/client");
const { guardedCreate, guardedStream, getThinkingBudget } = require("../qwen/guardrails");
const memory = require("../memory/store");
const { audit } = require("../utils/audit");
const { lookupLR, temporalDecay, hopAttenuation, computePosterior, CONFIDENCE_THRESHOLD } = require("./cpt");

const RCA_SYSTEM_PROMPT = `You are the RootCauseAnalyst in an RCA investigation team for cloud infrastructure.
Focus on: deployment failures, config drift, container crashes (CrashLoopBackOff),
cert rotations, DNS issues, network policy changes, and dependency chain failures.
You operate over a causal digital twin: a DAG where nodes are infrastructure
resources (containers, gateways, key vaults, clusters) and edges point from
cause to effect (upstream to downstream dependency).

When a degradation signal arrives (error spike, heartbeat loss, memory pressure):
1. Walk the affected node's ancestor chain upstream through the dependency graph
2. Find all mutations (deployments, config changes, cert rotations) within the
   temporal window on those ancestors
3. Score each candidate mutation using Bayesian likelihood-ratio inference
4. Apply temporal decay (recent mutations score higher)
5. Apply hop attenuation (8% per dependency hop)
6. Return a ranked list of competing causes with confidence scores and causal paths

Use the search_evidence tool to retrieve relevant logs, metrics, and traces.
Reply with TERMINATE when complete.`;

// Map anomaly types to signal types for CPT lookup
const ANOMALY_TO_SIGNAL = {
  cpu_spike: "ErrorSpike",
  ram_pressure: "MemoryPressure",
  disk_pressure: "MemoryPressure",
  port_conflict: "ConnectionRefused",
  network_latency: "LatencyShift",
  network_errors: "ConnectionReset",
  container_crash: "CrashLoopBackOff",
  heartbeat_loss: "HeartbeatLoss",
};

/**
 * Collect mutations from container state and recent events.
 * In our Docker-based environment, mutations are:
 *   - Container restarts (state transitions)
 *   - Image updates (different image hash)
 *   - Config changes (env vars, port mappings)
 *   - Recent deployments (git pull + rebuild)
 */
async function collectMutations(topology, affectedNodeIds) {
  const mutations = [];
  const now = Date.now();
  const WINDOW_MS = 60 * 60 * 1000; // 1 hour lookback

  for (const nodeId of affectedNodeIds) {
    const node = topology.nodes.find((n) => n.id === nodeId || n.composeService === nodeId);
    if (!node) continue;

    try {
      const info = await inspectContainer(node.id);
      const state = info.State || {};
      const created = info.Created ? new Date(info.Created).getTime() : 0;
      const startedAt = state.StartedAt ? new Date(state.StartedAt).getTime() : 0;
      const restartCount = info.RestartCount || 0;
      const minutesSinceStart = startedAt ? (now - startedAt) / 60000 : 999;

      // Container restart mutation
      if (restartCount > 0 && minutesSinceStart < 60) {
        mutations.push({
          nodeId: node.id,
          nodeName: node.name,
          service: node.composeService,
          mutationType: "ImageUpdate",
          mutationTimestamp: new Date(startedAt).toISOString(),
          minutesSinceMutation: minutesSinceStart,
          description: `Container ${node.name} restarted ${restartCount}x, last start ${minutesSinceStart.toFixed(1)} min ago`,
          evidence: [
            `restart_count: ${restartCount}`,
            `started_at: ${state.StartedAt}`,
            `exit_code: ${state.ExitCode || "N/A"}`,
            `image: ${node.image}`,
          ],
          resourceClass: "Container",
        });
      }

      // Recent container creation (deployment)
      if (created > 0 && (now - created) < WINDOW_MS) {
        const minutesSinceCreate = (now - created) / 60000;
        mutations.push({
          nodeId: node.id,
          nodeName: node.name,
          service: node.composeService,
          mutationType: "ConfigChange",
          mutationTimestamp: new Date(created).toISOString(),
          minutesSinceMutation: minutesSinceCreate,
          description: `Container ${node.name} was created ${minutesSinceCreate.toFixed(1)} min ago (recent deployment)`,
          evidence: [
            `created_at: ${info.Created}`,
            `image: ${node.image}`,
            `command: ${info.Config?.Cmd ? JSON.stringify(info.Config.Cmd) : "N/A"}`,
          ],
          resourceClass: "Container",
        });
      }

      // OOM kill mutation
      if (state.OOMKilled) {
        mutations.push({
          nodeId: node.id,
          nodeName: node.name,
          service: node.composeService,
          mutationType: "ResourceExhaustion",
          mutationTimestamp: state.StartedAt || new Date().toISOString(),
          minutesSinceMutation: minutesSinceStart,
          description: `Container ${node.name} was OOMKilled — memory limit exceeded`,
          evidence: [
            `oom_killed: true`,
            `exit_code: ${state.ExitCode}`,
            `image: ${node.image}`,
          ],
          resourceClass: "Container",
        });
      }

      // Health check failure
      if (state.Health && state.Health.Status === "unhealthy") {
        const failingStreak = state.Health.FailingStreak || 0;
        mutations.push({
          nodeId: node.id,
          nodeName: node.name,
          service: node.composeService,
          mutationType: "DependencyFailure",
          mutationTimestamp: new Date().toISOString(),
          minutesSinceMutation: 0,
          description: `Container ${node.name} health check failing (${failingStreak} consecutive failures)`,
          evidence: [
            `health_status: unhealthy`,
            `failing_streak: ${failingStreak}`,
            `log: ${(state.Health.Log || []).slice(-1).map((l) => l.Output || "").join("").slice(0, 200)}`,
          ],
          resourceClass: "Service",
        });
      }
    } catch (e) {
      // Inspect may fail for stopped containers
    }
  }

  return mutations;
}

/**
 * Walk the ancestor chain of an affected node in the topology DAG.
 * Returns the list of ancestor node IDs with their hop count.
 */
function walkAncestors(topology, affectedNodeId) {
  const ancestors = new Map(); // nodeId -> hopCount

  // Build adjacency: for each edge with direction, map target -> source (upstream)
  const upstreamMap = new Map();
  for (const edge of topology.edges) {
    if (edge.direction && edge.direction.includes("->")) {
      const [src, tgt] = edge.direction.split("->");
      const srcNode = topology.nodes.find((n) => n.composeService === src);
      const tgtNode = topology.nodes.find((n) => n.composeService === tgt);
      if (srcNode && tgtNode) {
        if (!upstreamMap.has(tgtNode.id)) upstreamMap.set(tgtNode.id, []);
        upstreamMap.get(tgtNode.id).push(srcNode.id);
      }
    }
  }

  // BFS from affected node upstream
  const queue = [{ id: affectedNodeId, hops: 0 }];
  const visited = new Set();

  while (queue.length > 0) {
    const { id, hops } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);

    if (hops > 0) {
      ancestors.set(id, hops);
    }

    const upstream = upstreamMap.get(id) || [];
    for (const upId of upstream) {
      if (!visited.has(upId)) {
        queue.push({ id: upId, hops: hops + 1 });
      }
    }
  }

  return ancestors;
}

/**
 * Score each candidate mutation using Bayesian likelihood-ratio inference.
 */
function scoreMutations(mutations, signalType, ancestors) {
  const scored = mutations.map((m) => {
    const hopCount = ancestors.get(m.nodeId) || 0;
    const { lr } = lookupLR(m.mutationType, signalType);

    // Prior = base_rate * temporal_decay * hop_attenuation
    const baseRate = 0.1; // base mutation rate
    const tDecay = temporalDecay(m.minutesSinceMutation, m.resourceClass);
    const hAttenuation = hopAttenuation(hopCount);
    const prior = baseRate * tDecay * hAttenuation;

    // Posterior
    const posterior = computePosterior(prior, lr);

    return {
      ...m,
      hopCount,
      likelihoodRatio: lr,
      temporalDecayFactor: tDecay,
      hopAttenuationFactor: hAttenuation,
      prior,
      posterior,
    };
  });

  // Sort by posterior descending
  scored.sort((a, b) => b.posterior - a.posterior);
  return scored;
}

/**
 * Apply "explaining away" — when multiple mutations converge to a shared
 * upstream cause, reduce confidence in individual downstream hypotheses.
 */
function applyExplainingAway(scored) {
  if (scored.length < 2) return scored;

  // Find shared services (same composeService appearing multiple times)
  const serviceCounts = {};
  for (const m of scored) {
    serviceCounts[m.service] = (serviceCounts[m.service] || 0) + 1;
  }

  const sharedServices = Object.entries(serviceCounts)
    .filter(([, count]) => count > 1)
    .map(([svc]) => svc);

  if (sharedServices.length === 0) return scored;

  // Reduce confidence in individual hypotheses when a shared cause exists
  return scored.map((m) => {
    if (sharedServices.includes(m.service) && m.posterior > 0.5) {
      // This is likely the shared root cause — boost it
      return { ...m, explainedAway: false };
    } else {
      // Reduce confidence in alternatives
      return { ...m, posterior: m.posterior * 0.7, explainedAway: true };
    }
  });
}

/**
 * Build the causal chain from scored mutations.
 */
function buildCausalChain(scored, anomaly, affectedNode) {
  const chain = [];

  // Level 1: Symptom
  chain.push({
    level: "symptom",
    node: affectedNode?.name || "host",
    description: anomaly.message,
    evidence: [`signal_type: ${ANOMALY_TO_SIGNAL[anomaly.type] || "ErrorSpike"}`, `severity: ${anomaly.severity}`],
    confidence: 1.0,
  });

  // Level 2: Intermediate (highest posterior, 1-2 hops)
  const intermediate = scored.find((m) => m.hopCount <= 2 && m.posterior > 0.1);
  if (intermediate) {
    chain.push({
      level: "intermediate",
      node: intermediate.nodeName,
      description: intermediate.description,
      evidence: intermediate.evidence,
      confidence: Number(intermediate.posterior.toFixed(4)),
      mutationType: intermediate.mutationType,
      mutationTimestamp: intermediate.mutationTimestamp,
      temporalDecay: Number(intermediate.temporalDecayFactor.toFixed(4)),
      hopCount: intermediate.hopCount,
    });
  }

  // Level 3: Root (highest posterior, furthest hop or lowest-level cause)
  const root = scored[0];
  if (root && root !== intermediate) {
    chain.push({
      level: "root",
      node: root.nodeName,
      description: root.description,
      evidence: root.evidence,
      confidence: Number(root.posterior.toFixed(4)),
      mutationType: root.mutationType,
      mutationTimestamp: root.mutationTimestamp,
      temporalDecay: Number(root.temporalDecayFactor.toFixed(4)),
      hopCount: root.hopCount,
    });
  }

  return chain;
}

/**
 * Use Qwen API (thinking mode) to reason over the causal chain and produce
 * natural language analysis + recommended actions.
 */
async function qwenCausalReasoning({ anomaly, scored, causalChain, metrics, topology, onChunk }) {
  const model = selectModel("diagnosis");

  const candidatesText = scored.slice(0, 5).map((m, i) =>
    `Candidate ${i + 1}: ${m.nodeName} (service: ${m.service})
  - Mutation: ${m.mutationType}
  - Posterior: ${(m.posterior * 100).toFixed(1)}%
  - Hop count: ${m.hopCount}
  - Temporal decay: ${m.temporalDecayFactor.toFixed(3)}
  - Description: ${m.description}
  - Evidence: ${m.evidence.join(", ")}`
  ).join("\n\n");

  const chainText = causalChain.map((c) =>
    `[${c.level}] ${c.node} (confidence: ${c.confidence}): ${c.description}`
  ).join(" -> ");

  const topologySummary = topology.summary
    ? `Containers: ${topology.summary.totalContainers} (${topology.summary.runningContainers} running), Networks: ${topology.summary.totalNetworks}, Edges: ${topology.summary.totalEdges}`
    : "N/A";

  const userMessage = `Anomaly: ${anomaly.type} — ${anomaly.message}
Severity: ${anomaly.severity}
Current metrics: CPU=${metrics.cpu}%, RAM=${metrics.ram}%, Disk=${metrics.disk}%

Topology: ${topologySummary}

Causal chain: ${chainText}

Candidate root causes (ranked by Bayesian posterior):
${candidatesText}

Based on the causal chain and evidence above:
1. Confirm or refine the root cause identification
2. Explain the causal mechanism (why did this mutation cause this signal?)
3. List 2-4 concrete recommended remediation actions (most urgent first)
4. Estimate blast radius (how many services are impacted?)

Reply as JSON:
{
  "root_cause_confirmed": true/false,
  "causal_explanation": "...",
  "recommended_actions": ["action1", "action2", ...],
  "blast_radius_estimate": <number>,
  "impacted_services": ["svc1", "svc2", ...]
}`;

  const systemPrompt = RCA_SYSTEM_PROMPT + `\n\nCurrent topology: ${topologySummary}`;

  let responseText = "";
  let reasoning = "";

  try {
    if (onChunk) {
      const stream = await guardedStream(qwen, {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        enable_thinking: true,
        thinking_budget: getThinkingBudget("diagnosis"),
        preserve_thinking: true,
      }, { module: "rca", taskType: "diagnosis" });

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.reasoning_content) {
          reasoning += delta.reasoning_content;
          onChunk({ type: "reasoning", chunk: delta.reasoning_content });
        }
        if (delta.content) {
          responseText += delta.content;
          onChunk({ type: "content", chunk: delta.content });
        }
      }
    } else {
      const res = await guardedCreate(qwen, {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        enable_thinking: true,
        thinking_budget: getThinkingBudget("diagnosis"),
        preserve_thinking: true,
      }, { module: "rca", taskType: "diagnosis" });

      reasoning = res.choices[0].message.reasoning_content || "";
      responseText = res.choices[0].message.content || "";
    }
  } catch (e) {
    console.warn("[rca] Qwen reasoning failed:", e.message);
    return {
      root_cause_confirmed: false,
      causal_explanation: "Qwen reasoning unavailable. Using deterministic Bayesian scores only.",
      recommended_actions: [],
      blast_radius_estimate: 0,
      impacted_services: [],
      reasoning: "",
      qwen_error: e.message,
    };
  }

  // Parse JSON from response (handle markdown code blocks)
  let parsed = null;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    // Non-JSON response, extract what we can
  }

  return {
    ...(parsed || {}),
    reasoning,
    raw_response: responseText,
  };
}

/**
 * Search evidence from M6 memory (historical incidents and SOPs).
 * This implements the search_evidence tool from the spec.
 */
async function searchEvidence(query, topK = 5) {
  try {
    const results = await memory.search("M6", query, topK);
    return results;
  } catch {
    // Fallback: search M3 (SOPs)
    try {
      return await memory.search("M3", query, topK);
    } catch {
      return [];
    }
  }
}

/**
 * Main RCA analysis entry point.
 * @param {object} args
 * @param {object} args.anomaly - The detected anomaly
 * @param {object} args.metrics - Current system metrics
 * @param {object} [args.emitIo] - Socket.io instance for streaming
 * @param {function} [args.onChunk] - Streaming callback
 * @returns {Promise<object>} Causal chain JSON per the output contract
 */
async function analyze({ anomaly, metrics, emitIo, onChunk }) {
  const incidentId = `rca_${uuidv4().slice(0, 8)}`;
  const signalType = ANOMALY_TO_SIGNAL[anomaly.type] || "ErrorSpike";
  const startTime = Date.now();

  // 1. Build topology DAG
  const topology = await buildTopology();

  // 2. Identify affected node(s)
  // For host-level anomalies (CPU/RAM/disk), all containers are affected
  // For service-level anomalies, find the specific container
  let affectedNodeIds = [];

  if (anomaly.data?.containerId) {
    affectedNodeIds = [anomaly.data.containerId];
  } else if (anomaly.data?.service) {
    const node = topology.nodes.find((n) => n.composeService === anomaly.data.service);
    if (node) affectedNodeIds = [node.id];
  } else {
    // Host-level: all running containers are affected
    affectedNodeIds = topology.nodes.filter((n) => n.state === "running").map((n) => n.id);
  }

  const affectedNode = affectedNodeIds.length === 1
    ? topology.nodes.find((n) => n.id === affectedNodeIds[0])
    : { name: "host", composeService: "host" };

  // 3. Walk ancestor chains for each affected node
  const allAncestors = new Map();
  for (const nodeId of affectedNodeIds) {
    const ancestors = walkAncestors(topology, nodeId);
    for (const [aid, hops] of ancestors) {
      if (!allAncestors.has(aid) || allAncestors.get(aid) > hops) {
        allAncestors.set(aid, hops);
      }
    }
  }

  // Include the affected nodes themselves (hop 0)
  for (const nid of affectedNodeIds) {
    if (!allAncestors.has(nid)) allAncestors.set(nid, 0);
  }

  // 4. Collect mutations from ancestor nodes
  const allNodeIds = [...allAncestors.keys()];
  const mutations = await collectMutations(topology, allNodeIds);

  // 5. Score mutations using Bayesian LR inference
  let scored = scoreMutations(mutations, signalType, allAncestors);

  // 6. Apply explaining away for competing causes
  scored = applyExplainingAway(scored);
  scored.sort((a, b) => b.posterior - a.posterior);

  // 7. Build causal chain
  const causalChain = buildCausalChain(scored, anomaly, affectedNode);

  // 8. Search evidence from historical incidents
  const evidence = await searchEvidence(`${anomaly.type} ${anomaly.message}`, 5);

  // 9. Qwen reasoning over the causal chain
  const qwenAnalysis = await qwenCausalReasoning({
    anomaly,
    scored,
    causalChain,
    metrics,
    topology,
    onChunk,
  });

  // 10. Get blast radius from topology
  let blastRadius = 0;
  let impactedServices = [];
  if (affectedNodeIds.length === 1) {
    try {
      const impact = await getImpactAnalysis(affectedNodeIds[0]);
      blastRadius = impact.impactedCount;
      impactedServices = impact.impacted.map((i) => i.service);
    } catch {}
  } else {
    blastRadius = topology.nodes.filter((n) => n.state === "running").length;
    impactedServices = Object.keys(topology.services);
  }

  // Override with Qwen estimates if available
  if (qwenAnalysis.blast_radius_estimate && qwenAnalysis.blast_radius_estimate > blastRadius) {
    blastRadius = qwenAnalysis.blast_radius_estimate;
  }
  if (qwenAnalysis.impacted_services && qwenAnalysis.impacted_services.length > 0) {
    impactedServices = [...new Set([...impactedServices, ...qwenAnalysis.impacted_services])];
  }

  // 11. Compute overall confidence
  const topScore = scored[0]?.posterior || 0;
  const qwenConfirmed = qwenAnalysis.root_cause_confirmed === true;
  const overallConfidence = qwenConfirmed ? Math.max(topScore, 0.85) : topScore;

  // 12. Build output contract
  const result = {
    incident_id: incidentId,
    symptom: anomaly.message,
    signal_type: signalType,
    signal_detected_at: new Date().toISOString(),
    affected_node: affectedNode?.name || "host",
    causal_chain: causalChain,
    competing_causes: scored.slice(1, 4).map((m) => ({
      node: m.nodeName,
      description: m.description,
      confidence: Number(m.posterior.toFixed(4)),
      reason: m.explainedAway ? "Explained away by shared root cause" : "Alternative hypothesis",
    })),
    bayesian_scores: scored.slice(0, 5).reduce((acc, m) => {
      const key = `${m.mutationType}_to_${signalType}`;
      acc[key] = {
        LR: Number(m.likelihoodRatio.toFixed(2)),
        posterior: Number(m.posterior.toFixed(4)),
        temporal_decay: Number(m.temporalDecayFactor.toFixed(4)),
        hop_attenuation: Number(m.hopAttenuationFactor.toFixed(4)),
        hop_count: m.hopCount,
      };
      return acc;
    }, {}),
    blast_radius: blastRadius,
    impacted_services: impactedServices,
    recommended_actions: qwenAnalysis.recommended_actions || [],
    causal_explanation: qwenAnalysis.causal_explanation || "",
    qwen_reasoning: qwenAnalysis.reasoning || "",
    evidence_from_memory: evidence.map((e) => ({
      content: typeof e === "string" ? e : e.content || e.text || JSON.stringify(e),
      metadata: e?.metadata || {},
    })),
    confidence_score: Number(overallConfidence.toFixed(4)),
    governance_status: overallConfidence >= CONFIDENCE_THRESHOLD ? "approved" : "blocked",
    analysis_time_ms: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };

  // 13. Persist to M6
  await memory.store("M6", `RCA ${incidentId}: ${anomaly.type} — root cause: ${causalChain[causalChain.length - 1]?.node || "unknown"} (${(overallConfidence * 100).toFixed(1)}%)`, {
    incident_id: incidentId,
    anomaly_type: anomaly.type,
    signal_type: signalType,
    confidence: overallConfidence,
    root_cause: causalChain[causalChain.length - 1]?.node,
    blast_radius: blastRadius,
  }).catch(() => {});

  // 14. Audit
  await audit({
    operation: "rca_analyze",
    actor: "agent",
    target: anomaly.type,
    target_type: "rca",
    reasoning: `RCA for ${anomaly.type}: confidence=${overallConfidence.toFixed(2)}, root=${causalChain[causalChain.length - 1]?.node || "N/A"}`,
    result: overallConfidence >= CONFIDENCE_THRESHOLD ? "approved" : "blocked",
  }).catch(() => {});

  // 15. Emit to dashboard
  if (emitIo) {
    emitIo.emit("rca_result", result);
    emitIo.emit("action_update", {
      stage: "rca_complete",
      action: anomaly.type,
      incident_id: incidentId,
      confidence: overallConfidence,
      root_cause: causalChain[causalChain.length - 1]?.node || "unknown",
      blast_radius: blastRadius,
      timestamp: new Date().toISOString(),
    });
  }

  return result;
}

module.exports = {
  analyze,
  searchEvidence,
  collectMutations,
  walkAncestors,
  scoreMutations,
  applyExplainingAway,
  buildCausalChain,
  ANOMALY_TO_SIGNAL,
  RCA_SYSTEM_PROMPT,
};
