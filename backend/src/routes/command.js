// backend/src/routes/command.js
// POST /api/command — execute a shell command (goes through SAF)

const express = require("express");
const router = express.Router();
const { safCheck } = require("../pipeline/saf");
const { executeTool } = require("../qwen/toolExecutor");
const { audit } = require("../utils/audit");

router.post("/", async (req, res) => {
  const { command, timeout } = req.body || {};
  if (!command) return res.status(400).json({ error: "command is required" });

  const saf = await safCheck(command, "command", "low", { username: "api", role: "admin" }, 1.0, false);
  if (!saf.passed) {
    await audit({ operation: "block", actor: "api", target: command, target_type: "command", reasoning: "SAF blocked", safResult: saf, result: "blocked" });
    return res.status(403).json({ error: "blocked by SAF", saf });
  }

  try {
    const result = await executeTool("execute_command", { command, timeout: timeout || 10000 });
    await audit({ operation: "execute", actor: "api", target: command, target_type: "command", reasoning: "direct API call", safResult: saf, result: result.exit_code === 0 ? "success" : "failure" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
