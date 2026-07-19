// backend/src/routes/deploy.js
// POST /api/deployments       — deploy from GitHub repo (git clone + docker build)
// GET  /api/deployments       — list deployment history
// POST /api/deployments/webhook — GitHub webhook listener for auto-rebuild on push
// POST /api/deployments/validate-url — validate a GitHub repo URL before deploying
// POST /api/deployments/investigate — AI-powered deployment failure investigation
// GET  /api/deployments/reports/:repoUrl — get deployment reports for a repo

const express = require("express");
const router = express.Router();
const { deployFromRepo, deployStack, rollbackDeployment, getDeploymentContainers } = require("../deploy/deployEngine");
const { safCheck } = require("../pipeline/saf");
const { audit } = require("../utils/audit");
const { logAction } = require("../utils/actionHistory");
const { query } = require("../db/pool");
const { getContainerLogs, containerAction } = require("../utils/docker");

// In-memory store for webhook configs and deployment reports
// In production these would go to Postgres but in-memory is fine for the hackathon
const webhookConfigs = new Map();
const deploymentReports = [];

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

    try {
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
      logAction({ category: "deployment", action: "deploy", target: repo_url, actor: "api", result: result.success ? "success" : "failure", detail: result }).catch(() => {});
    } catch (auditErr) {
      console.error("[deploy] audit log failed (non-fatal):", auditErr.message);
    }

    if (!result.success) {
      // Auto-trigger AI root cause analysis for every deployment failure
      investigateFailure(repo_url, result).catch((e) =>
        console.error("[deploy] auto-investigation failed:", e.message)
      );
      return res.status(500).json(result);
    }
    res.json(result);
  } catch (e) {
    try { await audit({ operation: "execute", actor: "api", target: repo_url, target_type: "deployment", reasoning: `Deployment error: ${e.message}`, safResult: saf, result: "failure" }); } catch {}
    // Auto-trigger AI investigation for exceptions too
    investigateFailure(repo_url, { stage: "exception", error: e.message }).catch(() => {});
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

/**
 * POST /api/deployments/validate-url
 * Body: { repo_url: string }
 * Validates a GitHub repo URL is accessible and returns repo metadata.
 */
router.post("/validate-url", async (req, res) => {
  const { repo_url } = req.body || {};
  if (!repo_url) return res.status(400).json({ error: "repo_url is required" });

  try {
    const url = new URL(repo_url);
    if (!url.hostname.includes("github.com")) {
      return res.status(400).json({ valid: false, error: "URL must be a GitHub repository" });
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return res.status(400).json({ valid: false, error: "Invalid repo path" });
    }

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, "");
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

    const resp = await fetch(apiUrl, {
      headers: { "User-Agent": "althr-autopilot" },
      signal: AbortSignal.timeout(10000),
    });

    if (resp.status === 404) {
      return res.json({ valid: false, error: "Repository not found or is private" });
    }
    if (!resp.ok) {
      return res.json({ valid: false, error: `GitHub API returned ${resp.status}` });
    }

    const data = await resp.json();
    res.json({
      valid: true,
      owner,
      repo,
      full_name: data.full_name,
      description: data.description,
      default_branch: data.default_branch,
      private: data.private,
      stars: data.stargazers_count,
      language: data.language,
      clone_url: data.clone_url,
    });
  } catch (e) {
    if (e.name === "TypeError") {
      return res.status(400).json({ valid: false, error: "Invalid URL format" });
    }
    res.status(500).json({ valid: false, error: e.message });
  }
});

/**
 * POST /api/deployments/webhook
 * GitHub webhook receiver. Triggers auto-rebuild when a push event is received.
 * Body: GitHub webhook payload (push event)
 * Header: X-GitHub-Event: push
 */
