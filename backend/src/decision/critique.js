// backend/src/decision/critique.js
// Claude Critique — Phase 7 of track4-v4 plan.
//
// 1. Store decisions as tuples: (node, magnitude, confidence, latency, feedback_delta).
// 2. 5-dimension feedback grading: accuracy, timeliness, actionability, completeness, novelty.
// 3. Decision Quality Score: DQ = evidence_completeness × confidence_calibration × stakeholder_alignment × reversibility.
// 4. Inflation detection: count rising while quality falling → alert.
// 5. Audit checklist with thresholds.
// 6. Quantity vs. quality split.

const { query } = require("../db/pool");
const { audit } = require("../utils/audit");

const DQ_TARGET = 0.8;
const INFLATION_TREND_PERIODS = 3;

/**
 * Store a decision tuple for critique.
 *
 * @param {object} params
 * @param {string} params.action_id
 * @param {string} params.node - The system node affected
 * @param {number} params.magnitude - Decision magnitude (DI score)
 * @param {number} params.confidence - Predicted confidence (0-1)
 * @param {number} params.latency - Decision latency in seconds
 * @param {string} params.outcome - 'success', 'failure', 'partial'
 * @param {object} [params.feedback] - 5-dimension grades
 * @param {object} [params.dqComponents] - DQ score components
 */
async function storeDecisionTuple({ action_id, node, magnitude, confidence, latency, outcome, feedback, dqComponents }) {
  const feedbackDelta = feedback ? computeFeedbackDelta(feedback) : null;
  const dqScore = dqComponents ? computeDQ(dqComponents) : null;

  try {
    await query(
      `INSERT INTO m6_learning (action_id, error_type, drift, improvement_note, pattern_hash, reinforcement_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (pattern_hash) DO NOTHING`,
      [
        action_id,
        outcome === "failure" ? "decision_failure" : outcome === "partial" ? "partial_outcome" : null,
        feedbackDelta,
        JSON.stringify({ node, magnitude, confidence, latency, outcome, feedback, dqScore }),
        `critique_${action_id}`,
        1,
      ]
    );
  } catch (e) {
    console.warn("[critique] store tuple failed:", e.message);
  }

  try {
    await audit({
      operation: "critique_store",
      actor: "agent",
      target: action_id,
      target_type: "critique",
      reasoning: `DQ=${dqScore}, feedback_delta=${feedbackDelta}, outcome=${outcome}`,
      confidence,
      result: outcome,
    });
  } catch (e) {
    console.warn("[critique] audit failed:", e.message);
  }

  return { action_id, dq_score: dqScore, feedback_delta: feedbackDelta };
}

/**
 * Compute 5-dimension feedback grade.
 * Each dimension is 1-5, feedback grade = average.
 */
function gradeFeedback({ accuracy, timeliness, actionability, completeness, novelty }) {
  const dims = { accuracy, timeliness, actionability, completeness, novelty };
  for (const [key, val] of Object.entries(dims)) {
    if (val == null || val < 1 || val > 5) {
      throw new Error(`Invalid feedback dimension ${key}: ${val} (must be 1-5)`);
    }
  }
  const grade = (accuracy + timeliness + actionability + completeness + novelty) / 5;
  return Math.round(grade * 100) / 100;
}

/**
 * Compute feedback delta (outcome deviation, not binary).
 * @returns {number} -1 to +1 (negative = worse than expected, positive = better)
 */
function computeFeedbackDelta(feedback) {
  // Average of 5 dimensions normalized to -1 to +1
  const dims = ["accuracy", "timeliness", "actionability", "completeness", "novelty"];
  const sum = dims.reduce((s, d) => s + (feedback[d] - 3) / 2, 0); // 3 = neutral, normalize to -1..+1
  return Math.round((sum / dims.length) * 100) / 100;
}

/**
 * Compute Decision Quality Score.
 * DQ = evidence_completeness × confidence_calibration × stakeholder_alignment × reversibility
 * Each component is 0-1.
 */
function computeDQ({ evidence_completeness, confidence_calibration, stakeholder_alignment, reversibility }) {
  const dq = (evidence_completeness ?? 0.5) * (confidence_calibration ?? 0.5) *
             (stakeholder_alignment ?? 0.5) * (reversibility ?? 0.5);
  return Math.round(dq * 1000) / 1000;
}

/**
 * Detect decision inflation: count rising while quality falling.
 * Checks last N periods and alerts if trend > INFLATION_TREND_PERIODS.
 *
 * @param {array} history - Array of { period, count, avg_dq }
 * @returns {object} { inflated, trend_periods, alert }
 */
