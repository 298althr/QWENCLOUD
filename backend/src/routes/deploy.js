// backend/src/routes/deploy.js
// POST /api/deployments       — deploy from GitHub repo (git clone + docker build)
// GET  /api/deployments       — list deployment history

const express = require("express");
const router = express.Router();
const { deployFromRepo, deployStack, rollbackDeployment, getDeploymentContainers } = require("../deploy/deployEngine");
const { safCheck } = require("../pipeline/saf");
const { audit } = require("../utils/audit");
const { query } = require("../db/pool");
const { getContainerLogs, containerAction } = require("../utils/docker");

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

/**
 * GET /api/deployments/apps
 * Lists all deployed apps grouped by compose project with container status.
 */
router.get("/apps", async (req, res) => {
  try {
    const result = await getDeploymentContainers();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/deployments/stack
 * Body: { compose_content?: string, compose_url?: string, name?: string }
 * Deploys a Docker Compose stack.
 */
router.post("/stack", async (req, res) => {
  const { compose_content, compose_url, name } = req.body || {};
  if (!compose_content && !compose_url) {
    return res.status(400).json({ error: "Either compose_content or compose_url is required" });
  }

  const user = req.user || { username: "api", role: "admin" };
  const isAdmin = user.role === "admin" || user.role === "operator";
  const saf = await safCheck(`deploy stack ${name || "unnamed"}`, "deploy", "low", user, 0.9, isAdmin);
  if (!saf.passed) {
    return res.status(403).json({ error: "blocked by SAF", saf });
  }

  try {
    const result = await deployStack({ compose_content, compose_url, name });

    await audit({
      operation: "execute",
      actor: "api",
      target: `stack:${result.stackName || name}`,
      target_type: "deployment",
      reasoning: result.success
        ? `Deployed stack with ${result.serviceCount} services`
        : `Stack deployment failed at ${result.stage}: ${result.error}`,
      safResult: saf,
      result: result.success ? "success" : "failure",
    });

    if (!result.success) {
      return res.status(500).json(result);
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, stage: "exception", error: e.message });
  }
});

/**
 * POST /api/deployments/:id/rollback
 * Stops and restarts a stack deployment.
 */
router.post("/:id/rollback", async (req, res) => {
  try {
    const result = await rollbackDeployment(req.params.id);
    await audit({
      operation: "execute",
      actor: "api",
      target: `rollback:${req.params.id}`,
      target_type: "deployment",
      reasoning: result.message || result.error,
      result: result.success ? "success" : "failure",
    });
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * GET /api/deployments/:id/logs
 * Gets container logs for a specific deployment container.
 */
router.get("/:id/logs", async (req, res) => {
  try {
    const { tail } = req.query;
    const logStream = await getContainerLogs(req.params.id, { tail: Number(tail) || 100, follow: false });
    let output = "";
    if (Buffer.isBuffer(logStream)) {
      output = logStream.toString();
    } else if (typeof logStream === "string") {
      output = logStream;
    } else {
      output = String(logStream);
    }
    const clean = output
      .split("\n")
      .map((line) => {
        if (line.length > 8 && line.charCodeAt(0) === 1) {
          return line.substring(8);
        }
        return line;
      })
      .join("\n")
      .trim();
    res.json({ logs: clean, containerId: req.params.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/deployments/:id/action
 * Body: { action: "start"|"stop"|"restart"|"remove" }
 */
router.post("/:id/action", async (req, res) => {
  const { action } = req.body || {};
  if (!action || !["start", "stop", "restart", "remove"].includes(action)) {
    return res.status(400).json({ error: "action must be start, stop, restart, or remove" });
  }
  try {
    const result = await containerAction(req.params.id, action);
    await audit({
      operation: action,
      actor: "api",
      target: req.params.id,
      target_type: "container",
      reasoning: `Deployment container ${action}`,
      result: "success",
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
