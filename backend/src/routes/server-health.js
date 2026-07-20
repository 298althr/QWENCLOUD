// backend/src/routes/server-health.js
// GET /api/health/server — server health summary (CPU/RAM/Disk/Uptime)
// GET /api/health/server/cpu — top 10 CPU-consuming processes
// GET /api/health/server/ram — RAM breakdown (used, available, buff/cache, per-process)
// GET /api/health/server/disk — disk usage per mount point with largest directories

const express = require("express");
const router = express.Router();
const si = require("systeminformation");
const { client: redisClient, connect: redisConnect } = require("../db/redis");
const { get_server_health } = require("../qwen/toolExecutor");

async function getCachedTelemetry(key, fallback) {
  try {
    await redisConnect();
    const cached = await redisClient.get(`althr:telemetry:${key}`);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    console.warn("[server-health] redis read failed:", e.message);
  }
  const data = await fallback();
  try {
    await redisConnect();
    await redisClient.setEx(`althr:telemetry:${key}`, 300, JSON.stringify(data));
  } catch {}
  return data;
}

router.get("/", async (req, res) => {
  try {
    const h = await get_server_health();
    const fmtUptime = (s) => {
      const d = Math.floor(s / 86400);
      const hr = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      return `${d}d ${hr}h ${m}m`;
    };
    res.json({ ...h, uptime: fmtUptime(h.uptime) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/cpu", async (req, res) => {
  try {
    const data = await getCachedTelemetry("cpu", async () => {
      const [load, procs] = await Promise.all([
        si.currentLoad(),
        si.processes().catch(() => ({ list: [] })),
      ]);
      const top = (procs.list || [])
        .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
        .slice(0, 10)
        .map((p) => ({
          pid: p.pid,
          name: p.name,
          cpu: Number((p.cpu || 0).toFixed(2)),
          mem: Number((p.mem || 0).toFixed(2)),
          command: p.command || p.name,
        }));
      return {
        cpu_overall: Number(load.currentLoad.toFixed(2)),
        cpu_cores: load.cpus ? load.cpus.map((c) => Number((c.load || 0).toFixed(2))) : [],
        top_processes: top,
      };
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/ram", async (req, res) => {
  try {
    const data = await getCachedTelemetry("ram", async () => {
      const [mem, procs] = await Promise.all([
        si.mem(),
        si.processes().catch(() => ({ list: [] })),
      ]);
      const used = mem.total - (mem.available || mem.free);
      const buffCache = mem.used - used;
      const top = (procs.list || [])
        .sort((a, b) => (b.mem || 0) - (a.mem || 0))
        .slice(0, 20)
        .map((p) => ({
          pid: p.pid,
          name: p.name,
          mem_percent: Number((p.mem || 0).toFixed(2)),
          mem_mb: Math.round(((p.mem || 0) / 100) * (mem.total / 1024 / 1024)),
          cpu: Number((p.cpu || 0).toFixed(2)),
          command: p.command || p.name,
        }));
      return {
        total_mb: Math.round(mem.total / 1024 / 1024),
        used_mb: Math.round(used / 1024 / 1024),
        available_mb: Math.round((mem.available || mem.free) / 1024 / 1024),
        buff_cache_mb: Math.round(buffCache / 1024 / 1024),
        used_percent: Number(((used / mem.total) * 100).toFixed(2)),
        available_percent: Number((((mem.available || mem.free) / mem.total) * 100).toFixed(2)),
        swap_total_mb: Math.round((mem.swaptotal || 0) / 1024 / 1024),
        swap_used_mb: Math.round((mem.swapused || 0) / 1024 / 1024),
        top_processes: top,
      };
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/disk", async (req, res) => {
  try {
    const data = await getCachedTelemetry("disk", async () => {
      const [fsSize] = await Promise.all([si.fsSize()]);
      const mounts = (fsSize || []).map((fs) => ({
        fs: fs.fs,
        mount: fs.mount,
        size_gb: Number((fs.size / 1024 / 1024 / 1024).toFixed(2)),
        used_gb: Number((fs.used / 1024 / 1024 / 1024).toFixed(2)),
        available_gb: Number(((fs.size - fs.used) / 1024 / 1024 / 1024).toFixed(2)),
        percent: Number((fs.use || 0).toFixed(2)),
      }));
      return {
        mounts,
        total_size_gb: Number(mounts.reduce((s, m) => s + m.size_gb, 0).toFixed(2)),
        total_used_gb: Number(mounts.reduce((s, m) => s + m.used_gb, 0).toFixed(2)),
        total_available_gb: Number(mounts.reduce((s, m) => s + m.available_gb, 0).toFixed(2)),
      };
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
