// backend/src/monitors/incidentResponse.js
// Formal incident-response escalation procedure.
//
// Flow:
//   1. Detect anomaly (monitor.js)
//   2. Classify severity and blast radius
//   3. Try known SOP (M3)
//   4. Run AI diagnosis
//   5. Decide: auto-remediate (low risk + high confidence + SAF pass)
//             request human approval (medium risk or medium confidence)
//             escalate (high risk, repeated failure, or timeout awaiting approval)
//   6. Record incident in M6, audit log, and notify (dashboard + Telegram)
//   7. Track resolution and update SOP learning (M3)

const { v4: uuidv4 } = require("uuid");
const memory = require("../memory/store");
const { audit } = require("../utils/audit");
const { lookupSOP, recordSOPResult } = require("../memory/learning");
const { createPendingAction, approveAction } = require("../pipeline/approvals");
const { safCheck } = require("../pipeline/saf");
const { executeTool } = require("../qwen/toolExecutor");
const { runCertaintyPipeline } = require("../pipeline/certainty");
const { addTerminalLog } = require("../utils/terminalLog");
const { sendTelegramMessage } = require("../telegram/bot");

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHATID || "";
const ESCALATION_TIMEOUT_MS = Number(process.env.ESCALATION_TIMEOUT_MS || 10 * 60 * 1000); // 10 min default
const MAX_AUTO_RETRY = Number(process.env.MAX_AUTO_RETRY || 2);
const AUTO_EXECUTE_THRESHOLD = Number(process.env.AUTO_EXECUTE_THRESHOLD || 0.85);

// In-memory incident registry (long-term status tracked in M6 + Postgres audit)
const incidents = new Map();

/**
 * Start tracking a new incident.
 */
function createIncident(anomaly) {
  const incidentId = `inc_${uuidv4().slice(0, 8)}`;
  const incident = {
    incident_id: incidentId,
    anomaly,
    status: "open", // open, contained, escalated, resolved, closed
    createdAt: Date.now(),
    updatedAt: Date.now(),
    diagnosis: null,
    remediation_action: null,
    auto_attempts: 0,
    approval_action_id: null,
    resolution: null,
    escalations: [],
  };
  incidents.set(incidentId, incident);
  return incident;
}

/**
 * Classify the severity and blast radius of an anomaly.
 */
function classifyIncident(anomaly, metrics) {
  const severityRank = { warning: 1, critical: 2 };
  const isCritical = anomaly.severity === "critical";

  // Blast radius: how many resources are affected
  let blastRadius = "single";
  if (anomaly.type === "cpu_spike" || anomaly.type === "ram_pressure") blastRadius = "host";
  if (anomaly.type === "disk_pressure") blastRadius = "storage";
  if (anomaly.type === "network_latency" || anomaly.type === "network_errors") blastRadius = "network";
  if (anomaly.type === "port_conflict") blastRadius = "service";

  // Escalation tier based on severity + blast radius
  let tier = "tier_1";
  if (isCritical && blastRadius === "host") tier = "tier_3";
  else if (isCritical || blastRadius === "network") tier = "tier_2";

  return {
    severity: anomaly.severity,
    blastRadius,
    tier,
    autoAllowed: tier === "tier_1" && !isCritical,
  };
}

/**
 * Notify via dashboard WebSocket and Telegram (if configured).
 */
async function notifyEscalation({ incident, reason, emitIo }) {
  const text = `🚨 ESCALATION ${incident.incident_id}\nType: ${incident.anomaly.type}\nSeverity: ${incident.anomaly.severity}\nReason: ${reason}\nAction: ${incident.remediation_action || "pending human decision"}`;

  // Dashboard notification
  if (emitIo) {
    emitIo.emit("incident_escalated", {
      incident_id: incident.incident_id,
      anomaly: incident.anomaly,
      reason,
      status: incident.status,
      timestamp: new Date().toISOString(),
    });
    emitIo.emit("action_update", {
      stage: "incident_escalated",
      action: incident.anomaly.type,
      message: reason,
      incident_id: incident.incident_id,
      severity: incident.anomaly.severity,
      timestamp: new Date().toISOString(),
    });
  }

  // Telegram notification
  if (TELEGRAM_CHAT_ID) {
    try {
      await sendTelegramMessage(TELEGRAM_CHAT_ID, text);
    } catch (e) {
      console.warn("[incident] Telegram escalation failed:", e.message);
    }
  }

  // Audit trail
  await audit({
    operation: "escalate",
    actor: "agent",
    target: incident.anomaly.type,
    target_type: "incident",
    reasoning: reason,
    result: "escalated",
  });

  // Persist escalation in M6 (lessons / incidents)
  await memory.store("M6", `Incident ${incident.incident_id} escalated: ${reason}`, {
    incident_id: incident.incident_id,
    anomaly_type: incident.anomaly.type,
    severity: incident.anomaly.severity,
    status: "escalated",
    reason,
  }).catch(() => {});
}

