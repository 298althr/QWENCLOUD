// backend/src/routes/simulate.js
// Demo / calibration endpoints that let you simulate abnormal server conditions
// (high CPU, high RAM, disk pressure, port conflict) on demand so you can watch
// the AI's full autonomous loop react in seconds instead of waiting for a real
// incident.
//
// The injected anomaly is fed straight into the SAME code path the live monitor
// uses (monitor.handleAnomaly), which means it will:
//   1. Store the event in M1 (Raw Event memory)
//   2. Emit an anomaly_alert to every connected dashboard over WebSocket
//   3. Look up a known fix (SOP) in M3 — apply it directly if found
//   4. Otherwise run the Qwen diagnosis + 7-stage Certainty Pipeline
//   5. Pass the proposed action through the SAF safety framework
//   6. Auto-execute if confidence >= threshold AND risk is low, else request approval
//
// NOTE: these endpoints only INJECT a synthetic metric reading. They do not
// actually stress the physical host, so they are safe to run during a demo.

const express = require("express");
const router = express.Router();
const monitor = require("../monitors/monitor");
const { audit } = require("../utils/audit");

// Map a friendly scenario name to a synthetic anomaly + overridden metrics.
function buildScenario(type, value) {
  switch (type) {
    case "cpu":
    case "cpu_spike": {
      const cpu = value ?? 95;
      return {
        anomaly: {
          type: "cpu_spike",
          severity: "critical",
          message: `CPU at ${cpu}% (simulated sustained spike)`,
          data: { cpu, sustained_seconds: 320, simulated: true },
        },
        metricsOverride: { cpu, ram: 55, disk: 40 },
      };
    }
    case "ram":
    case "memory":
    case "ram_pressure": {
      const ram = value ?? 94;
      return {
        anomaly: {
          type: "ram_pressure",
          severity: "critical",
          message: `RAM at ${ram}% (simulated memory pressure)`,
          data: { ram, used_mb: Math.round((ram / 100) * 8192), total_mb: 8192, simulated: true },
        },
        metricsOverride: { cpu: 40, ram, disk: 40 },
      };
    }
    case "disk":
    case "disk_pressure": {
      const disk = value ?? 92;
      return {
        anomaly: {
          type: "disk_pressure",
          severity: "warning",
          message: `Disk at ${disk}% (simulated disk pressure)`,
          data: { disk, simulated: true },
        },
        metricsOverride: { cpu: 30, ram: 55, disk },
      };
    }
    case "port":
    case "port_conflict": {
      const port = value ?? 3000;
      return {
        anomaly: {
          type: "port_conflict",
          severity: "warning",
          message: `Port ${port}:tcp bound by 2 processes (simulated conflict)`,
          data: { port: `${port}:tcp`, count: 2, simulated: true },
        },
        metricsOverride: { cpu: 30, ram: 55, disk: 40 },
      };
    }
    default:
      return null;
  }
}

/**
 * POST /api/simulate/anomaly
 * Body: { type: "cpu"|"ram"|"disk"|"port", value?: number }
 * Injects a synthetic anomaly and triggers the AI autonomous loop.
 */
router.post("/anomaly", async (req, res) => {
  const { type = "cpu", value } = req.body || {};
  const scenario = buildScenario(type, value);
  if (!scenario) {
    return res.status(400).json({
      error: `Unknown scenario "${type}". Use one of: cpu, ram, disk, port.`,
    });
  }

  try {
    // Collect real metrics, then override the relevant fields so the AI sees a
    // realistic-but-abnormal snapshot.
    let metrics;
    try {
      metrics = await monitor.collectMetrics();
    } catch {
      metrics = { timestamp: new Date().toISOString(), processes: [], ports: [] };
    }
    const merged = { ...metrics, ...scenario.metricsOverride, simulated: true };

    // Audit is best-effort — never let a logging failure block the demo.
    await audit({
      operation: "execute",
      actor: "human:demo",
      target: `simulate:${scenario.anomaly.type}`,
      target_type: "command",
      reasoning: `Simulated ${scenario.anomaly.type} for AI calibration/demo`,
      result: "success",
    }).catch((e) => console.warn("[simulate] audit skipped:", e.message));

    // Fire the AI loop asynchronously so the HTTP response returns immediately;
    // progress streams to the dashboard over WebSocket.
    monitor
      .handleAnomaly(scenario.anomaly, merged)
      .catch((e) => console.error("[simulate] handleAnomaly failed:", e.message));

    res.json({
      status: "triggered",
      message: `Simulated ${scenario.anomaly.type}. Watch the Agent Console / Overview activity feed for the AI's diagnosis and response.`,
      anomaly: scenario.anomaly,
      metrics: scenario.metricsOverride,
      what_happens_next: [
        "Event stored in M1 (Raw Event memory)",
        "Dashboard receives a live anomaly alert",
        "AI checks memory for a known fix (SOP)",
        "If none, Qwen diagnoses the root cause and proposes a fix",
        "The fix is safety-checked (SAF) and either auto-applied or sent for your approval",
      ],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/simulate/scenarios
 * Lists the available simulation scenarios (handy for the UI / CLI).
 */
router.get("/scenarios", (req, res) => {
  res.json({
    scenarios: [
      { type: "cpu", label: "High CPU spike", default_value: 95, unit: "%" },
      { type: "ram", label: "Memory pressure", default_value: 94, unit: "%" },
      { type: "disk", label: "Disk pressure", default_value: 92, unit: "%" },
      { type: "port", label: "Port conflict", default_value: 3000, unit: "port" },
    ],
    usage: 'POST /api/simulate/anomaly { "type": "cpu", "value": 95 }',
  });
});

module.exports = router;
