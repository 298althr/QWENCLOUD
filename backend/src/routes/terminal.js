// backend/src/routes/terminal.js
// GET /api/terminal/logs — return persisted terminal log entries
// POST /api/terminal/logs — add a terminal log entry (also emits via WebSocket)

const express = require("express");
const router = express.Router();
const { client: redisClient } = require("../db/redis");

const LOG_KEY = "terminal:logs";
const MAX_LOGS = 2000;

// GET /api/terminal/logs?limit=100&offset=0
router.get("/logs", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, MAX_LOGS);
  const offset = parseInt(req.query.offset) || 0;

  try {
    if (!redisClient.isOpen) {
      return res.json({ logs: [], count: 0, note: "Redis not connected" });
    }

    // Get total count
    const total = await redisClient.lLen(LOG_KEY);
    // Get logs from the end (most recent first), then reverse for chronological order
    const rawLogs = await redisClient.lRange(LOG_KEY, Math.max(0, total - offset - limit), total - offset - 1);
    const logs = rawLogs.map((s) => {
      try { return JSON.parse(s); } catch { return { command: s, output: "", exitCode: null, timestamp: 0 }; }
    });

    res.json({ logs, count: total });
  } catch (e) {
    res.status(500).json({ error: e.message, logs: [], count: 0 });
  }
});

// POST /api/terminal/logs — add a log entry
// Body: { command, output, exitCode, source, timestamp }
router.post("/logs", async (req, res) => {
  const { command, output, exitCode, source } = req.body || {};
  if (!command) return res.status(400).json({ error: "command is required" });

  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    command,
    output: output || "",
    exitCode: exitCode ?? null,
    source: source || "user",
    timestamp: Date.now(),
    isoTime: new Date().toISOString(),
  };

  try {
    if (redisClient.isOpen) {
      await redisClient.rPush(LOG_KEY, JSON.stringify(entry));
      // Trim to max length
      const len = await redisClient.lLen(LOG_KEY);
      if (len > MAX_LOGS) {
        await redisClient.lTrim(LOG_KEY, len - MAX_LOGS, -1);
      }
    }
  } catch (e) {
    console.warn("[terminal] Redis log save failed:", e.message);
  }

  // Emit to all connected WebSocket clients
  const io = req.app.get("io");
  if (io) {
    io.emit("terminal_log", entry);
  }

  res.json({ status: "ok", id: entry.id });
});

// DELETE /api/terminal/logs — clear all logs (admin only)
router.delete("/logs", async (req, res) => {
  try {
    if (redisClient.isOpen) {
      await redisClient.del(LOG_KEY);
    }
    res.json({ status: "cleared" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
