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
io.on("connection", (socket) => {
  // eslint-disable-next-line no-console
  console.log("[ws] client connected:", socket.id);
  socket.on("disconnect", () => console.log("[ws] disconnected:", socket.id));
});

// ---- Boot ----
const PORT = process.env.PORT || 3000;

async function boot() {
  // Connect Redis (best-effort; not fatal if down on first boot)
  await connectRedis().catch((e) => console.warn("[redis] connect skipped:", e.message));

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
