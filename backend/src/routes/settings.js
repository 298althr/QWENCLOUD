// backend/src/routes/settings.js
// Settings endpoint — returns agent configuration and thresholds.
// In production, these would be persisted in a settings table.

const express = require("express");
const router = express.Router();
const tokenTracker = require("../qwen/tokenTracker");
const guardrails = require("../qwen/guardrails");
const sandbox = require("../utils/sandbox");
const { validate, schemas } = require("../middleware/validate");

// Default settings (env-driven in production)
const defaultSettings = {
  confidence_threshold: Number(process.env.AUTO_EXECUTE_THRESHOLD) || 0.85,
  model: process.env.QWEN_MODEL || "qwen3.7-plus",
  monitoring_interval: Number(process.env.MONITORING_INTERVAL) || 30,
  auto_execute: process.env.AUTO_EXECUTE !== "false",
  saf_enabled: true,
  hitl_enabled: true,
  dre_max_api_calls: 10,
  drev_cr_threshold: 0.1,
  crds_veto_threshold: -0.8,
};

// GET /api/settings
router.get("/", (req, res) => {
  res.json(defaultSettings);
});

// POST /api/settings — update settings (in-memory, not persisted)
let currentSettings = { ...defaultSettings };
router.post("/", (req, res) => {
  const { confidence_threshold, model, monitoring_interval, auto_execute } = req.body || {};
  if (confidence_threshold != null) currentSettings.confidence_threshold = confidence_threshold;
  if (model) currentSettings.model = model;
  if (monitoring_interval != null) currentSettings.monitoring_interval = monitoring_interval;
  if (auto_execute != null) currentSettings.auto_execute = auto_execute;
  res.json({ saved: true, settings: currentSettings });
});

// GET /api/settings/usage — AI token usage and cost tracking
router.get("/usage", (req, res) => {
  const window = req.query.window || "day";
  const summary = tokenTracker.getSummary(window);
  const guardrailStatus = guardrails.getStatus();
  res.json({ ...summary, guardrails: guardrailStatus });
});

// GET /api/settings/usage/calls — recent individual API calls
router.get("/usage/calls", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  res.json(tokenTracker.getRecentCalls(limit));
});

// POST /api/settings/budgets — update daily/monthly budget limits
router.post("/budgets", (req, res) => {
  const { daily, monthly } = req.body || {};
  tokenTracker.setBudgets({ daily, monthly });
  res.json({ saved: true, budgets: tokenTracker.getSummary("all").budgets });
});

// POST /api/settings/guardrails/reset — reset circuit breaker and rate limits
router.post("/guardrails/reset", (req, res) => {
  guardrails.reset();
  res.json({ saved: true, status: guardrails.getStatus() });
});

// GET /api/settings/kill-switch — get kill switch status
router.get("/kill-switch", (req, res) => {
  res.json(tokenTracker.getKillSwitchStatus());
});

// POST /api/settings/kill-switch — trip or reset the kill switch
router.post("/kill-switch", validate({ body: schemas.killSwitch }), (req, res) => {
  const { action, reason } = req.body;
  if (action === "trip") {
    tokenTracker.tripKillSwitch(reason || "Manual trip via API");
    res.json({ saved: true, status: tokenTracker.getKillSwitchStatus() });
  } else {
    tokenTracker.resetKillSwitch();
    res.json({ saved: true, status: tokenTracker.getKillSwitchStatus() });
  }
});

// GET /api/settings/sandbox-mode — get sandbox mode status
router.get("/sandbox-mode", (req, res) => {
  res.json(sandbox.getStatus());
});

// POST /api/settings/sandbox-mode — toggle sandbox mode on/off
router.post("/sandbox-mode", (req, res) => {
  const { active } = req.body || {};
  const status = sandbox.setMode(active);
  res.json({ saved: true, status });
});

// POST /api/settings/sandbox-reset — wipe sandbox volume clean
router.post("/sandbox-reset", async (req, res) => {
  const result = await sandbox.resetSandboxVolume();
  if (result.ok) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

module.exports = router;
