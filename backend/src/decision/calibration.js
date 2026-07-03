// backend/src/decision/calibration.js
// Calibration layer: track predicted confidence/outcome vs actual outcome.
// Computes Brier score and calibration error for decision predictions.

const pool = require("../db/pool");

/**
 * Record a prediction for later calibration.
 * @param {string} actionId
 * @param {number} predictedConfidence - 0 to 1
 * @param {string} [predictedOutcome] - 'success' or 'failure'
 */
async function recordPrediction(actionId, predictedConfidence, predictedOutcome = "success") {
  await pool.query(
    `INSERT INTO decision_calibration (action_id, predicted_confidence, predicted_outcome)
     VALUES ($1, $2, $3)
     ON CONFLICT (action_id) DO UPDATE SET
       predicted_confidence = EXCLUDED.predicted_confidence,
       predicted_outcome = EXCLUDED.predicted_outcome,
       recorded_at = NOW()`,
    [actionId, predictedConfidence, predictedOutcome]
  );
}

/**
 * Record the actual outcome for a previous prediction.
 * @param {string} actionId
 * @param {string} actualOutcome - 'success', 'failure', or 'partial'
 */
async function recordOutcome(actionId, actualOutcome) {
  const actualBinary = outcomeToBinary(actualOutcome);
  const predicted = await pool.query(
    `SELECT predicted_confidence, predicted_outcome FROM decision_calibration WHERE action_id = $1`,
    [actionId]
  );
  if (predicted.rows.length === 0) return null;

  const predictedConfidence = predicted.rows[0].predicted_confidence;
  const predictedOutcome = predicted.rows[0].predicted_outcome;
  const predictedBinary = outcomeToBinary(predictedOutcome);

  const brier = Math.pow(predictedBinary - actualBinary, 2);
  const calibrationError = Math.abs(predictedConfidence - actualBinary);

  await pool.query(
    `UPDATE decision_calibration
     SET actual_outcome = $1,
         brier_score = $2,
         calibration_error = $3,
         recorded_at = NOW()
     WHERE action_id = $4`,
    [actualOutcome, brier, calibrationError, actionId]
  );

  await pool.query(
    `UPDATE m5_decision SET outcome_result = $1, outcome_recorded_at = NOW() WHERE action_id = $2`,
    [actualOutcome, actionId]
  );

  return { brier_score: brier, calibration_error: calibrationError };
}

function outcomeToBinary(outcome) {
  if (outcome === "success") return 1;
  if (outcome === "failure") return 0;
  if (outcome === "partial") return 0.5;
  return 0;
}

/**
 * Compute aggregate calibration metrics.
 * @returns {object} { count, mean_brier, mean_calibration_error, ece }
 */
async function getCalibrationMetrics() {
  const result = await pool.query(
    `SELECT
       COUNT(*) AS count,
       COALESCE(AVG(brier_score), 0) AS mean_brier,
       COALESCE(AVG(calibration_error), 0) AS mean_calibration_error
     FROM decision_calibration
     WHERE actual_outcome IS NOT NULL`
  );
  const row = result.rows[0];

  // Expected Calibration Error (ECE) with 5 bins
  const eceResult = await pool.query(
    `WITH bins AS (
       SELECT
         CASE
           WHEN predicted_confidence < 0.2 THEN 1
           WHEN predicted_confidence < 0.4 THEN 2
           WHEN predicted_confidence < 0.6 THEN 3
           WHEN predicted_confidence < 0.8 THEN 4
           ELSE 5
         END AS bin,
         predicted_confidence,
         CASE
           WHEN actual_outcome = 'success' THEN 1.0
           WHEN actual_outcome = 'partial' THEN 0.5
           ELSE 0.0
         END AS actual_binary
       FROM decision_calibration
       WHERE actual_outcome IS NOT NULL
     )
     SELECT AVG(ABS(avg_conf - avg_actual)) AS ece
     FROM (
       SELECT bin,
              AVG(predicted_confidence) AS avg_conf,
              AVG(actual_binary) AS avg_actual
       FROM bins
       GROUP BY bin
     ) b`
  );

  return {
    count: parseInt(row.count, 10),
    mean_brier: parseFloat(row.mean_brier),
    mean_calibration_error: parseFloat(row.mean_calibration_error),
    ece: parseFloat(eceResult.rows[0].ece) || 0,
  };
}

module.exports = {
  recordPrediction,
  recordOutcome,
  getCalibrationMetrics,
  outcomeToBinary,
};
