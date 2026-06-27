// backend/src/routes/security.js
// GET  /api/security/audit   — recent audit log entries
// POST /api/security/scan    — trigger a security scan (RKHunter/Lynis stub)

const express = require("express");
const router = express.Router();
const { query } = require("../db/pool");
const { executeTool } = require("../qwen/toolExecutor");
const { audit } = require("../utils/audit");

router.get("/audit", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const result = await query(
      "SELECT id, timestamp, operation, actor, target, target_type, reasoning, result, confidence FROM audit_log ORDER BY timestamp DESC LIMIT $1",
      [limit]
    );
    res.json({ entries: result.rows, count: result.rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/scan", async (req, res) => {
  try {
    // Run a basic security scan (check for suspicious files, open ports, etc.)
    const checks = await Promise.all([
      executeTool("execute_command", { command: "whoami", timeout: 5000 }).catch(() => ({ stdout: "error" })),
      executeTool("check_ports", {}).catch(() => ({ ports: [] })),
    ]);

    const result = {
      timestamp: new Date().toISOString(),
      user: checks[0].stdout?.trim() || "unknown",
      open_ports: checks[1].ports || [],
      status: "completed",
    };

    await audit({ operation: "scan", actor: "api", target: "system", target_type: "security_scan", reasoning: "Security scan triggered", result: "success" });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
