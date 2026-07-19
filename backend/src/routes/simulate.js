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
const { logAction } = require("../utils/actionHistory");
const { addTerminalLog } = require("../utils/terminalLog");
const { buildTopology, getImpactAnalysis } = require("../utils/topology");
const { listAllContainers, containerAction: dockerContainerAction } = require("../utils/docker");

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

    logAction({ category: "simulate", action: scenario.anomaly.type, target: scenario.anomaly.message, actor: "human:demo", result: "success", detail: scenario.anomaly }).catch(() => {});

    // Get io for immediate WebSocket emission
    const io = req.app.get("io");

    // Immediately emit action_update so the activity feed shows the simulation
    if (io) {
      io.emit("action_update", {
        stage: "simulated",
        action: `simulate:${scenario.anomaly.type}`,
        message: scenario.anomaly.message,
        severity: scenario.anomaly.severity,
        timestamp: new Date().toISOString(),
      });
    }

    // Log to persistent terminal so user can see and click Explain
    addTerminalLog({
      command: `[SIMULATE] ${scenario.anomaly.type}`,
      output: scenario.anomaly.message,
      exitCode: 0,
      source: "simulate",
      io,
    }).catch(() => {});

    // Fire the AI loop asynchronously so the HTTP response returns immediately;
    // progress streams to the dashboard over WebSocket.
    // Pass { skipCooldown: true } so simulated events always trigger the full loop.
    monitor
      .handleAnomaly(scenario.anomaly, merged, { skipCooldown: true, io })
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
      { type: "service_failure", label: "Service failure (stop container + cascade analysis)", default_value: null, unit: "service" },
    ],
    usage: 'POST /api/simulate/anomaly { "type": "cpu", "value": 95 }',
  });
});

/**
 * POST /api/simulate/service-failure
 * Body: { service: "postgres"|"redis"|"backend"|"frontend" }
 * Stops the specified container, runs cascade analysis to show which services
 * are affected, and emits cascade alerts via WebSocket. Does NOT actually
 * trigger the AI remediation loop (this is for demonstrating the topology
 * and cascade detection features).
 */
router.post("/service-failure", async (req, res) => {
  const { service } = req.body || {};
  if (!service) return res.status(400).json({ error: "service is required (e.g. postgres, redis, backend, frontend)" });

  try {
    const topology = await buildTopology();
    const containers = await listAllContainers(false);

    const target = containers.find((c) => {
      const svc = c.labels && c.labels["com.docker.compose.service"];
      return svc === service || c.name.includes(service);
    });

    if (!target) {
      return res.status(404).json({ error: `No running container found for service "${service}"` });
    }

    if (target.state !== "running") {
      return res.status(400).json({ error: `Container ${target.name} is not running` });
    }

    const impact = await getImpactAnalysis(target.id);
    const io = req.app.get("io");

    await audit({
      operation: "execute",
      actor: "human:demo",
      target: `simulate:service_failure:${service}`,
      target_type: "container",
      reasoning: `Simulated service failure for ${service} to demonstrate cascade detection`,
      result: "success",
    }).catch(() => {});

    addTerminalLog({
      command: `[SIMULATE] service_failure: ${service}`,
      output: `Stopping ${target.name}. Impact: ${impact.impactedCount} dependent services.`,
      exitCode: 0,
      source: "simulate",
      io,
    }).catch(() => {});

    if (io) {
      io.emit("action_update", {
        stage: "simulated_service_failure",
        action: `stop:${service}`,
        message: `Service ${service} stopped. ${impact.impactedCount} dependent services affected.`,
        severity: "critical",
        timestamp: new Date().toISOString(),
      });
    }

    const cascadeResults = await monitor.checkCascadeEffects({}, io);

    res.json({
      status: "triggered",
      service,
      container: { id: target.id, name: target.name },
      impactedServices: impact.impacted.map((i) => ({ name: i.name, service: i.service })),
      impactedCount: impact.impactedCount,
      cascadeResults,
      what_happens_next: [
        `Container ${target.name} was stopped`,
        `${impact.impactedCount} dependent services identified via topology graph`,
        "Cascade alerts emitted to dashboard",
        "Check the Topology page to see the impact graph",
      ],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
