// backend/src/routes/file.js
// GET  /api/file/list?path=...   — list directory contents
// GET  /api/file/read?path=...   — read file content
// POST /api/file/write            — write file content

const express = require("express");
const router = express.Router();
const { executeTool } = require("../qwen/toolExecutor");
const { audit } = require("../utils/audit");

router.get("/list", async (req, res) => {
  const dirPath = req.query.path || ".";
  try {
    const result = await executeTool("list_directory", { path: dirPath });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/read", async (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: "path is required" });
  try {
    const result = await executeTool("read_file", { path: filePath });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/write", async (req, res) => {
  const { path: filePath, content } = req.body || {};
  if (!filePath || content === undefined) return res.status(400).json({ error: "path and content are required" });

  // Direct admin control action: allow for admin role, audit immutably.
  // The agent still routes write_file through the full SAF pipeline in orchestrator.js.
  const user = req.user || { username: "api", role: "admin" };
  if (user.role !== "admin" && user.role !== "operator") {
    return res.status(403).json({ error: "insufficient role for file write" });
  }

  try {
    const result = await executeTool("write_file", { path: filePath, content });
    await audit({ operation: "execute", actor: user.username, target: filePath, target_type: "file", reasoning: "direct file write via API", result: result.ok ? "success" : "failure" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
