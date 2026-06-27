// backend/src/routes/ports.js
// GET /api/ports — list listening ports

const express = require("express");
const router = express.Router();
const { executeTool } = require("../qwen/toolExecutor");

router.get("/", async (req, res) => {
  try {
    const result = await executeTool("check_ports", {});
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
