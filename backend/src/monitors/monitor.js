// backend/src/monitors/monitor.js
// SOS Architecture Mapping:
// - SOS V5 (Simulation): Digital Twin Manager - creates digital representation of system state
// - SOS V7 (Execution & Learning): Monitoring Engine - measures actual execution
// - SOS V7 (Execution & Learning): Feedback Engine - captures reality from system metrics
//
// Continuous monitoring service — polls server health every 30s and detects
// anomalies (CPU, RAM, disk, process crashes, port conflicts).
//
// On anomaly:
//   1. Store in M1 (Raw Event)
//   2. Check M3 for a known SOP (learning loop — skip Qwen if found)
//   3. If no SOP: trigger Qwen diagnosis (qwen3.7-max + thinking + stream)
//   4. Stream reasoning_content to dashboard via WebSocket
//   5. Generate remediation plan via structured output
//   6. Route through Certainty Pipeline
//   7. Notify user via Telegram + Dashboard

const si = require("systeminformation");
const { v4: uuidv4 } = require("uuid");

const memory = require("../memory/store");
const { lookupSOP } = require("../memory/learning");
const { runCertaintyPipeline } = require("../pipeline/certainty");
const { safCheck } = require("../pipeline/saf");
const { executeTool } = require("../qwen/toolExecutor");
const { audit } = require("../utils/audit");

// Anomaly thresholds (configurable via env)
const THRESHOLDS = {
  CPU_PERCENT: Number(process.env.THRESHOLD_CPU || 85),
  RAM_PERCENT: Number(process.env.THRESHOLD_RAM || 90),
  DISK_PERCENT: Number(process.env.THRESHOLD_DISK || 85),
};

const POLL_INTERVAL_MS = Number(process.env.MONITOR_INTERVAL_MS || 30000);

// Track state for sustained-anomaly detection (CPU needs 5 min sustained)
const state = {
  cpuHighSince: null,
  lastProcesses: [],
  lastPorts: [],
  running: false,
  intervalId: null,
  io: null,
};

/**
 * Start the monitoring loop.
 * @param {object} io  Socket.io server for real-time alerts
 */
function start(io) {
  if (state.running) return;
  state.io = io;
  state.running = true;
  console.log(`[monitor] Started (poll every ${POLL_INTERVAL_MS}ms)`);
  // Run immediately, then on interval
  tick().catch((e) => console.error("[monitor] tick error:", e.message));
  state.intervalId = setInterval(() => tick().catch((e) => console.error("[monitor] tick error:", e.message)), POLL_INTERVAL_MS);
}

function stop() {
  if (state.intervalId) clearInterval(state.intervalId);
  state.running = false;
  console.log("[monitor] Stopped");
}

/**
 * Single monitoring tick: collect metrics, detect anomalies, trigger diagnosis.
 */
async function tick() {
  const metrics = await collectMetrics();
  const anomalies = detectAnomalies(metrics);

  for (const anomaly of anomalies) {
    await handleAnomaly(anomaly, metrics);
  }

  // Emit metrics to connected dashboards (for live graphs)
  if (state.io) {
    state.io.emit("server_metrics", metrics);
  }
}

/**
 * Collect all server metrics in one pass.
 */
async function collectMetrics() {
  const [cpuLoad, mem, fsSize, procs, ports] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.processes().catch(() => ({ list: [] })),
    si.networkConnections().catch(() => []),
  ]);

  const disk = fsSize[0] ? { used: fsSize[0].used, total: fsSize[0].size, percent: fsSize[0].use } : null;

  return {
    timestamp: new Date().toISOString(),
    cpu: Number(cpuLoad.currentLoad.toFixed(2)),
    ram: Number(((mem.used / mem.total) * 100).toFixed(2)),
    ram_used_mb: Math.round(mem.used / 1024 / 1024),
    ram_total_mb: Math.round(mem.total / 1024 / 1024),
    disk: disk ? disk.percent : null,
    processes: procs.list || [],
    ports: (ports || []).filter((c) => c.state === "LISTEN"),
  };
}

/**
 * Detect anomalies based on current metrics + thresholds.
 * Returns array of anomaly descriptors.
 */
function detectAnomalies(metrics) {
  const anomalies = [];

  // CPU: sustained high usage (>threshold for 5 min)
  if (metrics.cpu > THRESHOLDS.CPU_PERCENT) {
    if (!state.cpuHighSince) state.cpuHighSince = Date.now();
    const sustainedMs = Date.now() - state.cpuHighSince;
    if (sustainedMs >= 5 * 60 * 1000) {
      anomalies.push({
        type: "cpu_spike",
        severity: "critical",
        message: `CPU at ${metrics.cpu}% for ${Math.round(sustainedMs / 1000)}s`,
        data: { cpu: metrics.cpu, sustained_seconds: Math.round(sustainedMs / 1000) },
      });
    }
  } else {
    state.cpuHighSince = null;
  }

  // RAM: immediate anomaly if >threshold
  if (metrics.ram > THRESHOLDS.RAM_PERCENT) {
    anomalies.push({
      type: "ram_pressure",
      severity: "critical",
      message: `RAM at ${metrics.ram}% (${metrics.ram_used_mb}/${metrics.ram_total_mb} MB)`,
      data: { ram: metrics.ram, used_mb: metrics.ram_used_mb, total_mb: metrics.ram_total_mb },
    });
  }

  // Disk: immediate anomaly if >threshold
  if (metrics.disk !== null && metrics.disk > THRESHOLDS.DISK_PERCENT) {
    anomalies.push({
      type: "disk_pressure",
      severity: "warning",
      message: `Disk at ${metrics.disk}%`,
      data: { disk: metrics.disk },
    });
  }

  // Port conflicts: same port bound by multiple PIDs
  const portCounts = {};
  for (const p of metrics.ports) {
    const key = `${p.localPort}:${p.protocol}`;
    portCounts[key] = (portCounts[key] || 0) + 1;
  }
  for (const [key, count] of Object.entries(portCounts)) {
    if (count > 1) {
      anomalies.push({
        type: "port_conflict",
        severity: "warning",
        message: `Port ${key} bound by ${count} processes`,
        data: { port: key, count },
      });
    }
  }

  return anomalies;
}