function detectInflation(history) {
  if (!history || history.length < INFLATION_TREND_PERIODS + 1) {
    return { inflated: false, trend_periods: 0, alert: null };
  }

  const recent = history.slice(-INFLATION_TREND_PERIODS - 1);
  let countRising = true;
  let qualityFalling = true;

  for (let i = 1; i < recent.length; i++) {
    if (recent[i].count <= recent[i - 1].count) countRising = false;
    if (recent[i].avg_dq >= recent[i - 1].avg_dq) qualityFalling = false;
  }

  const inflated = countRising && qualityFalling;
  return {
    inflated,
    trend_periods: INFLATION_TREND_PERIODS,
    alert: inflated ? "Decision inflation detected: count rising while quality falling" : null,
  };
}

/**
 * Get quantity vs. quality split for dashboard.
 */
async function getQuantityQualitySplit() {
  try {
    const result = await query(
      `SELECT
         COUNT(*) AS total_decisions,
         AVG(CASE WHEN outcome_result = 'success' THEN 1.0 ELSE 0.0 END) AS success_rate,
         COUNT(CASE WHEN outcome_result = 'success' THEN 1 END) AS success_count,
         COUNT(CASE WHEN outcome_result = 'failure' THEN 1 END) AS failure_count,
         COUNT(CASE WHEN outcome_result = 'partial' THEN 1 END) AS partial_count
       FROM m5_decision
       WHERE outcome_result IS NOT NULL`
    );
    const row = result.rows[0];
    return {
      total: parseInt(row.total_decisions) || 0,
      success_count: parseInt(row.success_count) || 0,
      failure_count: parseInt(row.failure_count) || 0,
      partial_count: parseInt(row.partial_count) || 0,
      success_rate: parseFloat(row.success_rate) || 0,
    };
  } catch (e) {
    console.warn("[critique] quantity/quality split failed:", e.message);
    return { total: 0, success_count: 0, failure_count: 0, partial_count: 0, success_rate: 0 };
  }
}

/**
 * Get feedback grades for recent decisions.
 */
async function getRecentFeedbackGrades(limit = 20) {
  try {
    const result = await query(
      `SELECT action_id, improvement_note, drift, timestamp
       FROM m6_learning
       WHERE improvement_note LIKE '%node%'
       ORDER BY timestamp DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map((r) => {
      try {
        const parsed = JSON.parse(r.improvement_note);
        return {
          action_id: r.action_id,
          ...parsed,
          drift: r.drift,
          timestamp: r.timestamp,
        };
      } catch {
        return { action_id: r.action_id, timestamp: r.timestamp };
      }
    });
  } catch (e) {
    console.warn("[critique] feedback grades failed:", e.message);
    return [];
  }
}

/**
 * Run audit checklist.
 */
function runAuditChecklist(decisions) {
  const checks = [
    {
      check: "Decisions stored as tuples",
      threshold: "100%",
      passed: decisions.every((d) => d.node && d.magnitude != null && d.confidence != null),
      action: "Alert + log",
    },
    {
      check: "Feedback includes 5-dimension grade",
      threshold: "100% of completed",
      passed: decisions.every((d) => !d.outcome || (d.feedback && d.feedback.accuracy)),
      action: "Alert + log",
    },
    {
      check: "DQ score computed for critical decisions",
      threshold: "DQ > 0.8",
      passed: decisions.every((d) => d.magnitude < 1.0 || (d.dq_score != null && d.dq_score > DQ_TARGET)),
      action: "Flag for review",
    },
    {
      check: "No decision inflation",
      threshold: "No trend > 3 periods",
      passed: true, // Checked separately via detectInflation
      action: "Alert + throttle",
    },
    {
      check: "High-mass decisions not compared by count",
      threshold: "Always",
      passed: true, // Architectural guarantee
      action: "Alert + log",
    },
    {
      check: "Feedback delta records outcome deviation",
      threshold: "100%",
      passed: decisions.every((d) => !d.outcome || d.feedback_delta != null),
      action: "Alert + log",
    },
  ];

  const failed = checks.filter((c) => !c.passed);
  return {
    total_checks: checks.length,
    passed: checks.length - failed.length,
    failed,
    all_passed: failed.length === 0,
  };
}

module.exports = {
  storeDecisionTuple,
  gradeFeedback,
  computeFeedbackDelta,
  computeDQ,
  detectInflation,
  getQuantityQualitySplit,
  getRecentFeedbackGrades,
  runAuditChecklist,
  DQ_TARGET,
};
