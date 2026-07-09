// backend/src/deploy/deployEngine.js
// Intelligent GitHub → Docker deployment engine.
// Detects stack, inspects deployment files, builds, runs, and verifies.

const fs = require("fs");
const path = require("path");
const { executeTool } = require("../qwen/toolExecutor");
const { store } = require("../memory/store");

const CLONE_ROOT = "/tmp/althr-clones";

const STACKS = {
  node: {
    name: "Node.js",
    signals: ["package.json"],
    dockerfile: (port) => `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV PORT=${port}
EXPOSE ${port}
CMD ["npm", "start"]`,
    defaultPort: 3000,
  },
  nextjs: {
    name: "Next.js",
    signals: ["package.json"],
    check: (files) => files.includes("next.config.js") || files.includes("next.config.mjs") || files.includes("next.config.ts"),
    dockerfile: (port) => `FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV PORT=${port}
EXPOSE ${port}
CMD ["npm", "start"]`,
    defaultPort: 3000,
  },
  python: {
    name: "Python",
    signals: ["requirements.txt"],
    dockerfile: (port) => `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=${port}
EXPOSE ${port}
CMD ["python", "-m", "http.server", "${port}"]`,
    defaultPort: 8000,
  },
  fastapi: {
    name: "FastAPI",
    signals: ["requirements.txt"],
    check: (files) => files.some((f) => /main\.py|app\.py|fastapi/i.test(f)),
    dockerfile: (port) => `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV PORT=${port}
EXPOSE ${port}
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "${port}"]`,
    defaultPort: 8000,
  },
  php: {
    name: "PHP",
    signals: ["composer.json", "index.php"],
    dockerfile: (port) => `FROM php:8.2-apache
WORKDIR /var/www/html
COPY . .
EXPOSE ${port}
CMD ["apache2-foreground"]`,
    defaultPort: 80,
  },
  go: {
    name: "Go",
    signals: ["go.mod"],
    dockerfile: (port) => `FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /app/server
FROM alpine:latest
WORKDIR /app
COPY --from=builder /app/server .
ENV PORT=${port}
EXPOSE ${port}
CMD ["./server"]`,
    defaultPort: 8080,
  },
  static: {
    name: "Static site",
    signals: ["index.html"],
    dockerfile: (port) => `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE ${port}
CMD ["nginx", "-g", "daemon off;"]`,
    defaultPort: 80,
  },
  unknown: {
    name: "Unknown",
    signals: [],
    dockerfile: (port) => `FROM alpine:latest
WORKDIR /app
COPY . .
EXPOSE ${port}
CMD ["sh", "-c", "echo 'No start command detected' && sleep 3600"]`,
    defaultPort: 8080,
  },
};

function scanRepo(repoPath, depth = 2) {
  const files = [];
  const dirs = [];
  try {
    const entries = fs.readdirSync(repoPath, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile()) files.push({ name: e.name, path: repoPath });
      if (e.isDirectory() && depth > 0) {
        dirs.push(e.name);
        const sub = scanRepo(path.join(repoPath, e.name), depth - 1);
        files.push(...sub.files);
        dirs.push(...sub.dirs);
      }
    }
  } catch {}
  return { files, dirs: [...new Set(dirs)] };
}

function detectStack(repoPath) {
  const scan = scanRepo(repoPath, 2);
  const fileNames = scan.files.map((f) => f.name);
  const fileMap = new Map(scan.files.map((f) => [f.name, f.path]));

  // If there is a web root with HTML files and the package.json has no real
  // start/build scripts, treat it as a static site.
  const webRoot = findWebRoot(repoPath, fileMap);
  const rootFiles = fs.readdirSync(repoPath);
  const hasPackageJson = rootFiles.includes("package.json");
  let packageJson = null;
  if (hasPackageJson) {
    try {
      packageJson = JSON.parse(fs.readFileSync(path.join(repoPath, "package.json"), "utf8"));
    } catch {}
  }
  const hasRealStart = packageJson?.scripts?.start && !packageJson.scripts.start.includes("echo");
  const hasRealBuild = packageJson?.scripts?.build && !packageJson.scripts.build.includes("echo");
  const hasHtmlWebRoot = fs.existsSync(webRoot) && fs.readdirSync(webRoot).some((f) => f.endsWith(".html"));

  if (hasHtmlWebRoot && hasPackageJson && !hasRealStart && !hasRealBuild) {
    return { stack: "static", fileMap };
  }

  const order = ["nextjs", "fastapi", "node", "python", "php", "go", "static"];
  for (const key of order) {
    const stack = STACKS[key];
    const hasSignals = stack.signals.some((s) => fileNames.includes(s));
    const passesCheck = stack.check ? stack.check(fileNames) : true;
    if (hasSignals && passesCheck) return { stack: key, fileMap };
  }
  return { stack: "unknown", fileMap };
}

