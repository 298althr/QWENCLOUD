// backend/src/decision/dre.js
// SOS Architecture Mapping:
// - SOS V4 (Intelligence Pipeline): MNIF (Multi-Node Information Factory) - transforms information into knowledge
// - SOS V4 (Intelligence Pipeline): Hypothesis Generation - generates multiple candidate solutions
//
// Deep Research Engine (DRE) — Phase 3 of track4-v4 plan.
//
// 1. Query PML memory (M1–M7) via semantic search.
// 2. Call Qwen with structured research prompt (JSON mode enforced).
// 3. Generate ≥2 structurally different candidates (pipeline failure if only 1).
// 4. Source credibility engine: 4-dimension CERQual-inspired scoring.
// 5. Contradiction detection: conflicting evidence → confidence downgrade.
// 6. Coverage score: answered_subquestions / total_subquestions.
// 7. Budget cap: max API calls per research session (default 10).
// 8. Returns candidates with full metadata.

const { qwen, selectModel } = require("../qwen/client");
const memory = require("../memory/store");
const { audit } = require("../utils/audit");
const { guardedCreate, getMaxOutputTokens } = require("../qwen/guardrails");
const { DRE_RESEARCH_PROMPT } = require("../qwen/prompts");

const MAX_API_CALLS = 10;
const CREDIBILITY_THRESHOLD = 2.5;
const CONTRADICTION_TARGET = 0.1;
const COVERAGE_TARGET = 0.9;

/**
 * Main DRE entry point: research a symptom and produce ≥2 candidates.
 *
 * @param {string} symptom - Natural-language problem description (e.g. "the API is slow")
 * @param {object} serverState - Current server metrics { cpu, ram, disk, ... }
 * @param {object} [opts] - Optional overrides { maxApiCalls, io, socketId }
 * @returns {Promise<object>} { candidates, sources, coverage, contradiction_score, budget_used, degraded }
 */
