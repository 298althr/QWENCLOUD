# Pre-Submission Validation Workflow

> **Goal:** Verify the ALTHR Autopilot stack is fully functional locally before pushing to GitHub or deploying to Alibaba Cloud.
>
> **Scope:** Backend API, frontend UI, database, Redis, WebSocket stream, Telegram bot, SAF, audit immutability, and Docker Desktop runtime.

## 1. Prerequisites

- Docker Desktop is installed and running.
- `.env` exists in `TRACK4/` with:
  - `DASHSCOPE_API_KEY` (Qwen Cloud)
  - `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHATID`
  - `RESEND_API` (optional)
  - `GITHUB_TOKEN` (optional)
- `.env` is listed in `.gitignore` and never committed.

## 2. Start the Full Stack

Open PowerShell in `TRACK4/`:

```powershell
cd "C:\Users\Sav-Dev\Documents\HACKATHON\QWENCLOUD\TRACK4"
docker-compose up -d --build
```

Wait for all services to be healthy:

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output:

```
NAMES            STATUS                    PORTS
althr-backend    Up ... (healthy)          0.0.0.0:3000->3000/tcp
althr-frontend   Up ...                    0.0.0.0:3001->3001/tcp
althr-postgres   Up ... (healthy)          0.0.0.0:5432->5432/tcp
althr-redis      Up ... (healthy)          0.0.0.0:6379->6379/tcp
```

If the backend is not healthy, check logs:

```powershell
docker logs althr-backend --tail 50
```

## 3. Database Schema Check

Ensure tables are initialized:

```powershell
docker exec -i althr-postgres psql -U althr -d althr_autopilot -c "\dt" 2>&1
```

You should see tables including `audit_log`, `qwen_conversations`, `memory_m1` through `memory_m7`, `sops`, `learning_notes`, `decisions`.

If the schema is missing, re-apply it:

```powershell
docker cp "C:\Users\Sav-Dev\Documents\HACKATHON\QWENCLOUD\TRACK4\backend\src\db\schema.sql" althr-postgres:/tmp/schema.sql
docker exec -i althr-postgres psql -U althr -d althr_autopilot -f /tmp/schema.sql
```

## 4. Run All Backend Validation Tests

Run each Day test inside the backend container:

```powershell
docker exec -i althr-backend node tests/day3-validation.js
docker exec -i althr-backend node tests/day4-validation.js
docker exec -i althr-backend node tests/day5-validation.js
docker exec -i althr-backend node tests/day6-validation.js
docker exec -i althr-backend node tests/day9-validation.js
```

**Expected:** All pass with `0 failed`.

## 5. API Endpoint Smoke Test

Run these PowerShell commands:

```powershell
# 1. Health
(Invoke-RestMethod -Uri http://localhost:3000/api/health).status

# 2. Server health
Invoke-RestMethod -Uri http://localhost:3000/api/health/server

# 3. Processes
Invoke-RestMethod -Uri http://localhost:3000/api/processes

# 4. Ports
Invoke-RestMethod -Uri http://localhost:3000/api/ports

# 5. Docker containers
Invoke-RestMethod -Uri http://localhost:3000/api/docker/containers

# 6. Agent pipeline
$body = @{message="show server health"} | ConvertTo-Json -Compress
Invoke-RestMethod -Uri http://localhost:3000/api/agent -Method POST -Body $body -ContentType "application/json"

# 7. Command execution through SAF
$body = @{command="uptime"; timeout=10000} | ConvertTo-Json -Compress
Invoke-RestMethod -Uri http://localhost:3000/api/command -Method POST -Body $body -ContentType "application/json"

# 8. Memory by layer
Invoke-RestMethod -Uri http://localhost:3000/api/memory/M3

# 9. Semantic search
Invoke-RestMethod -Uri "http://localhost:3000/api/memory/search?query=CPU+problems&layers=M6"

# 10. File listing
Invoke-RestMethod -Uri "http://localhost:3000/api/file/list?path=."

# 11. DQ trend
Invoke-RestMethod -Uri http://localhost:3000/api/analytics/dq-trend

# 12. Lessons
Invoke-RestMethod -Uri http://localhost:3000/api/learning/lessons

# 13. Audit log
Invoke-RestMethod -Uri http://localhost:3000/api/security/audit?limit=5

# 14. Security scan
Invoke-RestMethod -Uri http://localhost:3000/api/security/scan -Method POST

# 15. Approvals
Invoke-RestMethod -Uri http://localhost:3000/api/approvals

# 16. Deployments
Invoke-RestMethod -Uri http://localhost:3000/api/deployments
```

**Expected:** All return JSON responses without `error` fields (except deliberate SAF blocks).

## 6. Safety & Audit Verification

Confirm dangerous commands are blocked:

```powershell
$body = @{command="rm -rf /"} | ConvertTo-Json -Compress
Invoke-RestMethod -Uri http://localhost:3000/api/command -Method POST -Body $body -ContentType "application/json"
```

**Expected:** HTTP 403 with `blocked by SAF`.