/**
 * Handle a detected anomaly: store M1, check M3 for known SOP, trigger
// Qwen diagnosis if needed, stream reasoning, route through pipeline.
 */
async function handleAnomaly(anomaly, metrics) {
  const anomalyId = `anom_${uuidv4().slice(0, 8)}`;

  // 1. Store in M1 (Raw Event)
  await memory.store("M1", anomaly.message, {
    event_type: anomaly.type,
    severity: anomaly.severity,
    ...anomaly.data,
  });

  // 2. Emit alert to dashboard
  if (state.io) {
    state.io.emit("anomaly_alert", { id: anomalyId, ...anomaly, timestamp: new Date().toISOString() });
  }

  console.log(`[monitor] Anomaly: ${anomaly.type} — ${anomaly.message}`);

  // 3. Check M3 for a known SOP (learning loop)
  const { found, sop } = await lookupSOP(anomaly.type);
  if (found) {
    console.log(`[monitor] Known SOP found: ${sop.sop_name} (success_count=${sop.success_count})`);
    if (state.io) {
      state.io.emit("sop_match", { anomalyId, sop: { name: sop.sop_name, steps: sop.steps_json, successCount: sop.success_count } });
    }
    // Apply the known fix directly (still goes through SAF)
    await applyKnownSOP(anomalyId, anomaly, sop, metrics);
    return;
  }

  // 4. No known SOP → trigger Qwen diagnosis with thinking + streaming
  await diagnoseWithQwen(anomalyId, anomaly, metrics);
}

/**
 * Apply a known SOP from M3 (faster path — skips Qwen diagnosis).
 */
async function applyKnownSOP(anomalyId, anomaly, sop, metrics) {
  const steps = Array.isArray(sop.steps_json) ? sop.steps_json : [];
  const remediationStep = steps.find((s) => /apply|remediat|kill|restart/i.test(s.action || "")) || steps[steps.length - 1];
  const action = remediationStep?.detail || remediationStep?.action || "apply known fix";

  // SAF check
  const saf = await safCheck(action, anomaly.type, "low", { username: "agent", role: "admin" }, 0.9, false);
  if (!saf.passed) {
    console.warn(`[monitor] SOP blocked by SAF: ${action}`);
    await audit({ operation: "block", actor: "agent", target: action, target_type: "command", reasoning: "SOP blocked by SAF", safResult: saf, result: "blocked" });
    return;
  }

  // Execute
  const result = await executeTool("execute_command", { command: action, timeout: 10000 });
  if (state.io) state.io.emit("action_update", { anomalyId, stage: "sop_applied", action, result });

  await audit({ operation: "execute", actor: "agent", target: action, target_type: "command", reasoning: `Auto-applied SOP: ${sop.sop_name}`, safResult: saf, result: result.exit_code === 0 ? "success" : "failure" });
}

/**
 * Diagnose an anomaly with Qwen thinking mode + streaming.
 */
async function diagnoseWithQwen(anomalyId, anomaly, metrics) {
  if (state.io) state.io.emit("action_update", { anomalyId, stage: "diagnosing" });

  const userMessage = `Anomaly detected: ${anomaly.type} — ${anomaly.message}. Current metrics: CPU=${metrics.cpu}%, RAM=${metrics.ram}%, Disk=${metrics.disk}%. Diagnose the root cause and propose a remediation action.`;

  try {
    const pipeline = await runCertaintyPipeline({
      userMessage,
      serverState: metrics,
      onChunk: (evt) => {
        if (state.io) {
          state.io.emit(evt.type === "reasoning" ? "reasoning_stream" : "response_stream", { anomalyId, chunk: evt.chunk });
        }
      },
    });

    if (state.io) {
      state.io.emit("action_update", {
        anomalyId,
        stage: "diagnosis_complete",
        confidence: pipeline.confidence,
        risk_level: pipeline.risk_level,
        action: pipeline.action,
        authorization: pipeline.authorization_type,
      });
    }

    // If auto-authorized, execute the remediation
    if (pipeline.authorization_type === "auto" && pipeline.action) {
      const saf = await safCheck(pipeline.action, anomaly.type, pipeline.risk_level, { username: "agent", role: "admin" }, pipeline.confidence, false);
      if (saf.passed) {
        const result = await executeTool("execute_command", { command: pipeline.action, timeout: 15000 });
        if (state.io) state.io.emit("action_update", { anomalyId, stage: "remediated", result });
        await audit({ operation: "execute", actor: "agent", target: pipeline.action, target_type: "command", reasoning: pipeline.reasoning, confidence: pipeline.confidence, safResult: saf, result: result.exit_code === 0 ? "success" : "failure" });
      }
    } else if (state.io) {
      state.io.emit("approval_needed", { anomalyId, action: pipeline.action, confidence: pipeline.confidence, risk_level: pipeline.risk_level });
    }
  } catch (e) {
    console.error(`[monitor] Diagnosis failed for ${anomalyId}:`, e.message);
    if (state.io) state.io.emit("action_update", { anomalyId, stage: "error", error: e.message });
  }
}

module.exports = { start, stop, tick, collectMetrics, detectAnomalies, handleAnomaly, THRESHOLDS };
