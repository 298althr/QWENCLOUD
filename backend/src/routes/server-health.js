// backend/src/routes/server-health.js
// GET /api/health/server — server health summary (CPU/RAM/Disk/Uptime)

const express = require("express");
const router = express.Router();
const { getServerHealth } = require("../qwen/toolExecutor");

router.get("/", async (req, res) => {
  try {
    const h = await getServerHealth();
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

module.exports = router;
