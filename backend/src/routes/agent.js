// backend/src/routes/agent.js
// POST /api/agent — NL message -> full pipeline (Qwen -> Certainty -> SAF -> execute/approve)

const express = require("express");
const router = express.Router();
const { handleAgentMessage } = require("../pipeline/orchestrator");
const { getServerHealth } = require("../qwen/toolExecutor");

router.post("/", async (req, res) => {
  const { message } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message is required" });
  }
  const io = req.app.get("io");
  const socketId = req.body.socketId || null;
  const user = req.user || { username: "agent", role: "admin" };

  try {
    // Attach current server state to give the pipeline context
    let serverState = {};
    try { serverState = await getServerHealth(); } catch { serverState = {}; }

    const result = await handleAgentMessage({
      message,
      serverState,
      user,
      io,
      socketId,
      source: "dashboard",
    });
    res.json(result);
  } catch (e) {
    console.error("[agent] error:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
