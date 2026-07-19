const express = require("express");
const router = express.Router();
const {
  listAllContainers,
  inspectContainer,
  getContainerLogs,
  getContainerStats,
  execInContainer,
  containerAction,
  batchAction,
  listImages,
} = require("../utils/docker");
const { buildTopology, getImpactAnalysis } = require("../utils/topology");
const monitor = require("../monitors/monitor");
const { logAction } = require("../utils/actionHistory");

router.get("/topology", async (req, res) => {
  try {
    const topology = await buildTopology();
    res.json(topology);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/topology/impact/:id", async (req, res) => {
  try {
    const impact = await getImpactAnalysis(req.params.id);
    res.json(impact);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/containers", async (req, res) => {
  try {
    const all = req.query.all === "true";
    const containers = await listAllContainers(all);
    res.json({ containers, count: containers.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/containers/:id/inspect", async (req, res) => {
  try {
    const info = await inspectContainer(req.params.id);
    res.json(info);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/containers/:id/logs", async (req, res) => {
  try {
    const tail = parseInt(req.query.tail) || 100;
    const logStream = await getContainerLogs(req.params.id, { tail, follow: false });
    let output = "";
    if (Buffer.isBuffer(logStream)) {
      output = logStream.toString();
    } else if (typeof logStream === "string") {
      output = logStream;
    } else {
      output = logStream.toString();
    }
    const clean = output
      .split("\n")
      .map((line) => {
        if (line.length > 8 && line.charCodeAt(0) === 1) {
          return line.substring(8);
        }
        return line;
      })
      .join("\n")
      .trim();
    res.json({ logs: clean });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/containers/:id/stats", async (req, res) => {
  try {
    const stats = await getContainerStats(req.params.id, { stream: false });
    const memUsage = stats.memory_stats.usage || 0;
    const memLimit = stats.memory_stats.limit || 0;
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = systemDelta > 0 ? ((cpuDelta / systemDelta) * 100).toFixed(2) : "0.00";
    res.json({
      cpuPercent: parseFloat(cpuPercent),
      memUsageMB: Math.round(memUsage / 1024 / 1024),
      memLimitMB: Math.round(memLimit / 1024 / 1024),
      memPercent: memLimit > 0 ? Number(((memUsage / memLimit) * 100).toFixed(2)) : 0,
      networkRx: stats.networks ? Math.round(stats.networks.eth0.rx_bytes / 1024) : 0,
      networkTx: stats.networks ? Math.round(stats.networks.eth0.tx_bytes / 1024) : 0,
      raw: stats,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/containers/:id/exec", async (req, res) => {
  try {
    const { command } = req.body || {};
    if (!command) return res.status(400).json({ error: "command is required" });
    const result = await execInContainer(req.params.id, command);
    logAction({ category: "container", action: "exec", target: `${req.params.id}:${command}`, actor: req.user?.username || "api", result: result.exitCode === 0 ? "success" : "failure", detail: result }).catch(() => {});
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/containers/:id/action", async (req, res) => {
  try {
    const { action } = req.body || {};
    if (!["stop", "start", "restart", "remove"].includes(action)) {
      return res.status(400).json({ error: "action must be stop, start, restart, or remove" });
    }
    const result = await containerAction(req.params.id, action);
    logAction({ category: "container", action, target: req.params.id, actor: req.user?.username || "api", result: result.ok ? "success" : "failure", detail: result }).catch(() => {});
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/containers/batch", async (req, res) => {
  try {
    const { ids, action } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required" });
    }
    if (!["stop", "start", "restart"].includes(action)) {
      return res.status(400).json({ error: "action must be stop, start, or restart" });
    }
    const result = await batchAction(ids, action);
    logAction({ category: "container", action: `batch_${action}`, target: ids.join(","), actor: req.user?.username || "api", result: "success", detail: result }).catch(() => {});
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/service-health", async (req, res) => {
  try {
    const health = await monitor.getServiceHealth();
    res.json(health);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/cascade-check", async (req, res) => {
  try {
    const io = req.app.get("io");
    const results = await monitor.checkCascadeEffects({}, io);
    res.json({ cascadeResults: results, count: results.length, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/images", async (req, res) => {
  try {
    const images = await listImages();
    res.json({ images, count: images.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
