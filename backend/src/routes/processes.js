// backend/src/routes/processes.js
// GET /api/processes — list running processes

const express = require("express");
const router = express.Router();
const { executeTool } = require("../qwen/toolExecutor");

router.get("/", async (req, res) => {
  try {
    const sortBy = ["cpu", "mem", "pid"].includes(req.query.sort_by) ? req.query.sort_by : "cpu";
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const result = await executeTool("list_processes", { sort_by: sortBy, limit });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