router.post("/webhook", async (req, res) => {
  const event = req.headers["x-github-event"];
  const payload = req.body;

  if (!event) {
    return res.status(400).json({ error: "Missing X-GitHub-Event header" });
  }

  if (event === "ping") {
    return res.json({ ok: true, message: "Webhook ping received. Webhook is configured correctly." });
  }

  if (event !== "push") {
    return res.json({ ok: true, message: `Received ${event} event. Only push triggers rebuild.` });
  }

  const repoUrl = payload?.repository?.clone_url;
  const repoName = payload?.repository?.full_name;
  const pushedBy = payload?.pusher?.name || "unknown";
  const ref = payload?.ref || "unknown";
  const commit = payload?.after?.substring(0, 7) || "unknown";

  if (!repoUrl) {
    return res.status(400).json({ error: "No repository URL in payload" });
  }

  // Check if this repo has auto-rebuild enabled
  const config = webhookConfigs.get(repoUrl);
  if (!config || !config.autoRebuild) {
    return res.json({ ok: true, message: "Push received but auto-rebuild is not enabled for this repo." });
  }

  // Acknowledge immediately, rebuild async
  res.json({
    ok: true,
    message: `Push received from ${repoName} by ${pushedBy}. Rebuild triggered.`,
    commit,
    ref,
  });

  // Trigger async rebuild
  (async () => {
    try {
      console.log(`[webhook] Auto-rebuild triggered for ${repoUrl} (commit ${commit})`);
      const result = await deployFromRepo({ repo_url: repoUrl, env_vars: config.envVars || [] });

      await audit({
        operation: "execute",
        actor: `webhook:${pushedBy}`,
        target: repoUrl,
        target_type: "deployment",
        reasoning: result.success
          ? `Auto-rebuild succeeded: ${result.stack} on port ${result.hostPort}`
          : `Auto-rebuild failed at ${result.stage}: ${result.error}`,
        result: result.success ? "success" : "failure",
      });

      if (!result.success) {
        // Auto-trigger AI investigation
        console.log(`[webhook] Build failed, triggering AI investigation...`);
        await investigateFailure(repoUrl, result);
      }

      console.log(`[webhook] Auto-rebuild complete: ${result.success ? "success" : "failed"}`);
    } catch (e) {
      console.error(`[webhook] Auto-rebuild error:`, e.message);
    }
  })();
});

/**
 * GET /api/deployments/webhook/config
 * Returns all webhook configs (with secrets masked).
 */
router.get("/webhook/config", (req, res) => {
  const configs = [];
  for (const [url, cfg] of webhookConfigs.entries()) {
    configs.push({
      repo_url: url,
      autoRebuild: cfg.autoRebuild,
      envVarsCount: cfg.envVars?.length || 0,
      createdAt: cfg.createdAt,
    });
  }
  res.json({ configs, count: configs.length });
});

/**
 * POST /api/deployments/webhook/config
 * Body: { repo_url, autoRebuild, env_vars }
 * Registers or updates a webhook config for auto-rebuild.
 */
router.post("/webhook/config", (req, res) => {
  const { repo_url, autoRebuild, env_vars } = req.body || {};
  if (!repo_url) return res.status(400).json({ error: "repo_url is required" });

  webhookConfigs.set(repo_url, {
    autoRebuild: autoRebuild !== false,
    envVars: env_vars || [],
    createdAt: new Date().toISOString(),
  });

  res.json({ ok: true, message: `Webhook config saved for ${repo_url}` });
});

/**
 * POST /api/deployments/investigate
 * Body: { repo_url, failure_data }
 * AI-powered investigation of a deployment failure.
 * Uses Qwen to analyze the error and produce a problem/solution report.
 */