/**
 * Record an incident resolution/failure so the learning loop can improve SOPs.
 */
async function recordIncidentResolution(incident, success, resultData, emitIo) {
  incident.status = success ? "resolved" : "escalated";
  incident.resolution = {
    success,
    ...resultData,
    resolvedAt: new Date().toISOString(),
  };
  incident.updatedAt = Date.now();

  if (emitIo) {
    emitIo.emit("incident_resolved", {
      incident_id: incident.incident_id,
      status: incident.status,
      success,
      ...resultData,
      timestamp: new Date().toISOString(),
    });
    emitIo.emit("action_update", {
      stage: success ? "incident_resolved" : "incident_failed",
      action: incident.anomaly.type,
      message: success ? "Incident resolved" : "Incident not resolved — requires manual intervention",
      incident_id: incident.incident_id,
      timestamp: new Date().toISOString(),
    });
  }

  await audit({
    operation: success ? "remediate" : "escalate",
    actor: "agent",
    target: incident.anomaly.type,
    target_type: "incident",
    reasoning: incident.remediation_action || "manual intervention required",
    result: success ? "success" : "failure",
  });

  await memory.store("M6", `Incident ${incident.incident_id} ${success ? "resolved" : "not resolved"}`, {
    incident_id: incident.incident_id,
    anomaly_type: incident.anomaly.type,
    status: incident.status,
    success,
    action: incident.remediation_action,
  }).catch(() => {});
}

/**
 * Execute a remediation command, log it, and return the result.
 */
async function executeRemediation(incident, command, timeout = 15000, emitIo) {
  const result = await executeTool("execute_command", { command, timeout });

  addTerminalLog({
    command: `[AI-INCIDENT] ${command}`,
    output: result.stdout || result.stderr || `exit code: ${result.exit_code}`,
    exitCode: result.exit_code,
    source: "ai",
    io: emitIo,
  }).catch(() => {});

  return result;
}

/**
 * Try auto-remediation: SAF check → execute → verify.
 */
async function tryAutoRemediation({ incident, command, confidence, riskLevel, metrics, emitIo }) {
  incident.auto_attempts += 1;

  const saf = await safCheck(command, incident.anomaly.type, riskLevel, { username: "agent", role: "admin" }, confidence, false);
  if (!saf.passed) {
    const reason = `SAF blocked auto-remediation for ${incident.anomaly.type}`;
    console.warn(`[incident] ${reason}`);
    incident.escalations.push({ at: Date.now(), reason });
    await notifyEscalation({ incident, reason, emitIo });
    return { success: false, blockedBySaf: true, saf };
  }

  const result = await executeRemediation(incident, command, 15000, emitIo);
  const success = result.exit_code === 0;

  // Verify: re-collect metrics and check if anomaly cleared
  const verifyMetrics = await require("./monitor").collectMetrics();
  const stillAnomalous = checkAnomalyStillPresent(incident.anomaly, verifyMetrics);

  if (success && !stillAnomalous) {
    await recordIncidentResolution(incident, true, { command, result, verifyMetrics }, emitIo);
    return { success: true, result };
  }

  // Auto-remediation failed or anomaly persists
  if (incident.auto_attempts >= MAX_AUTO_RETRY) {
    const reason = `Auto-remediation failed ${incident.auto_attempts}x for ${incident.anomaly.type}`;
    incident.escalations.push({ at: Date.now(), reason, result });
    await notifyEscalation({ incident, reason, emitIo });
    return { success: false, result, exhaustedRetries: true };
  }

  return { success: false, result, retryable: true };
}

function checkAnomalyStillPresent(anomaly, metrics) {
  const thresholds = require("./monitor").THRESHOLDS;
  switch (anomaly.type) {
    case "cpu_spike": return metrics.cpu > thresholds.CPU_PERCENT;
    case "ram_pressure": return metrics.ram > thresholds.RAM_PERCENT;
    case "disk_pressure": return metrics.disk > thresholds.DISK_PERCENT;
    case "network_latency": return metrics.latency_ms > thresholds.NET_LATENCY_MS;
    case "network_errors": {
      const totalErrors = (metrics.network?.rx_errors || 0) + (metrics.network?.tx_errors || 0);
      return totalErrors > thresholds.NET_ERROR_RATE;
    }
    default: return false;
  }
}

/**
 * Request human approval for a remediation action.
 */
async function requestHumanApproval({ incident, command, confidence, riskLevel, saf, emitIo }) {
  const plan = [{ name: "execute_command", args: { command, timeout: 15000 } }];

  const pending = await createPendingAction({
    plan,
    confidence,
    risk_level: riskLevel,
    saf,
    actor: "agent",
    source: "monitor",
    io: emitIo,
    decisionContext: {
      incident_id: incident.incident_id,
      anomaly: incident.anomaly,
      reason: "monitoring anomaly requires human approval",
    },
  });

  incident.approval_action_id = pending.action_id;
  incident.status = "pending_approval";
  incident.updatedAt = Date.now();

  // Start escalation timeout watchdog
  setTimeout(async () => {
    const current = incidents.get(incident.incident_id);
    if (current && current.status === "pending_approval") {
      const reason = `Human approval timeout for ${incident.anomaly.type} (${ESCALATION_TIMEOUT_MS / 1000}s)`;
      current.escalations.push({ at: Date.now(), reason });
      await notifyEscalation({ incident: current, reason, emitIo });
      current.status = "escalated";
    }
  }, ESCALATION_TIMEOUT_MS);

  return pending;
}

