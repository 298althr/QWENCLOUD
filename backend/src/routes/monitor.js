// backend/src/routes/monitor.js
// AI kill switch + autonomous loop control.

const express = require("express");
const router = express.Router();
const monitor = require("../monitors/monitor");
const { logAction } = require("../utils/actionHistory");

let monitorEnabled = true;

router.get("/status", (req, res) => {
  res.json({ enabled: monitorEnabled, running: monitor.isRunning?.() || true });
});

router.post("/stop", (req, res) => {
  monitorEnabled = false;
  monitor.stop();
  logAction({ category: "monitor", action: "stop", target: "monitor", actor: req.user?.username || "api", result: "success" }).catch(() => {});
  res.json({ enabled: false, message: "Autonomous monitor stopped." });
});

router.post("/start", (req, res) => {
  monitorEnabled = true;
  monitor.start?.();
  logAction({ category: "monitor", action: "start", target: "monitor", actor: req.user?.username || "api", result: "success" }).catch(() => {});
  res.json({ enabled: true, message: "Autonomous monitor started." });
});

router.get("/history", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 60, 1000);
    const metric = req.query.metric || "all";
    const rows = await monitor.getMetricsHistory(limit, metric);
    res.json({ metrics: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/actions", async (req, res) => {
  try {
    const { getActionHistory } = require("../utils/actionHistory");
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const category = req.query.category;
    const rows = await getActionHistory({ category, limit });
    res.json({ actions: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = { router, isMonitorEnabled: () => monitorEnabled };
