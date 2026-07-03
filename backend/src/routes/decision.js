// backend/src/routes/decision.js
// Decision intelligence endpoints: mass calculation and calibration metrics.

const express = require("express");
const router = express.Router();
const { calculateDecisionMass, inferMassForAction } = require("../decision/mass");
const { recordOutcome, getCalibrationMetrics } = require("../decision/calibration");

/**
 * POST /api/decision/mass
 * Calculate decision mass from explicit inputs.
 */
router.post("/mass", (req, res) => {
  const { size, risk, complexity, confidence, domain } = req.body;
  if (!size || !risk || !complexity || !confidence) {
    return res.status(400).json({ error: "size, risk, complexity, and confidence are required" });
  }
  const mass = calculateDecisionMass({ size, risk, complexity, confidence, domain });
  res.json({ mass });
});

/**
 * POST /api/decision/mass/infer
 * Infer decision mass from an action plan and metadata.
 */
router.post("/mass/infer", (req, res) => {
  const { planStep, confidence, riskLevel, domain } = req.body;
  if (!planStep) {
    return res.status(400).json({ error: "planStep is required" });
  }
  const mass = inferMassForAction(planStep, confidence || 0.5, riskLevel || "medium", domain || "server_ops");
  res.json({ mass });
});

/**
 * POST /api/decision/calibration/outcome
 * Record the actual outcome for a previously predicted action.
 */
router.post("/calibration/outcome", async (req, res) => {
  const { action_id, outcome } = req.body;
  if (!action_id || !outcome) {
    return res.status(400).json({ error: "action_id and outcome are required" });
  }
  try {
    const result = await recordOutcome(action_id, outcome);
    res.json({ recorded: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/decision/calibration/metrics
 * Get aggregate calibration metrics.
 */
router.get("/calibration/metrics", async (req, res) => {
  try {
    const metrics = await getCalibrationMetrics();
    res.json({ metrics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
