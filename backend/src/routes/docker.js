// backend/src/routes/docker.js
// GET /api/docker/containers — list Docker containers

const express = require("express");
const router = express.Router();
const { executeTool } = require("../qwen/toolExecutor");

router.get("/containers", async (req, res) => {
  try {
    const result = await executeTool("list_containers", {});
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/containers/:id/action", async (req, res) => {
  const { id } = req.params;
  const { action } = req.body || {};
  if (!["stop", "start", "restart"].includes(action)) {
    return res.status(400).json({ error: "action must be stop, start, or restart" });
  }
  try {
    const result = await executeTool("container_action", { action, container_id: id });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
