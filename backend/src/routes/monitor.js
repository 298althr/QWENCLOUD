// backend/src/routes/monitor.js
// AI kill switch + autonomous loop control.

const express = require("express");
const router = express.Router();
const monitor = require("../monitors/monitor");

let monitorEnabled = true;

router.get("/status", (req, res) => {
  res.json({ enabled: monitorEnabled, running: monitor.isRunning?.() || true });
});

router.post("/stop", (req, res) => {
  monitorEnabled = false;
  monitor.stop();
  res.json({ enabled: false, message: "Autonomous monitor stopped." });
});

router.post("/start", (req, res) => {
  monitorEnabled = true;
  monitor.start?.();
  res.json({ enabled: true, message: "Autonomous monitor started." });
});

module.exports = { router, isMonitorEnabled: () => monitorEnabled };
