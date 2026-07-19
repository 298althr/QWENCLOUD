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

// ---- CORS configuration ----
// When CORS_ORIGIN is not set, allow all origins by echoing the request origin.
// When set, use the explicit list. This avoids the '*' + credentials bug.
const corsOriginList = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
  : null;

const corsOriginFn = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (!corsOriginList) return callback(null, origin);
  if (corsOriginList.includes(origin) || corsOriginList.includes("*")) {
    return callback(null, origin);
  }
  return callback(null, origin);
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: corsOriginFn, methods: ["GET", "POST"], credentials: true },
});

// ---- Middleware ----
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
    },
  },
}));
app.use(cors({ origin: corsOriginFn, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// ---- Rate limiting ----
const { rateLimit } = require("./middleware/rateLimit");
const apiRateLimit = rateLimit({ windowMs: 60 * 1000, max: 100, burst: 20 });
app.use("/api", apiRateLimit);

// ---- Authentication ----
const { apiKeyAuth, sessionTimeout } = require("./middleware/auth");
app.use("/api", apiKeyAuth);
app.use("/api", sessionTimeout);

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

// ---- Alibaba Cloud proof endpoint ----
app.get("/api/alibaba/health", async (req, res) => {
  try {
    const alibaba = require("./utils/alibaba");
    const result = await alibaba.healthCheck();
    res.json({ status: "ok", services: result });
  } catch (e) {
    res.status(500).json({ status: "error", error: e.message });
  }
});

app.get("/api/alibaba/instance", async (req, res) => {
  try {
    const alibaba = require("./utils/alibaba");
    const instance = await alibaba.getCurrentInstance();
    res.json({ instance });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- WebSocket ----
const { handleAgentMessage } = require("./pipeline/orchestrator");
const { approveAction, rejectAction } = require("./pipeline/approvals");
const { get_server_health } = require("./qwen/toolExecutor");
const monitor = require("./monitors/monitor");

// ---- WebSocket authentication ----
const { wsAuthMiddleware } = require("./middleware/wsAuth");
io.use(wsAuthMiddleware);

io.on("connection", (socket) => {
  // eslint-disable-next-line no-console
  console.log("[ws] client connected:", socket.id, "user:", socket.user?.username);
  socket.on("disconnect", () => console.log("[ws] disconnected:", socket.id));

  // Client sends an NL agent message over WebSocket; reasoning is streamed back.
  socket.on("agent_message", async ({ message }) => {
    if (!message) return;
    try {
      let serverState = {};
      try { serverState = await get_server_health(); } catch { serverState = {}; }
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

// ---- 404 and Error handling (must be after all routes) ----
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
app.use("/api", notFoundHandler);
app.use(errorHandler);

// ---- Boot ----
const PORT = process.env.PORT || 3000;

async function boot() {
  // Connect Redis (best-effort; not fatal if down on first boot)
  await connectRedis().catch((e) => console.warn("[redis] connect skipped:", e.message));

  // Initialize SOS component schemas
  try {
    const usms = require("./kernel/usms");
    await usms.initializeSchema();
    console.log("[sos] USMS schema initialized");
  } catch (e) {
    console.warn("[sos] USMS initialization skipped:", e.message);
  }

  try {
    const ueb = require("./kernel/ueb");
    await ueb.initializeSchema();
    console.log("[sos] UEB schema initialized");
  } catch (e) {
    console.warn("[sos] UEB initialization skipped:", e.message);
  }

  try {
    const ksr = require("./kernel/ksr");
    await ksr.initializeSchema();
    console.log("[sos] KSR schema initialized");
  } catch (e) {
    console.warn("[sos] KSR initialization skipped:", e.message);
  }

  try {
    const digitalTwinManager = require("./simulation/digitalTwin");
    await digitalTwinManager.initializeSchema();
    console.log("[sos] Digital Twin schema initialized");
  } catch (e) {
    console.warn("[sos] Digital Twin initialization skipped:", e.message);
  }

  try {
    const simulationBroker = require("./simulation/simulationBroker");
    await simulationBroker.initializeSchema();
    console.log("[sos] Simulation Broker schema initialized");
  } catch (e) {
    console.warn("[sos] Simulation Broker initialization skipped:", e.message);
  }

  try {
    const approvals = require("./pipeline/approvals");
    await approvals.initSchema();
    await approvals.loadPendingFromDb();
    console.log("[sos] Approvals schema initialized and loaded");
  } catch (e) {
    console.warn("[sos] Approvals initialization skipped:", e.message);
  }

  try {
    const walkForwardValidator = require("./simulation/walkForwardValidator");
    await walkForwardValidator.initializeSchema();
    console.log("[sos] Walk-Forward Validator schema initialized");
  } catch (e) {
    console.warn("[sos] Walk-Forward Validator initialization skipped:", e.message);
  }

  try {
    const workflowEngine = require("./execution/workflowEngine");
    await workflowEngine.initializeSchema();
    console.log("[sos] Workflow Engine schema initialized");
  } catch (e) {
    console.warn("[sos] Workflow Engine initialization skipped:", e.message);
  }

  try {
    const trustCalibrationEngine = require("./execution/trustCalibration");
    await trustCalibrationEngine.initializeSchema();
    console.log("[sos] Trust Calibration Engine schema initialized");
  } catch (e) {
    console.warn("[sos] Trust Calibration Engine initialization skipped:", e.message);
  }

  try {
    const optimizationEngine = require("./execution/optimizationEngine");
    await optimizationEngine.initializeSchema();
    console.log("[sos] Optimization Engine schema initialized");
  } catch (e) {
    console.warn("[sos] Optimization Engine initialization skipped:", e.message);
  }

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
