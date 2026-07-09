// backend/src/memory/learning.js
// SOS Architecture Mapping:
// - SOS V7 (Execution & Learning): Learning Engine - extracts lessons from outcomes
// - SOS V7 (Execution & Learning): Organizational Memory Manager - stores organizational intelligence
// - SOS V10 (Governance): Continuous Learning Framework - improves future decisions
//
// Organizational Learning System — feedback loop + playbook auto-generation.
//
// Loop: Action → Outcome → Measurement → Error Detection → Model Update → Policy Update → New Action
//
// When the agent fixes an anomaly, it stores the remediation pattern in M3
// (Operational Memory) as an auto-generated SOP. Next time a similar anomaly
// occurs, the agent checks M3 first (before Qwen diagnosis) and applies the
// known fix — faster resolution.

const { query } = require("../db/pool");
const { store, semanticSearch } = require("./store");
const { calculateDQS } = require("../qwen/confidence");
const crypto = require("crypto");

/**
 * Record an action outcome and close the learning loop.
 * 1. Store the execution in M4
 * 2. Store the decision context in M5
 * 3. If the action fixed an anomaly, auto-generate an M3 SOP
 * 4. Store a learning note in M6 (with embedding)
 * 5. Update DQ score
 *
 * @param {object} args
 * @param {string} args.actionId
 * @param {string} args.actionType
 * @param {string} args.actionDetail
 * @param {string} args.result  "success" | "failure" | "timeout" | "blocked"
 * @param {object} args.safPassed
 * @param {boolean} args.humanApproved
 * @param {object} args.decision  { context, alternatives, confidence, reasoning, riskLevel, chosenAction }
 * @param {string} [args.anomalyType]  e.g. "cpu_spike", "disk_full" — if set, triggers SOP generation
 * @param {object} [args.outcome]  { result, success, toolResults }
 * @returns {Promise<{m4Id, m5Id, m6Id, sopId, dqScore}>}
 */
async function recordOutcome({
  actionId,
  actionType,
  actionDetail,
  result,
  safPassed,
  humanApproved,
  decision,
  anomalyType,
  outcome,
}) {
  const ids = {};

  // 1. M4: Execution memory
  const m4 = await store("M4", actionDetail, {
    action_id: actionId,
    action_type: actionType,
    result,
    saf_passed: safPassed,
    human_approved: humanApproved,
  });
  ids.m4Id = m4.id;

  // 2. M5: Decision memory
  if (decision) {
    const m5 = await store("M5", decision.chosenAction || actionDetail, {
      action_id: actionId,
      context: decision.context,
      alternatives_json: decision.alternatives || [],
      confidence: decision.confidence,
      dq_score: decision.dqScore,
      chosen_action: decision.chosenAction,
      reasoning: decision.reasoning,
      risk_level: decision.riskLevel || "low",
    });
    ids.m5Id = m5.id;
  }

  // 3. DQ score via Qwen structured output
  let dqScore = null;
  if (outcome) {
    try {
      const dqs = await calculateDQS(
        { intent: decision?.context, plan: actionDetail, confidence: decision?.confidence },
        outcome
      );
      dqScore = averageDQS(dqs);
      // Update M5 with the DQ score
      if (ids.m5Id) {
        await query("UPDATE m5_decision SET dq_score = $1 WHERE id = $2", [dqScore, ids.m5Id]);
      }
    } catch (e) {
      console.warn("[learning] DQS calculation failed:", e.message);
    }
  }

  // 4. M3: Auto-generate SOP if the action fixed an anomaly
  if (anomalyType && result === "success") {
    const sopId = await autoGenerateSOP(anomalyType, actionDetail, decision?.chosenAction);
    if (sopId) ids.sopId = sopId;
  }

  // 5. M6: Learning memory (with embedding)
  const learningNote = buildLearningNote(actionType, result, anomalyType, decision, outcome);
  if (learningNote) {
    const patternHash = crypto
      .createHash("md5")
      .update(`${anomalyType || actionType}:${result}`)
      .digest("hex");
    const m6 = await store("M6", learningNote, {
      action_id: actionId,
      error_type: result === "failure" ? "misdiagnosis" : anomalyType,
      pattern_hash: patternHash,
    });
    ids.m6Id = m6.id;
  }

  return { ...ids, dqScore };
}

/**
 * Auto-generate a remediation SOP in M3 when an anomaly is successfully fixed.
 * Checks if a similar SOP already exists (by trigger) — if so, increments
 * success_count instead of creating a duplicate.
 */
