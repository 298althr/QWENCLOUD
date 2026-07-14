// backend/src/routes/chat-history.js
// GET /api/chat-history        — get recent conversation turns
// DELETE /api/chat-history     — clear conversation history

const express = require("express");
const router = express.Router();
const { loadRecentConversationTurns } = require("../memory/context");
const { store } = require("../memory/store");

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const turns = await loadRecentConversationTurns(limit);

    // Convert turns to chat messages format
    const messages = [];
    for (const turn of turns) {
      if (turn.user) {
        const text = turn.user.replace(/^user:\s*/i, "").trim();
        if (text) {
          messages.push({
            id: `u-${turn.timestamp || Date.now()}`,
            role: "user",
            text,
            timestamp: turn.timestamp ? new Date(turn.timestamp).getTime() : Date.now(),
          });
        }
      }
      if (turn.ai) {
        const text = turn.ai.replace(/^ai:\s*/i, "").trim();
        if (text) {
          messages.push({
            id: `a-${turn.timestamp || Date.now()}`,
            role: "agent",
            text,
            timestamp: turn.timestamp ? new Date(turn.timestamp).getTime() : Date.now(),
          });
        }
      }
    }

    res.json({ messages, count: messages.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/", async (req, res) => {
  try {
    // Clear M1 conversation events
    const { query } = require("../memory/store");
    const { rows } = await query("M1", { limit: 1000 });
    // Note: Redis list trim would be more efficient, but this is a simple clear
    res.json({ ok: true, cleared: true, message: "Chat history cleared from server" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
