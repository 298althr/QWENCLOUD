---
description: Deploy a GitHub repository to a Docker container on the ECS production instance
---

# Deploy a GitHub Repo to Production

This workflow deploys a public GitHub repository to a Docker container on the ECS instance (47.84.106.210).

## Prerequisites

- The GitHub repo must be **public** (or a GitHub token must be set via `GITHUB_TOKEN` env var on the backend container)
- The target port must be open in the Alibaba Cloud security group
- The ECS instance must have enough free RAM (~200MB for the built container) and disk space (~500MB for the image)

## Steps

### 1. Validate the repo URL (optional)

```bash
curl -s -X POST http://47.84.106.210:3000/api/deployments/validate-url \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/owner/repo"}'
```

Returns `{ "valid": true, "owner": "...", "repo": "...", "language": "..." }` or `{ "valid": false, "error": "..." }`.

### 2. Deploy via the API

```bash
curl -s -X POST http://47.84.106.210:3000/api/deployments \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/owner/repo"}'
```

Optional fields:
- `port` - preferred host port (auto-assigned if omitted, scans 4000-4999 then 3000-3999)
- `env_vars` - array of `KEY=value` strings passed to the container

### 3. What the deploy engine does (automated)

1. **Clone** - `git clone` the repo to `/tmp/althr-clones/` inside the backend container
2. **Detect stack** - Scans files at depth 2 to identify: Next.js, FastAPI, Node.js, Python, PHP, Go, or static HTML
3. **Find web root** - For monorepos, looks for `frontend/` with Next.js dependency. Falls back to `public/`, `dist/`, `build/`, `site/`, `shop/`, `www/`, `web/` dirs with HTML files
4. **Audit deployment files** - Checks for Dockerfile, docker-compose, Railway/Vercel/Nixpacks configs. Warns if missing EXPOSE, HEALTHCHECK, or has hardcoded secrets
5. **Generate Dockerfile** - If no Dockerfile exists, generates one based on detected stack with correct base image, dependency install, build step, and port exposure
6. **Build** - `docker build` with a 10-minute timeout. Uses the repo's own Dockerfile if present, otherwise the generated one
7. **Run** - `docker run -d` on an auto-selected free host port. Retries up to 5 times on port conflicts
8. **Health check** - Polls the root endpoint for up to 20 seconds to verify the app started
9. **Audit log** - Records the deployment in the immutable `audit_log` table (non-fatal if PG is unavailable)

### 4. If the deploy fails

The API returns `{ "success": false, "stage": "clone|build|run", "error": "...", "findings": [...] }`.

**AI-powered investigation endpoint:**

```bash
curl -s -X POST http://47.84.106.210:3000/api/deployments/investigate \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/owner/repo","failure_data":{"stage":"build","error":"COPY failed..."}}'
```

This sends the error to Qwen AI which returns a structured report:
- `problem_statement` - plain English description of the failure
- `error_type` - docker, npm, git, or generic
- `possible_causes` - array of likely causes
- `solutions` - array of recommended fixes
- `recommended_action` - single next step

### 5. Verify the deployment

```bash
curl -s -o /dev/null -w "%{http_code}" http://47.84.106.210:<port>/
```

### 6. Clean up (when done testing)

```bash
ssh root@47.84.106.210 "docker stop <container-name> && docker rm <container-name> && docker rmi <image-name>"
```

Also clean up clone dirs:
```bash
ssh root@47.84.106.210 "docker exec althr-backend rm -rf /tmp/althr-clones/*"
```

## Frontend UI

The Deployments page at http://47.84.106.210:3001/deployments provides a visual interface for this workflow:
- Input field for the GitHub URL
- Validate button to check repo accessibility
- Deploy button to trigger the build
- Optional port and env vars inputs
- Auto-rebuild toggle (sets up GitHub webhook for push-triggered redeployments)
- Live list of deployed containers with status, ports, and actions (stop/restart/remove)
- AI investigation panel that appears on deployment failures with problem analysis and solutions
- Deployment history and investigation reports

## Stack-specific AI recommendations

When a deployment fails, the AI investigation considers the detected stack:

| Stack | Common failures | AI recommendations |
|-------|----------------|-------------------|
| Next.js | Missing `output: standalone` in next.config, build timeout, missing env vars | Add standalone output, increase build timeout, set NEXT_PUBLIC_* env vars |
| Node.js | Missing `start` script in package.json, npm ci fails on lockfile mismatch | Run npm install instead of ci, add start script |
| Python | Missing requirements.txt, wrong port binding | Add requirements.txt, use 0.0.0.0 binding |
| FastAPI | Missing uvicorn, wrong module path | Install uvicorn, check main:app path |
| PHP | Wrong document root, missing composer deps | Set correct docroot, run composer install |
| Go | Missing go.sum, build fails on CGO | Run go mod tidy, set CGO_ENABLED=0 |
| Static | No index.html found | Ensure index.html exists in root or web root dir |

## Known limitations

- Build timeout is 10 minutes. Large Next.js apps with many dependencies may exceed this
- The backend container has 256MB memory limit. Concurrent builds may cause OOM kills
- Private repos require GITHUB_TOKEN env var to be set on the backend container
- The deployed container runs on the host network via port mapping. The port must be open in the Alibaba Cloud security group to be publicly accessible
- Long-running builds block the Node.js event loop, which can cause PostgreSQL connection timeouts. The audit calls are wrapped in try-catch to prevent crashes, but the deploy request itself will block until the build completes