async function autoGenerateSOP(anomalyType, actionDetail, chosenAction) {
  const trigger = anomalyType;
  const sopName = `Auto-SOP: ${anomalyType}`;

  // Check for existing SOP with the same trigger
  const existing = await query(
    "SELECT id, success_count FROM m3_operational WHERE trigger = $1 AND auto_generated = TRUE ORDER BY last_used DESC LIMIT 1",
    [trigger]
  );

  if (existing.rows.length) {
    // Reinforce existing SOP
    await query(
      "UPDATE m3_operational SET success_count = success_count + 1, last_used = NOW() WHERE id = $1",
      [existing.rows[0].id]
    );
    return existing.rows[0].id;
  }

  // Create new auto-generated SOP
  const steps = [
    { step: 1, action: "Detect anomaly", detail: trigger },
    { step: 2, action: "Diagnose root cause", detail: chosenAction || actionDetail },
    { step: 3, action: "Apply remediation", detail: actionDetail },
    { step: 4, action: "Verify resolution", detail: "Check metrics returned to normal" },
  ];
  const row = await store("M3", sopName, {
    sop_name: sopName,
    trigger: trigger,
    steps_json: steps,
    auto_generated: true,
  });
  // Set initial success count
  await query("UPDATE m3_operational SET success_count = 1, last_used = NOW() WHERE id = $1", [row.id]);
  return row.id;
}

/**
 * Look up an SOP in M3 for a given anomaly type.
 * The agent calls this BEFORE Qwen diagnosis — if a known fix exists, apply it directly.
 *
 * @param {string} anomalyType  e.g. "cpu_spike"
 * @returns {Promise<{found:boolean, sop:object|null}>}
 */
async function lookupSOP(anomalyType) {
  const res = await query(
    "SELECT * FROM m3_operational WHERE trigger = $1 AND success_count > fail_count ORDER BY success_count DESC, last_used DESC LIMIT 1",
    [anomalyType]
  );
  if (!res.rows.length) return { found: false, sop: null };
  return { found: true, sop: res.rows[0] };
}

/**
 * Record a SOP success or failure (for learning loop reinforcement).
 */
async function recordSOPResult(sopId, success) {
  if (success) {
    await query(
      "UPDATE m3_operational SET success_count = success_count + 1, last_used = NOW() WHERE id = $1",
      [sopId]
    );
  } else {
    await query(
      "UPDATE m3_operational SET fail_count = fail_count + 1, last_used = NOW() WHERE id = $1",
      [sopId]
    );
  }
}

/**
 * Get learned lessons from M6 (for the /api/learning/lessons endpoint).
 * Returns the most-reinforced learning patterns.
 */
async function getLessons({ limit = 20 } = {}) {
  const res = await query(
    `SELECT id, timestamp, error_type, improvement_note, pattern_hash, reinforcement_count
     FROM m6_learning
     ORDER BY reinforcement_count DESC, timestamp DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

/**
 * Get DQ score trend over time (for the /api/analytics/dq-trend endpoint).
 */
async function getDQTrend({ days = 30 } = {}) {
  const res = await query(
    `SELECT DATE(timestamp) AS date,
            AVG(dq_score) AS avg_dq_score,
            AVG(confidence) AS avg_confidence,
            COUNT(*) AS decision_count
     FROM m5_decision
     WHERE timestamp >= NOW() - INTERVAL '${Number(days)} days'
       AND dq_score IS NOT NULL
     GROUP BY DATE(timestamp)
     ORDER BY date ASC`,
    []
  );
  return res.rows.map((r) => ({
    date: r.date,
    dq_score: Number(r.avg_dq_score).toFixed(2),
    avg_confidence: Number(r.avg_confidence).toFixed(3),
    decision_count: r.decision_count,
  }));
}

// ---- helpers ----

function averageDQS(dqs) {
  const keys = ["info_quality", "model_quality", "reasoning_quality", "execution_quality", "learning_quality"];
  const sum = keys.reduce((acc, k) => acc + (Number(dqs[k]) || 0), 0);
  return Number(((sum / keys.length) * 100).toFixed(2)); // 0-100 scale
}

function buildLearningNote(actionType, result, anomalyType, decision, outcome) {
  if (result === "success" && anomalyType) {
    return `Successfully resolved ${anomalyType} via ${decision?.chosenAction || actionType}. Pattern stored for future use.`;
  }
  if (result === "failure") {
    return `Failed to resolve ${anomalyType || actionType}. Action ${decision?.chosenAction || actionType} did not achieve desired outcome. Need alternative approach.`;
  }
  if (result === "blocked") {
    return `Action ${actionType} was blocked by SAF. Review policy for this action type.`;
  }
  return null;
}

module.exports = {
  recordOutcome,
  autoGenerateSOP,
  lookupSOP,
  recordSOPResult,
  getLessons,
  getDQTrend,
};