Confirm audit log is immutable:

```powershell
docker exec -i althr-postgres psql -U althr -d althr_autopilot -c "UPDATE audit_log SET result='tampered' WHERE id=1;" 2>&1
```

**Expected:** Error — `audit_log is immutable`.

## 7. Frontend Verification

Open these URLs in a browser:

| URL | What to check |
|---|---|
| `http://localhost:3001` | Dashboard loads, cards show "Checking…" then populate |
| `http://localhost:3001/agent` | Send "show server health" and see reasoning stream |
| `http://localhost:3001/monitoring` | Charts appear, no console errors |
| `http://localhost:3001/memory` | Memory layers load, semantic search works |
| `http://localhost:3001/analytics` | DQ trend chart renders |
| `http://localhost:3001/security` | Audit log table loads |
| `http://localhost:3001/files` | Directory listing works |
| `http://localhost:3001/deployments` | Page loads without crash |
| `http://localhost:3001/settings` | Page loads without crash |

Open browser DevTools (F12) → Console. **Expected:** no red errors on any page.

## 8. WebSocket / Alert Feed Verification

Use a browser console on any dashboard page:

```javascript
const socket = io("http://localhost:3000");
socket.on("connect", () => console.log("connected", socket.id));
socket.on("alert", (a) => console.log("alert", a));
```

**Expected:** `connected` logged. Trigger an anomaly by sending this from PowerShell:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/security/scan -Method POST | Out-Null
```

Then check the browser console for alert or metric events.

## 9. Telegram Bot Verification

If you have a Telegram bot token and chat ID in `.env`:

1. Start the Telegram bot (if not already started by the backend):
   ```powershell
   docker exec -i althr-backend node -e "require('./src/telegram/bot')"
   ```
2. Send these commands to your bot in Telegram:
   - `/start`
   - `/help`
   - `/health`
   - `/processes`
   - `/ports`
   - `/deployments`
   - `/security`
   - `/logs 5`
   - `/status`
   - `/agent show server health`
   - `/approve` (if a pending action exists)
   - `/reject` (if a pending action exists)

**Expected:** Bot responds with formatted messages for each command.

## 10. Docker Desktop Verification

Confirm the backend can introspect its own containers:

```powershell
Invoke-RestMethod -Uri http://localhost:3000/api/docker/containers
```

**Expected:** JSON list containing `althr-backend`, `althr-frontend`, `althr-postgres`, `althr-redis`.

If this returns an empty list or error, ensure the backend container has `docker.sock` mounted:

```powershell
docker inspect althr-backend --format '{{ range .HostConfig.Binds }}{{ . }}\n{{ end }}'
```

**Expected:** `/var/run/docker.sock:/var/run/docker.sock`.

## 11. Code & Git Verification

Run these commands:

```powershell
cd "C:\Users\Sav-Dev\Documents\HACKATHON\QWENCLOUD\TRACK4"
git status
```

**Expected:** `working tree clean`.

Confirm no secrets are in the committed code:

```powershell
git log -p | Select-String -Pattern "sk-ws-|ghp_|re_|TELEGRAM_BOT_TOKEN" | Select-Object -First 10
```

**Expected:** No matches (all secrets are in `.env` which is gitignored).

## 12. Cloud-Readiness Pre-Check (Before Day 10)

Before moving to Alibaba Cloud, verify:

| Check | Command / Action |
|---|---|
| `.env` has Alibaba Cloud credentials | `cat .env` contains `ALIBABA_CLOUD_ACCESS_KEY_ID` and `SECRET` |
| `docker-compose.prod.yml` exists | `ls docker-compose.prod.yml` |
| `backend/src/utils/alibaba.js` exists | `ls backend/src/utils/alibaba.js` |
| GitHub repo is public | Open `https://github.com/YOUR_USERNAME/YOUR_REPO` |
| README is complete | `cat README.md` covers install, run, demo, architecture |
| Architecture diagram exists | `ls docs/architecture-diagram.png` or similar |
| Demo video is uploaded | YouTube unlisted link ready |

## 13. Final Submission Checklist

Mark each item before submitting:

- [ ] All 4 Docker containers healthy
- [ ] Day 3, 4, 5, 6, 9 validation tests pass
- [ ] All 16 API endpoints return valid JSON
- [ ] Frontend loads on `http://localhost:3001`
- [ ] All 9 dashboard pages render without console errors
- [ ] WebSocket connects and emits events
- [ ] Telegram bot responds to all 12 commands
- [ ] SAF blocks `rm -rf /`
- [ ] Audit log is immutable
- [ ] Git working tree is clean
- [ ] No secrets committed
- [ ] GitHub repo is public
- [ ] Alibaba Cloud ECS instance provisioned (when ready)
- [ ] Live demo URL accessible
- [ ] README, architecture diagram, demo video ready
- [ ] Devpost submission filled with repo link and demo URL

## 14. Sign-Off

When all boxes above are checked, the project is ready for final submission.

```
Validation completed by: _________________
Date: _________________
Commit hash: _________________
```
