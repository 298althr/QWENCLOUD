// backend/src/server.js
// ALTHR Autopilot — Express + Socket.io entry point
require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server } = require("socket.io");

const { pool } = require("./db/pool");
const { connect: connectRedis, client: redisClient } = require("./db/redis");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CORS_ORIGIN || "*", methods: ["GET", "POST"] },
});

// ---- Middleware ----
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// Make io available to route handlers
app.set("io", io);

// ---- Health (no auth) ----
app.get("/api/health", async (req, res) => {
  const health = { status: "ok", timestamp: new Date().toISOString() };
  try {
    const pgOk = await pool.query("SELECT 1").then(() => true).catch(() => false);
    const redisOk = redisClient.isOpen ? await redisClient.ping().then(() => true).catch(() => false) : false;
    health.services = { postgres: pgOk ? "ok" : "down", redis: redisOk ? "ok" : "down" };
  } catch {
    health.services = { postgres: "down", redis: "down" };
  }
  res.json(health);
});

// ---- Routes (mounted incrementally as built) ----
try {
  app.use("/api", require("./routes/index"));
} catch (err) {
  // routes/index may not yet exist during early scaffold; ignore.
  if (err.code !== "MODULE_NOT_FOUND") throw err;
}

// ---- WebSocket ----
const { handleAgentMessage } = require("./pipeline/orchestrator");
const { approveAction, rejectAction } = require("./pipeline/approvals");
const { getServerHealth } = require("./qwen/toolExecutor");
const monitor = require("./monitors/monitor");

io.on("connection", (socket) => {
  // eslint-disable-next-line no-console
  console.log("[ws] client connected:", socket.id);
  socket.on("disconnect", () => console.log("[ws] disconnected:", socket.id));

  // Client sends an NL agent message over WebSocket; reasoning is streamed back.
  socket.on("agent_message", async ({ message }) => {
    if (!message) return;
    try {
      let serverState = {};
      try { serverState = await getServerHealth(); } catch { serverState = {}; }
      await handleAgentMessage({
        message,
        serverState,
        user: { username: "ws-client", role: "admin" },
        io,
        socketId: socket.id,
        source: "dashboard",
      });
    } catch (e) {
      socket.emit("action_update", { stage: "error", error: e.message });
    }
  });

  socket.on("approve_action", async ({ action_id }) => {
    try {
      const result = await approveAction({ action_id, approver: "human:ws-client", io });
      socket.emit("action_update", { stage: "approved", ...result });
    } catch (e) {
      socket.emit("action_update", { stage: "error", error: e.message });
    }
  });

  socket.on("reject_action", async ({ action_id, reason }) => {
    try {
      const result = await rejectAction({ action_id, reason: reason || "", approver: "human:ws-client", io });
      socket.emit("action_update", { stage: "rejected", ...result });
    } catch (e) {
      socket.emit("action_update", { stage: "error", error: e.message });
    }
  });

  socket.on("cancel_action", ({ action_id }) => {
    socket.emit("action_update", { stage: "cancelled", action_id });
  });

  // Day 6: monitoring control events
  socket.on("monitor:start", () => {
    monitor.start(io);
    socket.emit("monitor:status", { running: true });
  });
  socket.on("monitor:stop", () => {
    monitor.stop();
    socket.emit("monitor:status", { running: false });
  });
  socket.on("monitor:tick", async () => {
    try {
      const metrics = await monitor.collectMetrics();
      socket.emit("server_metrics", metrics);
    } catch (e) {
      socket.emit("action_update", { stage: "error", error: e.message });
    }
  });
});

// ---- Boot ----
const PORT = process.env.PORT || 3000;

async function boot() {
  // Connect Redis (best-effort; not fatal if down on first boot)
  await connectRedis().catch((e) => console.warn("[redis] connect skipped:", e.message));

  // Start Telegram bot (only if token configured)
  try {
    require("./telegram/bot").start(io);
  } catch (e) {
    console.warn("[telegram] bot start skipped:", e.message);
  }

  // Start monitoring loop (unless explicitly disabled)
  if (process.env.MONITOR_DISABLE !== "true") {
    try {
      monitor.start(io);
    } catch (e) {
      console.warn("[monitor] start skipped:", e.message);
    }
  }

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] ALTHR Autopilot listening on :${PORT}`);
  });
}

boot().catch((err) => {
  console.error("[server] Boot failed:", err);
  process.exit(1);
});

module.exports = { app, server, io };
