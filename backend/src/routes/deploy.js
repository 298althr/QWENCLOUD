// backend/src/routes/deploy.js
// POST /api/deployments       — deploy from GitHub repo (git clone + docker build)
// GET  /api/deployments       — list deployment history

const express = require("express");
const router = express.Router();
const { executeTool } = require("../qwen/toolExecutor");
const { safCheck } = require("../pipeline/saf");
const { audit } = require("../utils/audit");
const { query } = require("../db/pool");

router.post("/", async (req, res) => {
  const { repo_url, port, env_vars } = req.body || {};
  if (!repo_url) return res.status(400).json({ error: "repo_url is required" });

  const saf = await safCheck(`deploy ${repo_url}`, "deploy", "medium", { username: "api", role: "admin" }, 0.8, false);
  if (!saf.passed) {
    return res.status(403).json({ error: "blocked by SAF", saf });
  }

  try {
    // Step 1: Clone the repo
    const cloneResult = await executeTool("git_clone", { repo_url });

    // Step 2: Build Docker image
    const buildResult = await executeTool("docker_build", { path: cloneResult.path, tag: `althr-${Date.now()}` });

    // Step 3: Run container
    const runResult = await executeTool("docker_run", { image: buildResult.tag, ports: port ? `${port}:8080` : "8080:8080", env_vars });

    await audit({ operation: "execute", actor: "api", target: repo_url, target_type: "deployment", reasoning: "GitHub deploy", safResult: saf, result: "success" });

    res.json({ clone: cloneResult, build: buildResult, run: runResult });
  } catch (e) {
    await audit({ operation: "execute", actor: "api", target: repo_url, target_type: "deployment", reasoning: "GitHub deploy failed", safResult: saf, result: "failure" });
    res.status(500).json({ error: e.message });
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
