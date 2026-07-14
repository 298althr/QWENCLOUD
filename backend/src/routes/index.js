// backend/src/routes/index.js
// Aggregator for all API route modules.

const express = require("express");
const router = express.Router();
const { pool } = require("../db/pool");
const { getTokenUsage } = require("../qwen/client");
const { getCacheStats, getOptimizationStats } = require("../qwen/prompt-optimizer");

router.get("/", (req, res) => res.json({ name: "ALTHR Autopilot API", version: "0.1.0" }));

// Token usage monitoring endpoint
router.get("/token-usage", (req, res) => {
  const usage = getTokenUsage();
  const summary = {
    totalModels: Object.keys(usage).length,
    models: Object.entries(usage).map(([model, stats]) => ({
      model,
      used: stats.used,
      total: stats.total,
      remaining: stats.remaining,
      percentUsed: ((stats.used / stats.total) * 100).toFixed(1),
      status: stats.remaining < 50000 ? 'critical' : stats.remaining < 200000 ? 'warning' : 'healthy'
    })).sort((a, b) => a.remaining - b.remaining) // Sort by remaining tokens ascending
  };
  res.json(summary);
});

// Prompt optimization statistics endpoint
router.get("/prompt-optimization", (req, res) => {
  const cacheStats = getCacheStats();
  const optStats = getOptimizationStats();
  res.json({
    cache: cacheStats,
    optimization: optStats,
    timestamp: new Date().toISOString()
  });
});

// SOS Kernel Status (read-only)
router.get("/kernel/status", async (req, res) => {
  const status = {
    usms: { initialized: false, objects: 0 },
    ueb: { initialized: false, events: 0 },
    ksr: { initialized: false, services: 0 },
    digital_twin: { initialized: false, twins: 0 },
    simulation_broker: { initialized: false, simulations: 0 },
    walk_forward_validator: { initialized: false, predictions: 0 },
    workflow_engine: { initialized: false, workflows: 0 },
    trust_calibration: { initialized: false, sources: 0 },
    optimization_engine: { initialized: false, optimizations: 0 },
    timestamp: new Date().toISOString()
  };
  
  try {
    // USMS status
    const usmsResult = await pool.query("SELECT COUNT(*) as count FROM usms_objects").catch(() => ({ rows: [{ count: 0 }] }));
    status.usms = { initialized: true, objects: parseInt(usmsResult.rows[0].count) };
    
    // UEB status
    const uebResult = await pool.query("SELECT COUNT(*) as count FROM ueb_events").catch(() => ({ rows: [{ count: 0 }] }));
    status.ueb = { initialized: true, events: parseInt(uebResult.rows[0].count) };
    
    // KSR status
    const ksrResult = await pool.query("SELECT COUNT(*) as count FROM ksr_services").catch(() => ({ rows: [{ count: 0 }] }));
    status.ksr = { initialized: true, services: parseInt(ksrResult.rows[0].count) };
    
    // Digital Twin status
    const twinResult = await pool.query("SELECT COUNT(*) as count FROM digital_twins").catch(() => ({ rows: [{ count: 0 }] }));
    status.digital_twin = { initialized: true, twins: parseInt(twinResult.rows[0].count) };
    
    // Simulation Broker status
    const simResult = await pool.query("SELECT COUNT(*) as count FROM simulation_results").catch(() => ({ rows: [{ count: 0 }] }));
    status.simulation_broker = { initialized: true, simulations: parseInt(simResult.rows[0].count) };
    
    // Walk-Forward Validator status
    const wfResult = await pool.query("SELECT COUNT(*) as count FROM wf_predictions").catch(() => ({ rows: [{ count: 0 }] }));
    status.walk_forward_validator = { initialized: true, predictions: parseInt(wfResult.rows[0].count) };
    
    // Workflow Engine status
    const workflowResult = await pool.query("SELECT COUNT(*) as count FROM workflows").catch(() => ({ rows: [{ count: 0 }] }));
    status.workflow_engine = { initialized: true, workflows: parseInt(workflowResult.rows[0].count) };
    
    // Trust Calibration status
    const trustResult = await pool.query("SELECT COUNT(*) as count FROM trust_scores").catch(() => ({ rows: [{ count: 0 }] }));
    status.trust_calibration = { initialized: true, sources: parseInt(trustResult.rows[0].count) };
    
    // Optimization Engine status
    const optResult = await pool.query("SELECT COUNT(*) as count FROM optimization_recommendations").catch(() => ({ rows: [{ count: 0 }] }));
    status.optimization_engine = { initialized: true, optimizations: parseInt(optResult.rows[0].count) };
  } catch (e) {
    console.warn("[kernel/status] Failed to query SOS status:", e.message);
  }
  
  res.json(status);
});

// Day 3 routes
router.use("/agent", require("./agent"));
router.use("/approvals", require("./approvals"));
router.use("/audit", require("./audit"));
router.use("/health/server", require("./server-health"));

// Day 4 routes
router.use("/memory", require("./memory"));

// Day 5 routes
router.use("/analytics", require("./analytics"));
router.use("/learning", require("./learning"));

// Day 6 routes
router.use("/processes", require("./processes"));
router.use("/ports", require("./ports"));
router.use("/docker", require("./docker"));

// Day 7 routes
router.use("/command", require("./command"));
router.use("/file", require("./file"));
router.use("/deployments", require("./deploy"));
router.use("/security", require("./security"));

// Decision intelligence routes
router.use("/decision", require("./decision"));

// AI Command Execution routes
router.use("/ai-commands", require("./ai-commands"));

// Load / anomaly simulation routes (demo + AI calibration)
router.use("/simulate", require("./simulate"));

// MCP (Model Context Protocol) routes
try {
  const mcp = require("../mcp/server");
  router.use("/mcp", mcp.createMCPRouter());
} catch (e) {
  if (e.code !== "MODULE_NOT_FOUND") console.warn("[mcp] mount failed:", e.message);
}

// Remote SSH host management
router.use("/remote", require("./remote"));

// Settings
router.use("/settings", require("./settings"));

// Terminal logs (persistent)
router.use("/terminal", require("./terminal"));

// Chat history (persistent AI conversation)
router.use("/chat-history", require("./chat-history"));

// Monitor kill switch
router.use("/monitor", require("./monitor").router);

module.exports = router;