function findWebRoot(repoPath, fileMap) {
  // Prefer known static web roots
  const candidates = ["public", "dist", "build", "site", "shop", "www", "web"];
  for (const dir of candidates) {
    const dirPath = path.join(repoPath, dir);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      const hasHtml = fs.readdirSync(dirPath).some((f) => f.endsWith(".html"));
      if (hasHtml) return dirPath;
    }
  }
  // If any index.html is deeper than root, use its parent
  for (const [name, filePath] of fileMap) {
    if (name === "index.html" && filePath !== repoPath) return filePath;
  }
  return repoPath;
}

function auditDeploymentFiles(repoPath, stackKey, files) {
  const findings = [];
  const hasDockerfile = files.includes("Dockerfile");
  const hasCompose = files.includes("docker-compose.yml") || files.includes("docker-compose.yaml");
  const hasRailway = files.includes("railway.toml");
  const hasVercel = files.includes("vercel.json");
  const hasNixpacks = files.includes("nixpacks.toml");

  if (!hasDockerfile && !hasCompose && !hasRailway && !hasVercel && !hasNixpacks) {
    findings.push({
      severity: "warning",
      message: `No deployment files found. ALTHR will generate a Dockerfile for ${STACKS[stackKey].name}.`,
    });
  }

  if (hasDockerfile) {
    const dockerfile = fs.readFileSync(path.join(repoPath, "Dockerfile"), "utf8");
    if (!/EXPOSE\s+\d+/i.test(dockerfile)) {
      findings.push({
        severity: "warning",
        message: "Dockerfile is missing an EXPOSE instruction. ALTHR will infer the port from stack.",
      });
    }
    if (!/HEALTHCHECK/i.test(dockerfile)) {
      findings.push({
        severity: "info",
        message: "Dockerfile has no HEALTHCHECK. ALTHR will poll the root endpoint after startup.",
      });
    }
    if (/password|secret|token/i.test(dockerfile) && !/ARG\s+/i.test(dockerfile)) {
      findings.push({
        severity: "warning",
        message: "Dockerfile may contain hardcoded secrets. Review before production use.",
      });
    }
  }

  if (hasCompose) {
    findings.push({ severity: "info", message: "docker-compose.yml found. One-click compose support is planned." });
  }

  return findings;
}

async function isPortInUse(port) {
  try {
    const res = await fetch(`http://localhost:${port}`, { signal: AbortSignal.timeout(1000) });
    return true; // anything responding means port is occupied
  } catch {
    return false;
  }
}

async function findFreePort(preferred) {
  if (preferred) {
    if (!(await isPortInUse(preferred))) return preferred;
  }
  // Search in a safe range 4000-4999, then 3000-3999
  for (const base of [4000, 3000, 5000, 8000]) {
    for (let i = 0; i < 1000; i++) {
      const port = base + i;
      if (!(await isPortInUse(port))) return port;
    }
  }
  return 3000 + Math.floor(Math.random() * 1000);
}

async function waitForHealth(url, attempts = 10, delayMs = 2000) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status < 500) return { reachable: true, status: res.status };
    } catch {}
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return { reachable: false, status: null };
}

