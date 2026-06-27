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

module.exports = router;