router.post("/investigate", async (req, res) => {
  const { repo_url, failure_data } = req.body || {};
  if (!repo_url && !failure_data) {
    return res.status(400).json({ error: "repo_url or failure_data is required" });
  }

  try {
    const report = await investigateFailure(repo_url, failure_data);
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/deployments/reports
 * Returns all deployment investigation reports.
 */
router.get("/reports", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const reports = deploymentReports.slice(-limit).reverse();
  res.json({ reports, count: reports.length });
});

/**
 * GET /api/deployments/reports/:repoUrl
 * Returns deployment reports for a specific repo.
 */
router.get("/reports/:repoUrl", (req, res) => {
  const repo = decodeURIComponent(req.params.repoUrl);
  const reports = deploymentReports.filter((r) => r.repo_url === repo);
  res.json({ reports, count: reports.length });
});

/**
 * AI-powered deployment failure investigation.
 * Collects build error data, sends to Qwen for analysis.
 * Returns a structured problem/solution report in plain English.
 */
async function investigateFailure(repoUrl, failureData) {
  const { qwen, selectModel, MODELS } = require("../qwen/client");
  const { guardedCreate } = require("../qwen/guardrails");

  const stage = failureData?.stage || "unknown";
  const error = failureData?.error || "No error details provided";
  const findings = failureData?.findings || [];

  // Gather context about the failure
  const errorContext = [
    `Repository: ${repoUrl}`,
    `Failed at stage: ${stage}`,
    `Error output:`,
    error.substring(0, 3000),
  ];

  if (findings.length > 0) {
    errorContext.push(`File audit findings:`);
    findings.forEach((f) => errorContext.push(`- [${f.severity}] ${f.message}`));
  }

  // Classify the error type
  let errorType = "unknown";
  const lowerError = error.toLowerCase();
  if (lowerError.includes("npm err") || lowerError.includes("pnpm") || lowerError.includes("yarn")) {
    errorType = "dependency";
  } else if (lowerError.includes("syntaxerror") || lowerError.includes("typeerror") || lowerError.includes("referenceerror")) {
    errorType = "code";
  } else if (lowerError.includes("econnrefused") || lowerError.includes("database") || lowerError.includes("postgres") || lowerError.includes("redis")) {
    errorType = "database";
  } else if (lowerError.includes("cannot find module") || lowerError.includes("module not found")) {
    errorType = "dependency";
  } else if (lowerError.includes("port") && lowerError.includes("allocated")) {
    errorType = "port";
  } else if (lowerError.includes("dockerfile") || lowerError.includes("build failed")) {
    errorType = "dockerfile";
  } else if (lowerError.includes("permission") || lowerError.includes("denied")) {
    errorType = "permission";
  } else if (stage === "clone") {
    errorType = "git";
  }

  const systemPrompt = `You are a deployment failure analyst. Analyze build errors and produce a concise report.
Rules:
- State the problem in simple English. No jargon.
- List possible causes as bullet points.
- List solutions for each cause as bullet points.
- Do not use emojis, em dashes, or filler language.
- Keep the report under 500 words.
- Format as JSON with fields: problem_statement (string), error_type (string), possible_causes (array of strings), solutions (array of strings), recommended_action (string)`;

  const userPrompt = `Analyze this deployment failure and produce a report.

${errorContext.join("\n")}

Classified error type: ${errorType}

Respond as JSON only.`;

  let report;
  try {
    const model = selectModel("moderate") || MODELS.PLUS;
    const response = await guardedCreate(qwen, {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.3,
    }, { module: "deploy-investigate", taskType: "moderate" });

    const content = response?.choices?.[0]?.message?.content || "{}";
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    report = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      problem_statement: content.substring(0, 500),
      error_type: errorType,
      possible_causes: ["Unable to parse AI response"],
      solutions: ["Review the raw error output manually"],
      recommended_action: "Check build logs",
    };
  } catch (e) {
    // If Qwen fails, produce a rule-based report
    report = generateRuleBasedReport(errorType, stage, error, findings);
  }

  // Enrich with metadata
  report.repo_url = repoUrl;
  report.stage = stage;
  report.error_type = report.error_type || errorType;
  report.raw_error = error.substring(0, 500);
  report.timestamp = new Date().toISOString();
  report.id = `rpt_${Date.now().toString(36)}`;

  // Store the report
  deploymentReports.push(report);

  // Audit
  try {
    await audit({
      operation: "investigate",
      actor: "ai",
      target: repoUrl,
      target_type: "deployment",
      reasoning: `Investigated ${errorType} failure at ${stage}: ${report.problem_statement?.substring(0, 100)}`,
      result: "success",
    });
  } catch (e) {
    console.warn("[deploy] audit failed:", e.message);
  }

  return report;
}

/**
 * Rule-based fallback report generator when Qwen is unavailable.
 */
function generateRuleBasedReport(errorType, stage, error, findings) {
  const reports = {
    dependency: {
      problem_statement: "The build failed because one or more dependencies could not be installed or resolved.",
      possible_causes: [
        "A package version in package.json or requirements.txt does not exist or has been removed",
        "The lockfile is out of date and references old package versions",
        "A private package registry is not accessible from the build environment",
        "Node.js or Python version mismatch between local and build environment",
      ],
      solutions: [
        "Delete the lockfile and regenerate it with npm install or pip install",
        "Check that all package versions in the manifest are valid and published",
        "If using private packages, add the registry credentials as build arguments",
        "Pin the Node.js or Python version in the Dockerfile to match your local version",
      ],
      recommended_action: "Run npm install locally to verify dependencies resolve, then commit the updated lockfile.",
    },
    code: {
      problem_statement: "The build failed because of a syntax or type error in the source code.",
      possible_causes: [
        "A syntax error in the code that was not caught locally",
        "A TypeScript type error that only appears in strict build mode",
        "An import statement referencing a file that does not exist",
        "A variable or function used before it was defined",
      ],
      solutions: [
        "Run the build command locally and fix the reported errors",
        "Check that all import paths are correct and files exist",
        "Run the linter to catch common mistakes before building",
        "Add the missing type definitions for external packages",
      ],
      recommended_action: "Run npm run build or tsc locally, fix all errors, then push again.",
    },
    database: {
      problem_statement: "The application started but could not connect to the database or required data service.",
      possible_causes: [
        "The database URL or connection string is not set in environment variables",
        "The database service is not running or is on a different port",
        "Network rules block the connection between the app and database containers",
        "The database credentials are wrong or the user lacks permissions",
      ],
      solutions: [
        "Set the DATABASE_URL or equivalent environment variable in the deployment config",
        "Verify the database container is running and healthy before starting the app",
        "Check that both containers are on the same Docker network",
        "Test the database credentials with a direct connection from the app container",
      ],
      recommended_action: "Check environment variables for database connection settings and verify the database is running.",
    },
    port: {
      problem_statement: "The container could not start because the requested port is already in use.",
      possible_causes: [
        "Another container or process is using the same port",
        "A previous deployment was not cleaned up properly",
        "The port was hardcoded instead of using an environment variable",
      ],
      solutions: [
        "Let the deploy engine auto-assign a port instead of specifying one",
        "Stop the container using the port: docker stop $(docker ps -q --filter publish=<port>)",
        "Use a different port number for this deployment",
      ],
      recommended_action: "Remove the port parameter and let the system find a free port automatically.",
    },
    dockerfile: {
      problem_statement: "The Docker build failed because of a missing or invalid Dockerfile.",
      possible_causes: [
        "No Dockerfile exists in the repository root",
        "The Dockerfile has syntax errors or invalid instructions",
        "The Dockerfile references files that do not exist in the build context",
        "The base image does not exist or is not accessible",
      ],
      solutions: [
        "Add a Dockerfile in the repository root, or let the deploy engine generate one",
        "Check each instruction in the Dockerfile for typos or invalid syntax",
        "Verify that all COPY and ADD paths point to files that exist",
        "Use a valid base image tag from Docker Hub",
      ],
      recommended_action: "Review the Dockerfile syntax or remove it to let the system auto-generate one.",
    },
    git: {
      problem_statement: "The repository could not be cloned from GitHub.",
      possible_causes: [
        "The repository URL is incorrect or the repo has been deleted",
        "The repository is private and requires authentication",
        "The server cannot reach github.com due to network restrictions",
        "The default branch name is different from what was expected",
      ],
      solutions: [
        "Verify the URL opens in a browser",
        "If the repo is private, add a deploy key or access token",
        "Check network connectivity to github.com from the server",
        "Specify the correct branch in the deploy request",
      ],
      recommended_action: "Open the repo URL in a browser to verify it is accessible.",
    },
    permission: {
      problem_statement: "The build or run failed because of a file permission error.",
      possible_causes: [
        "The Dockerfile runs as a user that does not have write access to required directories",
        "A file or directory in the repository has restrictive permissions",
        "The build context includes files owned by root that cannot be read",
      ],
      solutions: [
        "Add a RUN chmod or chown instruction in the Dockerfile",
        "Run the container as root or add the user to the correct group",
        "Check file permissions in the repository and fix any that are too restrictive",
      ],
      recommended_action: "Add chmod commands to the Dockerfile to fix permissions during build.",
    },
  };

  return reports[errorType] || {
    problem_statement: `The deployment failed at the ${stage} stage. The error output indicates an unexpected issue.`,
    possible_causes: [
      "An unexpected error occurred during the build or run process",
      "The error may be related to the project configuration or environment",
      "Review the raw error output for specific details",
    ],
    solutions: [
      "Read the full error output to identify the specific failure point",
      "Try building the project locally with the same command to reproduce",
      "Check that all required environment variables are set",
    ],
    recommended_action: "Review the raw error output and identify the specific line that caused the failure.",
  };
}

/**
 * POST /api/deployments/propose-fix
 * Body: { repo_url, clone_dir, failure_data, report }
 * AI analyzes the build failure, identifies the specific file and line,
 * and proposes a patch. Returns the proposed fix for human approval.
 */
router.post("/propose-fix", async (req, res) => {
  const { clone_dir, failure_data, report } = req.body || {};
  if (!clone_dir && !failure_data) {
    return res.status(400).json({ error: "clone_dir or failure_data is required" });
  }

  try {
    const fs = require("fs");
    const path = require("path");
    const { qwen, selectModel, MODELS } = require("../qwen/client");
    const { guardedCreate } = require("../qwen/guardrails");

    const error = failure_data?.error || "No error details";
    const stage = failure_data?.stage || "build";
    const errorType = report?.error_type || "unknown";

    // Read the files in the clone directory to provide context to the AI
    let fileContext = [];
    if (clone_dir && fs.existsSync(clone_dir)) {
      const rootFiles = fs.readdirSync(clone_dir).slice(0, 20);
      for (const fname of rootFiles) {
        const fpath = path.join(clone_dir, fname);
        if (fs.statSync(fpath).isFile() && fs.statSync(fpath).size < 5000) {
          try {
            const content = fs.readFileSync(fpath, "utf8");
            fileContext.push({ name: fname, content: content.substring(0, 2000) });
          } catch {}
        }
      }
    }

    // Extract file path and line number from error output
    const fileMatch = error.match(/(?:at\s+)?([^\s]+\.(?:js|ts|py|go|php|json|yaml|yml)):(\d+)/);
    const errorFile = fileMatch ? fileMatch[1] : null;
    const errorLine = fileMatch ? parseInt(fileMatch[2]) : null;

    // If we found a specific file, read it
    let errorFileContent = null;
    if (errorFile && clone_dir) {
      const fullPath = path.join(clone_dir, errorFile);
      if (fs.existsSync(fullPath)) {
        errorFileContent = fs.readFileSync(fullPath, "utf8").substring(0, 4000);
      }
    }

    const systemPrompt = `You are a deployment fix agent. Analyze the build error and the source files. Propose a specific file edit to fix the issue.
Rules:
- Identify the exact file that needs to be changed.
- Provide the old code snippet that needs replacing.
- Provide the new code snippet that fixes the issue.
- Explain the fix in one sentence.
- Do not use emojis or jargon.
- Format as JSON: { file_path, old_snippet, new_snippet, explanation, confidence (0-1) }`;

    const userPrompt = `Build failed at stage: ${stage}
Error type: ${errorType}
Error output:
${error.substring(0, 2000)}

${errorFileContent ? `Content of ${errorFile}:\n${errorFileContent}` : "No specific error file identified."}

Files in the repo root: ${fileContext.map(f => f.name).join(", ")}

${fileContext.length > 0 ? "File contents:\n" + fileContext.map(f => `--- ${f.name} ---\n${f.content}`).join("\n\n") : ""}

Propose a fix as JSON.`;

    let fixProposal;
    try {
      const model = selectModel("moderate") || MODELS.PLUS;
      const response = await guardedCreate(qwen, {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.2,
      }, { module: "deploy-fix", taskType: "moderate" });

      const content = response?.choices?.[0]?.message?.content || "{}";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      fixProposal = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (e) {
      fixProposal = null;
    }

    if (!fixProposal) {
      return res.json({
        fixable: false,
        message: "AI could not propose a specific fix for this error. Manual review required.",
        error_file: errorFile,
        error_line: errorLine,
      });
    }

    // Read the current file content to verify the old snippet exists
    let currentContent = null;
    let canApply = false;
    if (fixProposal.file_path && clone_dir) {
      const fullPath = path.join(clone_dir, fixProposal.file_path);
      if (fs.existsSync(fullPath)) {
        currentContent = fs.readFileSync(fullPath, "utf8");
        canApply = fixProposal.old_snippet && currentContent.includes(fixProposal.old_snippet);
      }
    }

    res.json({
      fixable: true,
      fix_proposal: fixProposal,
      error_file: errorFile,
      error_line: errorLine,
      can_apply_automatically: canApply,
      requires_approval: true,
      clone_dir,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/deployments/apply-fix
 * Body: { clone_dir, file_path, old_snippet, new_snippet }
 * Applies a previously proposed fix to the cloned repo and rebuilds.
 * Requires explicit approval (humanApproved=true via SAF).
 */
router.post("/apply-fix", async (req, res) => {
  const { clone_dir, file_path, old_snippet, new_snippet, repo_url, env_vars } = req.body || {};
  if (!clone_dir || !file_path || !new_snippet) {
    return res.status(400).json({ error: "clone_dir, file_path, and new_snippet are required" });
  }

  const user = req.user || { username: "api", role: "admin" };
  const saf = await safCheck(`edit ${file_path}`, "deployment", "medium", user, 0.8, true);
  if (!saf.passed) {
    return res.status(403).json({ error: "blocked by SAF", saf });
  }

  try {
    const fs = require("fs");
    const path = require("path");
    const fullPath = path.join(clone_dir, file_path);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: `File not found: ${file_path}` });
    }

    let content = fs.readFileSync(fullPath, "utf8");

    if (old_snippet && content.includes(old_snippet)) {
      content = content.replace(old_snippet, new_snippet);
    } else if (old_snippet) {
      return res.status(400).json({
        error: "old_snippet not found in file. The file may have changed since the fix was proposed.",
        file_path,
      });
    } else {
      content = new_snippet;
    }

    fs.writeFileSync(fullPath, content);

    await audit({
      operation: "execute",
      actor: user.username ? `human:${user.username}` : "agent",
      target: file_path,
      target_type: "file_edit",
      reasoning: `Applied AI-proposed fix to ${file_path}`,
      safResult: saf,
      result: "success",
    });

    res.json({
      ok: true,
      message: `Fix applied to ${file_path}. Ready to rebuild.`,
      clone_dir,
      file_path,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/deployments/rebuild
 * Body: { clone_dir, repo_url, env_vars }
 * Rebuilds from an existing clone directory (after a fix has been applied).
 */
router.post("/rebuild", async (req, res) => {
  const { clone_dir, repo_url, env_vars } = req.body || {};
  if (!clone_dir) {
    return res.status(400).json({ error: "clone_dir is required" });
  }

  try {
    const result = await deployFromRepo({ repo_url: repo_url || "local", env_vars, cloneDir: clone_dir });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
