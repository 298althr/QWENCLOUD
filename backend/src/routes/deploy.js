// backend/src/routes/deploy.js
// POST /api/deployments       — deploy from GitHub repo (git clone + docker build)
// GET  /api/deployments       — list deployment history

const express = require("express");
const router = express.Router();
const { deployFromRepo } = require("../deploy/deployEngine");
const { safCheck } = require("../pipeline/saf");
const { audit } = require("../utils/audit");
const { query } = require("../db/pool");

router.post("/", async (req, res) => {
  const { repo_url, port, env_vars } = req.body || {};
  if (!repo_url) return res.status(400).json({ error: "repo_url is required" });

  const user = req.user || { username: "api", role: "admin" };
  const isAdmin = user.role === "admin" || user.role === "operator";
  // Treat dashboard-initiated deploy as admin-approved; SAF still checks whitelist and asset class.
  const saf = await safCheck(`deploy ${repo_url}`, "deploy", "low", user, 0.9, isAdmin);
  if (!saf.passed) {
    return res.status(403).json({ error: "blocked by SAF", saf });
  }

  try {
    const result = await deployFromRepo({ repo_url, requestedPort: port, env_vars });

    await audit({
      operation: "execute",
      actor: "api",
      target: repo_url,
      target_type: "deployment",
      reasoning: result.success
        ? `Deployed ${result.stack} app on port ${result.hostPort} at ${result.appUrl}`
        : `Deployment failed at ${result.stage}: ${result.error}`,
      safResult: saf,
      result: result.success ? "success" : "failure",
    });

    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  } catch (e) {
    await audit({ operation: "execute", actor: "api", target: repo_url, target_type: "deployment", reasoning: `Deployment error: ${e.message}`, safResult: saf, result: "failure" });
    res.status(500).json({ success: false, stage: "exception", error: e.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const result = await query(
      "SELECT * FROM audit_log WHERE target_type = 'deployment' ORDER BY timestamp DESC LIMIT $1",
      [limit]
    );
    res.json({ deployments: result.rows, count: result.rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
