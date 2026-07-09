// backend/src/routes/decision.js
// Decision intelligence endpoints: mass calculation and calibration metrics.

const express = require("express");
const router = express.Router();
const { calculateDecisionMass, inferMassForAction } = require("../decision/mass");
const { recordOutcome, getCalibrationMetrics } = require("../decision/calibration");
const dre = require("../decision/dre");
const drev = require("../decision/drev");
const crds = require("../decision/crds");
const critique = require("../decision/critique");
const disc = require("../decision/disc");

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
 * GET /api/decision/calibration
 * Alias for /calibration/metrics — returns aggregate calibration metrics.
 */
router.get("/calibration", async (req, res) => {
  try {
    const metrics = await getCalibrationMetrics();
    res.json({ metrics });
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

/**
 * POST /api/decision/research
 * Deep Research Engine: generate ≥2 candidates with source credibility,
 * contradiction detection, and coverage scoring.
 */
router.post("/research", async (req, res) => {
  const { symptom, serverState } = req.body;
  if (!symptom) {
    return res.status(400).json({ error: "symptom is required" });
  }
  try {
    const io = req.app.get("io");
    const result = await dre.research(symptom, serverState || {}, { io });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/decision/verify
 * DREV Pairwise Verification: tournament bracket, AHP CR, robustness, reserve.
 */
router.post("/verify", async (req, res) => {
  const { candidates, regime, historicalOutcomes, serverState } = req.body;
  if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
    return res.status(400).json({ error: "candidates array is required" });
  }
  try {
    const io = req.app.get("io");
    const result = await drev.verify(candidates, { io, regime, historicalOutcomes, serverState });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/decision/reaction
 * CRDS: score resource reaction for a candidate action.
 */
router.post("/reaction", async (req, res) => {
  const { action, serverState } = req.body;
  if (!action) {
    return res.status(400).json({ error: "action is required" });
  }
  try {
    const io = req.app.get("io");
    const result = await crds.scoreReaction(action, serverState || {}, { io });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/decision/reaction/outcome
 * Record actual outcome for CRDS adaptive weight updating.
 */
router.post("/reaction/outcome", async (req, res) => {
  const { action, predicted_rrs, actual_delta } = req.body;
  if (!action || predicted_rrs == null || actual_delta == null) {
    return res.status(400).json({ error: "action, predicted_rrs, and actual_delta are required" });
  }
  try {
    const result = await crds.recordOutcome(action, predicted_rrs, actual_delta);
    res.json({ recorded: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/decision/quality
 * Claude Critique: quantity vs. quality split, feedback grades, DQ score.
 */
router.get("/quality", async (req, res) => {
  try {
    const [split, grades] = await Promise.all([
      critique.getQuantityQualitySplit(),
      critique.getRecentFeedbackGrades(20),
    ]);
    res.json({ split, grades, dq_target: critique.DQ_TARGET });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/decision/disc
 * DISC: rank sources by information gain, detect redundancy, compute cost-efficiency.
 */
router.post("/disc", async (req, res) => {
  const { sources, isTailEvent } = req.body;
  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return res.status(400).json({ error: "sources array is required" });
  }
  try {
    const result = await disc.rank(sources, { isTailEvent });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
