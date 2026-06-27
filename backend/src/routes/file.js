// backend/src/routes/file.js
// GET  /api/file/list?path=...   — list directory contents
// GET  /api/file/read?path=...   — read file content
// POST /api/file/write            — write file content

const express = require("express");
const router = express.Router();
const { executeTool } = require("../qwen/toolExecutor");
const { safCheck } = require("../pipeline/saf");
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

  const saf = await safCheck(`write ${filePath}`, "file_write", "medium", { username: "api", role: "admin" }, 1.0, false);
  if (!saf.passed) {
    return res.status(403).json({ error: "blocked by SAF", saf });
  }

  try {
    const result = await executeTool("write_file", { path: filePath, content });
    await audit({ operation: "execute", actor: "api", target: filePath, target_type: "file", reasoning: "file write", safResult: saf, result: "success" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
