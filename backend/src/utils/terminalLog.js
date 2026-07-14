// backend/src/utils/terminalLog.js
// Shared utility to persist terminal log entries and emit via WebSocket.
// Used by: command route, simulate route, monitor, orchestrator.

const { client: redisClient } = require("../db/redis");

const LOG_KEY = "terminal:logs";
const MAX_LOGS = 2000;

/**
 * Add a terminal log entry to Redis and emit via WebSocket.
 * @param {object} opts
 * @param {string} opts.command - The command or action description
 * @param {string} opts.output - The output text
 * @param {number|null} opts.exitCode - Exit code
 * @param {string} [opts.source] - "user", "ai", "system", "simulate"
 * @param {object} [opts.io] - Socket.io server for WebSocket emit
 * @returns {Promise<object>} The log entry
 */
async function addTerminalLog({ command, output = "", exitCode = null, source = "system", io = null }) {
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    command,
    output: String(output || "").slice(0, 5000),
    exitCode,
    source,
    timestamp: Date.now(),
    isoTime: new Date().toISOString(),
  };

  try {
    if (redisClient.isOpen) {
      await redisClient.rPush(LOG_KEY, JSON.stringify(entry));
      const len = await redisClient.lLen(LOG_KEY);
      if (len > MAX_LOGS) {
        await redisClient.lTrim(LOG_KEY, len - MAX_LOGS, -1);
      }
    }
  } catch (e) {
    console.warn("[terminalLog] Redis save failed:", e.message);
  }

  if (io) {
    io.emit("terminal_log", entry);
  }

  return entry;
}

module.exports = { addTerminalLog };