async function deployFromRepo({ repo_url, requestedPort, env_vars = [] }) {
  const repoName = repo_url
    .replace(/[^a-zA-Z0-9]/g, "-")
    .toLowerCase()
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");
  const timestamp = Date.now();
  const cloneDir = path.join(CLONE_ROOT, `${repoName}-${timestamp}`);
  const tag = `althr-${repoName}-${timestamp}`;

  fs.mkdirSync(CLONE_ROOT, { recursive: true });

  // 1. Clone
  const cloneResult = await executeTool("git_clone", { repo_url, dest: cloneDir });
  if (cloneResult.exit_code !== 0) {
    return { success: false, stage: "clone", error: cloneResult.stderr || cloneResult.stdout };
  }

  const { stack: stackKey, fileMap } = detectStack(cloneDir);
  const webRoot = findWebRoot(cloneDir, fileMap);
  const rootFiles = fs.readdirSync(webRoot);
  const stack = STACKS[stackKey];

  // 2. Audit deployment files
  const findings = auditDeploymentFiles(webRoot, stackKey, rootFiles);

  // 3. Determine port (avoid conflicts)
  const containerPort = stack.defaultPort;
  const hostPort = await findFreePort(requestedPort);

  // 4. Dockerfile handling
  let dockerfileContent = null;
  if (!rootFiles.includes("Dockerfile") || findings.some((f) => f.message.includes("missing an EXPOSE"))) {
    dockerfileContent = stack.dockerfile(containerPort);
  }

  // 5. Build from the web root
  const buildResult = await executeTool("docker_build", {
    path: webRoot,
    dockerfile: dockerfileContent,
    tag,
    timeout: 180000,
  });
  if (buildResult.exit_code !== 0) {
    return { success: false, stage: "build", error: buildResult.stderr || buildResult.stdout, findings, cloneDir };
  }

  // 6. Run (retry on host port conflict)
  let containerName = `althr-${repoName}-${timestamp}`;
  let runResult;
  let attempts = 0;
  let currentHostPort = hostPort;
  while (attempts < 5) {
    attempts++;
    runResult = await executeTool("docker_run", {
      image: tag,
      ports: `${currentHostPort}:${containerPort}`,
      env_vars,
      name: containerName,
    });
    if (runResult.exit_code === 0) break;
    if (/port is already allocated/i.test(runResult.stderr || runResult.stdout)) {
      currentHostPort = 4000 + Math.floor(Math.random() * 4000);
      // use a fresh container name so the failed attempt does not block the next
      containerName = `althr-${repoName}-${Date.now()}-${attempts}`;
      continue;
    }
    return { success: false, stage: "run", error: runResult.stderr || runResult.stdout, findings, cloneDir };
  }
  if (runResult.exit_code !== 0) {
    return { success: false, stage: "run", error: runResult.stderr || runResult.stdout, findings, cloneDir };
  }
  const containerId = runResult.stdout.trim();

  // 7. Verify (use the port that actually got mapped)
  const finalHostPort = currentHostPort;
  const healthUrl = `http://localhost:${finalHostPort}/health`;
  const rootUrl = `http://localhost:${finalHostPort}`;
  let health = await waitForHealth(healthUrl, 15, 3000);
  if (!health.reachable) health = await waitForHealth(rootUrl, 15, 3000);

  const result = {
    success: true,
    stack: stack.name,
    cloneDir,
    webRoot,
    imageTag: tag,
    containerId,
    containerName,
    containerPort,
    hostPort: finalHostPort,
    appUrl: rootUrl,
    healthUrl,
    health,
    findings,
  };

  // 8. Store in memory (M4 execution + M6 learning)
  const memActionId = `deploy_${Date.now().toString(36)}`;
  try {
    await store("M4", `Deployed ${repo_url} -> ${rootUrl}`, {
      action_id: memActionId,
      action_type: "deploy",
      action_detail: JSON.stringify({ repo_url, stack: stack.name, hostPort: finalHostPort, containerId, webRoot }),
      result: health.reachable ? "success" : "partial",
      saf_passed: true,
      human_approved: false,
    });
    await store("M6", `Deployment pattern: ${stack.name} app from ${repo_url} served on port ${finalHostPort} from ${webRoot}`, {
      action_id: memActionId,
      error_type: stack.name,
      pattern_hash: `deploy-${stack.name}-${finalHostPort}`,
      improvement_note: `Successful ${stack.name} deployment on port ${finalHostPort}. Web root: ${webRoot}.`,
      reinforcement_count: 1,
    });
  } catch (e) {
    console.warn("[deploy] memory store failed:", e.message);
  }

  return result;
}

module.exports = { deployFromRepo, detectStack, auditDeploymentFiles };