/**
 * Main incident handler: decide auto / approval / escalate.
 */
async function handleIncident({ anomaly, metrics, emitIo, skipCooldown = false }) {
  const incident = createIncident(anomaly);
  const classification = classifyIncident(anomaly, metrics);

  if (emitIo) {
    emitIo.emit("incident_opened", {
      incident_id: incident.incident_id,
      anomaly,
      classification,
      timestamp: new Date().toISOString(),
    });
  }

  // 1. Known SOP path
  const { found, sop } = await lookupSOP(anomaly.type);
  if (found) {
    const steps = Array.isArray(sop.steps_json) ? sop.steps_json : [];
    const remediationStep = steps.find((s) => /apply|remediat|kill|restart/i.test(s.action || "")) || steps[steps.length - 1];
    const command = remediationStep?.detail || remediationStep?.action || "apply known fix";
    const result = await tryAutoRemediation({ incident, command, confidence: 0.9, riskLevel: "low", metrics, emitIo });

    await recordSOPResult(sop.id, result.success);
    return { incident, result, source: "sop" };
  }

  // 2. AI diagnosis path
  const userMessage = `Anomaly detected: ${anomaly.type} — ${anomaly.message}. Current metrics: CPU=${metrics.cpu}%, RAM=${metrics.ram}%, Disk=${metrics.disk}%. Diagnose root cause and propose ONE concrete remediation command.`;
  const pipeline = await runCertaintyPipeline({ userMessage, serverState: metrics });

  incident.diagnosis = {
    reasoning: pipeline.reasoning,
    action: pipeline.action,
    confidence: pipeline.confidence,
    risk_level: pipeline.risk_level,
  };
  incident.remediation_action = pipeline.action;
  incident.updatedAt = Date.now();

  if (emitIo) {
    emitIo.emit("action_update", {
      stage: "diagnosis_complete",
      action: anomaly.type,
      message: pipeline.reasoning,
      incident_id: incident.incident_id,
      confidence: pipeline.confidence,
      risk_level: pipeline.risk_level,
      authorization: pipeline.authorization_type,
      timestamp: new Date().toISOString(),
    });
  }

  const command = pipeline.action;
  if (!command) {
    const reason = `AI did not propose a remediation action for ${anomaly.type}`;
    incident.escalations.push({ at: Date.now(), reason });
    await notifyEscalation({ incident, reason, emitIo });
    return { incident, result: { success: false, noAction: true } };
  }

  // 3. Route decision
  const confidence = pipeline.confidence || 0;
  const riskLevel = pipeline.risk_level || "medium";
  const autoEligible = classification.autoAllowed && confidence >= AUTO_EXECUTE_THRESHOLD && riskLevel === "low";

  if (autoEligible) {
    const result = await tryAutoRemediation({ incident, command, confidence, riskLevel, metrics, emitIo });
    return { incident, result, source: "auto" };
  }

  // Medium/high risk or low confidence → human approval
  const saf = await safCheck(command, anomaly.type, riskLevel, { username: "agent", role: "admin" }, confidence, false);
  const pending = await requestHumanApproval({ incident, command, confidence, riskLevel, saf, emitIo });

  return { incident, result: { success: false, pendingApproval: true, action_id: pending.action_id }, source: "approval" };
}

/**
 * Manual escalation helper (e.g. from dashboard "Escalate" button).
 */
async function escalateIncident(incidentId, reason, emitIo) {
  const incident = incidents.get(incidentId);
  if (!incident) throw new Error(`unknown incident: ${incidentId}`);
  incident.escalations.push({ at: Date.now(), reason });
  incident.status = "escalated";
  await notifyEscalation({ incident, reason, emitIo });
  return incident;
}

/**
 * Resolve an incident manually (e.g. after human fixes it).
 */
async function resolveIncident(incidentId, resolution, emitIo) {
  const incident = incidents.get(incidentId);
  if (!incident) throw new Error(`unknown incident: ${incidentId}`);
  await recordIncidentResolution(incident, true, { manual: true, ...resolution }, emitIo);
  return incident;
}

/**
 * List active incidents.
 */
function listActiveIncidents() {
  return [...incidents.values()].filter((i) => ["open", "pending_approval", "escalated"].includes(i.status));
}

module.exports = {
  handleIncident,
  escalateIncident,
  resolveIncident,
  listActiveIncidents,
  createIncident,
  classifyIncident,
  notifyEscalation,
};
