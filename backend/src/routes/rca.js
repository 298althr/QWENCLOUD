// backend/src/routes/rca.js
// REST endpoints for Root Cause Analysis.

const express = require("express");
const router = express.Router();
const rcaEngine = require("../rca/rcaEngine");
const { runAllTests, TEST_SCENARIOS } = require("../rca/calibration");
const { collectMetrics } = require("../monitors/monitor");

/**
 * POST /api/rca/analyze
 * Body: { anomaly: { type, severity, message, data }, metrics?: {...} }
 * Runs RCA on the given anomaly and returns the causal chain.
 */
router.post("/analyze", async (req, res) => {
  try {
    const { anomaly, metrics } = req.body || {};
    if (!anomaly || !anomaly.type) {
      return res.status(400).json({ error: "anomaly.type is required" });
    }

    const io = req.app.get("io");
    const serverMetrics = metrics || await collectMetrics().catch(() => ({ cpu: 0, ram: 0, disk: 0 }));

    const result = await rcaEngine.analyze({
      anomaly,
      metrics: serverMetrics,
      emitIo: io,
    });

    res.json(result);
  } catch (e) {
    console.error("[rca] analyze error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/rca/tests
 * Returns the list of calibration test scenarios (without running them).
 */
router.get("/tests", (req, res) => {
  res.json({
    tests: TEST_SCENARIOS.map((t) => ({
      id: t.id,
      scenario: t.scenario,
      expectedRootCause: t.expectedRootCause,
      minConfidence: t.minConfidence,
    })),
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/rca/calibrate
 * Runs all 6 calibration test scenarios and returns pass/fail results.
 */
router.post("/calibrate", async (req, res) => {
  try {
    const io = req.app.get("io");
    const metrics = await collectMetrics().catch(() => ({ cpu: 0, ram: 0, disk: 0 }));

    const results = await runAllTests({ metrics, emitIo: io });
    res.json(results);
  } catch (e) {
    console.error("[rca] calibrate error:", e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/rca/evidence/:query
 * Search M6 memory for historical incident evidence.
 */
router.get("/evidence/:query", async (req, res) => {
  try {
    const topK = Number(req.query.top_k) || 5;
    const results = await rcaEngine.searchEvidence(req.params.query, topK);
    res.json({ query: req.params.query, results, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