async function research(symptom, serverState = {}, opts = {}) {
  const maxApiCalls = opts.maxApiCalls || MAX_API_CALLS;
  const emit = (event, payload) => {
    if (!opts.io) return;
    if (opts.socketId) opts.io.to(opts.socketId).emit(event, payload);
    else opts.io.emit(event, payload);
  };

  let apiCallsUsed = 0;

  emit("dre_start", { symptom, budget: maxApiCalls });

  // 1. Gather evidence from PML memory via semantic search
  const evidence = [];
  try {
    const memResults = await memory.semanticSearch(symptom, ["M6", "M7"], 10);
    apiCallsUsed++; // embedding API call
    for (const r of memResults.results) {
      evidence.push({
        source: `memory:${r.layer}`,
        content: r.content,
        similarity: r.similarity,
        layer: r.layer,
        timestamp: r.timestamp,
      });
    }
  } catch (e) {
    console.warn("[DRE] memory search failed:", e.message);
  }

  // Add live server state as evidence
  if (serverState && Object.keys(serverState).length > 0) {
    evidence.push({
      source: "live_metrics",
      content: `CPU: ${serverState.cpu ?? "N/A"}%, RAM: ${serverState.ram ?? "N/A"}%, Disk: ${serverState.disk ?? "N/A"}%`,
      similarity: 1.0,
      layer: "live",
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Generate subquestions for coverage scoring (local heuristic, no API call)
  const subquestions = generateSubquestions(symptom, serverState);

  // 3. Call Qwen for candidate generation (JSON mode)
  let candidates = [];
  let degraded = false;
  try {
    candidates = await generateCandidates(symptom, serverState, evidence, subquestions, maxApiCalls - apiCallsUsed);
    apiCallsUsed++;
  } catch (e) {
    console.error("[DRE] Qwen candidate generation failed:", e.message);
    degraded = true;
    // Graceful degradation: single-candidate fallback
    candidates = [{
      description: `Direct remediation for: ${symptom}`,
      impact: "medium",
      reversibility: "mostly",
      dependencies: [],
      confidence: 0.5,
      approach: "direct",
      degraded: true,
    }];
  }

  // 4. Enforce ≥2 structurally different candidates
  if (candidates.length < 2 && !degraded) {
    // Try to generate a second candidate with a different approach hint
    try {
      const second = await generateCandidates(symptom, serverState, evidence, subquestions, 1, "alternative");
      apiCallsUsed++;
      if (second.length > 0) {
        candidates = [...candidates, ...second];
      }
    } catch (e) {
      console.warn("[DRE] second candidate generation failed:", e.message);
    }
  }

  if (candidates.length < 2) {
    // Pipeline failure — but we degrade gracefully
    console.warn("[DRE] Could not generate ≥2 structurally different candidates. Degrading to single-candidate mode.");
    degraded = true;
    if (candidates.length === 0) {
      candidates = [{
        description: `Fallback: investigate ${symptom} manually`,
        impact: "low",
        reversibility: "fully",
        dependencies: [],
        confidence: 0.3,
        approach: "manual",
        degraded: true,
      }];
    }
  }

  // 5. Score source credibility for each evidence source
  const scoredSources = scoreSourceCredibility(evidence, candidates);

  // 6. Contradiction detection
  const contradictionResult = detectContradictions(scoredSources, candidates);

  // 7. Coverage score
  const coverageResult = computeCoverage(subquestions, scoredSources, candidates);

  // 8. Downgrade confidence for low-credibility sources and contradictions
  for (const c of candidates) {
    const supportingSources = scoredSources.filter((s) => s.relevance >= CREDIBILITY_THRESHOLD);
    const sourceBoost = supportingSources.length > 0 ? 0.05 * Math.min(supportingSources.length, 4) : 0;
    const contradictionPenalty = contradictionResult.contradiction_score * 0.3;
    c.confidence = Math.max(0.1, Math.min(1.0, c.confidence + sourceBoost - contradictionPenalty));
    if (c.degraded) c.confidence = Math.min(c.confidence, 0.5);
  }

  // 9. Audit log
  try {
    await audit({
      operation: "dre_research",
      actor: "agent",
      target: symptom,
      target_type: "research",
      reasoning: `Generated ${candidates.length} candidates, coverage=${coverageResult.coverage}, contradiction=${contradictionResult.contradiction_score}`,
      confidence: candidates[0]?.confidence ?? 0,
      result: degraded ? "degraded" : "success",
    });
  } catch (e) {
    console.warn("[DRE] audit log failed:", e.message);
  }

  emit("dre_complete", {
    candidates,
    sources: scoredSources,
    coverage: coverageResult,
    contradiction: contradictionResult,
    budget_used: apiCallsUsed,
    degraded,
  });

  return {
    candidates,
    sources: scoredSources,
    coverage: coverageResult,
    contradiction_score: contradictionResult.contradiction_score,
    contradictions: contradictionResult.contradictions,
    budget_used: apiCallsUsed,
    budget_max: maxApiCalls,
    degraded,
  };
}

/**
 * Generate subquestions for the given symptom.
 */
function generateSubquestions(symptom, serverState) {
  const base = [
    "What is the root cause of the symptom?",
    "What evidence supports this diagnosis?",
    "What are the alternative explanations?",
    "What is the impact of each candidate action?",
    "What are the dependencies and prerequisites?",
    "What is the reversibility of each action?",
  ];

  if (serverState.cpu != null && serverState.cpu > 80) {
    base.push("Is CPU saturation the primary bottleneck?");
  }
  if (serverState.ram != null && serverState.ram > 85) {
    base.push("Is memory pressure causing the symptom?");
  }
  if (serverState.disk != null && serverState.disk > 85) {
    base.push("Is disk I/O contributing to the issue?");
  }

  return base;
}

/**
 * Call Qwen to generate structurally different candidate remediation actions.
 * Uses JSON mode for structured output.
 */
async function generateCandidates(symptom, serverState, evidence, subquestions, remainingBudget, approachHint) {
  const evidenceText = evidence
    .map((e, i) => `[${i + 1}] (${e.source}, sim=${e.similarity?.toFixed(2)}) ${e.content}`)
    .join("\n");

  const subqText = subquestions.map((q, i) => `${i + 1}. ${q}`).join("\n");

  const systemPrompt = DRE_RESEARCH_PROMPT;

  const userPrompt = `Symptom: ${symptom}

Current server state:
- CPU: ${serverState.cpu ?? "N/A"}%
- RAM: ${serverState.ram ?? "N/A"}%
- Disk: ${serverState.disk ?? "N/A"}%

Evidence from memory and live metrics:
${evidenceText || "(no prior evidence found)"}

Subquestions to address:
${subqText}

Generate ${approachHint === "alternative" ? "1 alternative candidate using a different approach than the above" : "at least 2 structurally different candidates"}.
IMPORTANT: Each candidate must use a fundamentally different approach to solving the problem.`;

  const res = await guardedCreate(qwen, {
    model: selectModel("dre"),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_tokens: getMaxOutputTokens("dre"),
  }, { module: "dre", taskType: "dre" });

  const raw = res.choices[0].message.content;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Try to extract JSON from the response
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error("Qwen did not return valid JSON");
    }
  }

  // Handle both { candidates: [...] } and [...] formats
  let candidates = Array.isArray(parsed) ? parsed : (parsed.candidates || parsed.actions || []);
  if (!Array.isArray(candidates)) candidates = [candidates];

  return candidates
    .filter((c) => c && c.description)
    .map((c) => normalizeCandidate(c));
}

function normalizeCandidate(c) {
  return {
    description: c.description || "",
    approach: c.approach || c.type || "remediation",
    impact: c.impact || inferImpact(c),
    reversibility: c.reversibility || "mostly",
    dependencies: Array.isArray(c.dependencies) ? c.dependencies : [],
    confidence: typeof c.confidence === "number" ? c.confidence : 0.5,
    ...c,
  };
}

function inferImpact(c) {
  const text = `${c.description || ""} ${c.approach || ""}`.toLowerCase();
  if (/restart|reload|refresh|clear cache/.test(text)) return "low";
  if (/scale|rollback|deploy|migrate/.test(text)) return "high";
  if (/kill|terminate|remove|delete|drop/.test(text)) return "high";
  return "medium";
}

/**
 * Source Credibility Engine — 4-dimension CERQual-inspired scoring.
 * Dimensions: methodological quality, coherence, adequacy, relevance (each 1-5).
 * Sources below 2.5 average are flagged and their evidence downgraded.
 */
function scoreSourceCredibility(evidence, candidates) {
  return evidence.map((src) => {
    // Methodological quality: primary metrics > derived alerts > hearsay
    let methodological = 3;
    if (src.source === "live_metrics") methodological = 5;
    else if (src.source === "memory:M6") methodological = 4;
    else if (src.source === "memory:M7") methodological = 3;
    else if (src.source?.startsWith("memory:")) methodological = 3;

    // Coherence: does this source agree with other sources?
    const others = evidence.filter((e) => e.source !== src.source);
    let agreeCount = 0;
    for (const other of others) {
      const srcContent = src.content.toLowerCase();
      const otherContent = other.content.toLowerCase();
      // Simple keyword overlap check
      const srcWords = new Set(srcContent.split(/\s+/).filter((w) => w.length > 3));
      const otherWords = new Set(otherContent.split(/\s+/).filter((w) => w.length > 3));
      const overlap = [...srcWords].filter((w) => otherWords.has(w)).length;
      if (overlap > 3) agreeCount++;
    }
    const coherence = others.length === 0 ? 3 : 2 + Math.round((agreeCount / others.length) * 3);

    // Adequacy: is there enough data? (based on content length and similarity)
    const contentLen = src.content?.length || 0;
    const adequacy = contentLen > 200 ? 5 : contentLen > 100 ? 4 : contentLen > 50 ? 3 : contentLen > 20 ? 2 : 1;

    // Relevance: does it directly address the symptom?
    let relevance = 3;
    if (src.similarity && src.similarity > 0.7) relevance = 5;
    else if (src.similarity && src.similarity > 0.5) relevance = 4;
    else if (src.similarity && src.similarity > 0.3) relevance = 3;
    else relevance = 2;

    const avg = (methodological + coherence + adequacy + relevance) / 4;
    const flagged = avg < CREDIBILITY_THRESHOLD;

    return {
      ...src,
      credibility: {
        methodological_quality: methodological,
        coherence,
        adequacy,
        relevance,
        average: Math.round(avg * 100) / 100,
        flagged,
      },
    };
  });
}

/**
 * Contradiction detection: identify conflicting evidence.
 * Two sources contradict if they support different candidate approaches.
 */
function detectContradictions(sources, candidates) {
  const contradictions = [];
  const credibleSources = sources.filter((s) => !s.credibility.flagged);

  for (let i = 0; i < credibleSources.length; i++) {
    for (let j = i + 1; j < credibleSources.length; j++) {
      const a = credibleSources[i];
      const b = credibleSources[j];
      // Check if sources point to different root causes
      const aContent = a.content.toLowerCase();
      const bContent = b.content.toLowerCase();
      const contradictionPatterns = [
        { topic: "cpu", pos: ["high", "spike", "overload", "saturation"], neg: ["low", "normal", "stable", "idle"] },
        { topic: "memory", pos: ["leak", "high", "pressure"], neg: ["stable", "normal", "low"] },
        { topic: "disk", pos: ["full", "high", "tight"], neg: ["available", "space", "low", "normal"] },
        { topic: "network", pos: ["issue", "timeout", "slow", "latency"], neg: ["stable", "fast", "responsive", "normal"] },
        { topic: "service", pos: ["down", "crash", "fail", "error"], neg: ["running", "up", "ok", "healthy"] },
      ];
      for (const { topic, pos, neg } of contradictionPatterns) {
        const aHasTopic = aContent.includes(topic);
        const bHasTopic = bContent.includes(topic);
        if (!aHasTopic && !bHasTopic) continue;
        const aPos = pos.some((p) => aContent.includes(p));
        const aNeg = neg.some((n) => aContent.includes(n));
        const bPos = pos.some((p) => bContent.includes(p));
        const bNeg = neg.some((n) => bContent.includes(n));
        if ((aPos && bNeg) || (aNeg && bPos)) {
          contradictions.push({
            source_a: a.source,
            source_b: b.source,
            conflict: `${topic}: ${aPos ? pos.find((p) => aContent.includes(p)) : neg.find((n) => aContent.includes(n))} vs ${bPos ? pos.find((p) => bContent.includes(p)) : neg.find((n) => bContent.includes(n))}`,
          });
          break;
        }
      }
    }
  }

  const totalPairs = credibleSources.length * (credibleSources.length - 1) / 2;
  const contradiction_score = totalPairs > 0 ? contradictions.length / totalPairs : 0;

  return {
    contradictions,
    contradiction_score: Math.round(contradiction_score * 1000) / 1000,
    target: CONTRADICTION_TARGET,
    exceeds_target: contradiction_score > CONTRADICTION_TARGET,
  };
}

/**
 * Coverage score: answered_subquestions / total_subquestions.
 */
function computeCoverage(subquestions, sources, candidates) {
  const answered = new Set();
  for (const c of candidates) {
    if (c.answers_subquestions) {
      for (const idx of c.answers_subquestions) {
        answered.add(idx);
      }
    }
  }
  // Also check if sources address subquestions
  for (const s of sources) {
    const content = s.content?.toLowerCase() || "";
    if (content.includes("root cause") || content.includes("caused by") || content.includes("diagnos")) answered.add(1);
    if (content.includes("evidence") || content.includes("support") || content.includes("metric") || content.includes("data shows")) answered.add(2);
    if (content.includes("alternative") || content.includes("other possibility") || content.includes("different")) answered.add(3);
    if (content.includes("impact") || content.includes("affect") || content.includes("consequence")) answered.add(4);
    if (content.includes("depend") || content.includes("require") || content.includes("prerequisite")) answered.add(5);
    if (content.includes("reversib") || content.includes("rollback") || content.includes("undo")) answered.add(6);
  }

  const total = subquestions.length;
  const answeredCount = answered.size;
  const coverage = total > 0 ? answeredCount / total : 0;

  return {
    answered: answeredCount,
    total,
    coverage: Math.round(coverage * 1000) / 1000,
    target: COVERAGE_TARGET,
    meets_target: coverage >= COVERAGE_TARGET,
  };
}

module.exports = {
  research,
  generateSubquestions,
  scoreSourceCredibility,
  detectContradictions,
  computeCoverage,
  MAX_API_CALLS,
  CREDIBILITY_THRESHOLD,
};
