# Agent Continuity Protocol (ACP)

> **Alternative name:** Project State Handoff (PSH)
> **Protocol version:** 1.0
> **Handoff date:** 2026-07-03 12:00:00 UTC
> **Repository:** `C:\Users\Sav-Dev\Documents\HACKATHON\QWENCLOUD\TRACK4`
> **Branch:** `main`
> **Last commit:** `894dff1` — docs: systems synthesis + handoff context for new agents

---

## 1. Purpose of This Document

This document establishes the complete project context for a new agent assuming responsibility for the ALTHR Autopilot repository. It contains:

- What has been built from inception to handoff
- The current state of the codebase, services, and infrastructure
- Architecture, key files, and decisions
- Known limitations and next steps
- A methodology for resuming work precisely from this point

A new agent should read this document in full before making any changes.

---

## 2. Project Identity

| Field | Value |
|---|---|
| **Project name** | ALTHR Autopilot |
| **Hackathon track** | Track 4 — AI-Native Server Operations Agent |
| **Cloud provider** | Alibaba Cloud (Qwen Cloud API) |
| **License** | MIT |
| **Status** | Days 1–9 complete; Day 10 (cloud deployment) deferred until submission-ready |
| **Strategy** | Local-first development via Docker Compose; Alibaba Cloud ECS only at final submission |

---

## 3. Completed Work (Day-by-Day)

### Day 1 — Project Scaffolding
- Initialized `backend/` Node.js project with Express, PostgreSQL, Redis, and Qwen SDK wiring.
- Created `frontend/` Next.js + TypeScript + Tailwind project.
- Added base documentation: README, build plan, gap analysis.

### Day 2 — Qwen Integration Foundation
- Built `qwen/client.js` for OpenAI-compatible DashScope API calls.
- Implemented `qwen/intent-parser.js` with structured JSON output.
- Added `qwen/action-planner.js` and `qwen/toolExecutor.js` for function calling.
- Created `qwen/confidence.js` for decision certainty scoring.

### Day 3 — Certainty Pipeline, SAF, Approvals, Telegram
- Built the 7-layer Security-by-Architecture Framework (`pipeline/saf.js`).
- Implemented certainty pipeline (`pipeline/certainty.js`) with confidence thresholds.
- Added approval system (`pipeline/approvals.js`) for human-in-the-loop actions.
- Created Telegram bot (`telegram/bot.js`) with 12 command handlers.
- Fixed the "Conversations API" misunderstanding: the project uses the **Responses API** with `previous_response_id`.

### Day 4 — PML Embeddings, Semantic Search, Redis Hot Cache
- Added `qwen/embeddings.js` for `text-embedding-v4` (1024 dimensions).
- Rewrote `memory/store.js` with PML layers M1–M7, semantic search, and Redis hot cache.
- Created `routes/memory.js` for memory CRUD and search.

### Day 5 — Learning Loop, Playbook Auto-Generation
- Built `memory/learning.js` for the organizational learning system.
- Added SOP auto-generation, reinforcement, and lookup.
- Implemented DQ trend and lessons endpoints (`routes/analytics.js`, `routes/learning.js`).

### Day 6 — Monitoring, Anomaly Detection, Streaming Diagnosis
- Created `monitors/monitor.js` for continuous monitoring and anomaly detection.
- Added routes for processes, ports, and Docker (`routes/processes.js`, `routes/ports.js`, `routes/docker.js`).
- Wired WebSocket alert feed into `server.js`.
- Installed `systeminformation` and `uuid` dependencies.

### Day 7 & 8 — Frontend Dashboard
- Built 10 dashboard pages: Overview, Agent Console, Monitoring, Deployments, Files, Security, Memory, Analytics, Settings.
- Wired all pages to backend APIs and WebSockets.
- Created reusable components: AgentConsole, ApprovalCard, charts, navigation.

### Day 9 — Telegram Polish + Integration Testing
- Updated Telegram bot with rich formatting and inline keyboards.
- Fixed import path issues (`saf`, `get_server_health`) and M3 schema `timestamp` column.
- Added Day 9 integration validation test.

### Post-Day-9 Documentation & Docker Fixes
- Corrected Alibaba Cloud free-tier information in `RESOURCE-REQUIREMENTS.html`.
- Created local-first deployment strategy.
- Built full Docker Compose stack (`docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`).
- Fixed missing tools (`list_containers`, `list_directory`, `get_server_health` export).
- Added frontend file editing capability.
- Created comprehensive pre-submission validation workflow.

---

## 4. Current State

### 4.1 Services

The project is designed to run via Docker Compose. As of handoff, Docker Desktop was not running on the host machine, but the stack can be started with:

```powershell
cd "C:\Users\Sav-Dev\Documents\HACKATHON\QWENCLOUD\TRACK4"
docker-compose up -d --build
```

Expected services:

| Service | Container | Port | Role |
|---|---|---|---|
| Backend | `althr-backend` | 3000 | Express API, WebSocket, Telegram bot, Qwen pipeline |
| Frontend | `althr-frontend` | 3001 | Next.js dashboard |
| PostgreSQL | `althr-postgres` | 5432 | Database with pgvector extension |
| Redis | `althr-redis` | 6379 | Hot cache and event stream |

### 4.2 Environment

`.env` file exists in `TRACK4/` and is gitignored. It contains:

- `QWEN_API_TRACK4` (legacy alias)
- `DASHSCOPE_API_KEY` (active Qwen API key)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHATID`
- `RESEND_API` (optional)
- `GITHUB_TOKEN` (optional)

Missing (deferred until cloud submission):
- `ALIBABA_CLOUD_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_ACCESS_KEY_SECRET`

### 4.3 Validation Status

All Day 3, 4, 5, 6, 9 validation tests pass when run inside the backend container:

```powershell
docker exec -i althr-backend node tests/day3-validation.js
docker exec -i althr-backend node tests/day4-validation.js
docker exec -i althr-backend node tests/day5-validation.js
docker exec -i althr-backend node tests/day6-validation.js
docker exec -i althr-backend node tests/day9-validation.js
```

### 4.4 Git State

- Branch: `main`
- Last commit: `dd56cfa`
- Working tree: clean (after removal of stray documentation artifacts)

---

## 5. Architecture Overview

### 5.1 Backend (`backend/src/`)

```
src/
├── server.js              # Express entry, WebSocket, Telegram start
├── config/
│   └── allowed-commands.js # SAF L4 command whitelist
├── db/
│   ├── pool.js            # PostgreSQL connection
│   ├── redis.js           # Redis connection
│   ├── schema.sql         # Database schema
│   └── init.js            # Schema initialization
├── qwen/
│   ├── client.js          # DashScope/OpenAI client
│   ├── intent-parser.js   # Intent extraction
│   ├── action-planner.js  # Tool plan generation
│   ├── toolExecutor.js    # Tool dispatch
│   ├── conversations.js   # Responses API + previous_response_id
│   ├── embeddings.js      # text-embedding-v4
│   ├── confidence.js      # Decision confidence
│   └── skills.js          # Tool definitions for Qwen
├── pipeline/
│   ├── orchestrator.js    # End-to-end agent pipeline
│   ├── saf.js             # 7-layer SAF
│   ├── certainty.js       # Certainty scoring
│   └── approvals.js       # Approval queue
├── memory/
│   ├── store.js           # PML memory store + semantic search
│   └── learning.js        # Learning loop, SOPs, DQ trend
├── monitors/
│   └── monitor.js         # Continuous monitoring + anomaly detection
├── routes/
│   ├── index.js           # Route aggregator
│   ├── agent.js           # NL command endpoint
│   ├── approvals.js       # Approve/reject endpoints
│   ├── audit.js           # Audit log endpoint
│   ├── memory.js          # Memory CRUD/search
│   ├── analytics.js       # DQ trend
│   ├── learning.js        # Lessons
│   ├── processes.js       # Process list
│   ├── ports.js           # Port list
│   ├── docker.js          # Docker container list
│   ├── command.js         # Direct command execution
│   ├── file.js            # File read/list/write
│   ├── deploy.js          # Deployment history
│   ├── security.js        # Audit + security scan
│   ├── server-health.js   # Server health metrics
│   └── health.js          # Basic health check
├── telegram/
│   └── bot.js             # Telegram bot with 12 commands
├── utils/
│   └── audit.js           # Immutable audit logging
└── tests/
    ├── day3-validation.js
    ├── day4-validation.js
    ├── day5-validation.js
    ├── day6-validation.js
    └── day9-validation.js
```

### 5.2 Frontend (`frontend/src/`)

```
src/
├── app/                   # Next.js App Router pages
│   ├── page.tsx           # Overview
│   ├── agent/page.tsx     # Agent Console
│   ├── monitoring/page.tsx
│   ├── deployments/page.tsx
│   ├── files/page.tsx
│   ├── security/page.tsx
│   ├── memory/page.tsx
│   ├── analytics/page.tsx
│   └── settings/page.tsx
├── components/
│   ├── AgentConsole.tsx
│   ├── ApprovalCard.tsx
│   └── ...
├── lib/
│   ├── api.ts             # REST API client
│   └── websocket.ts       # Socket.IO client
└── stores/
    └── agent-store.ts     # Zustand state
```

### 5.3 Data Flow

1. User sends NL command via frontend or Telegram.
2. Backend parses intent with Qwen.
3. Action planner selects tools.
4. SAF check runs (7 layers).
5. If low-risk + high-confidence, auto-execute; otherwise queue for approval.
6. Tool results are stored in PML memory and audit log.
7. Anomalies trigger monitoring alerts via WebSocket.

---

## 6. Key Decisions & Design Patterns

### 6.1 Qwen API Path
- Uses `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (OpenAI-compatible).
- Uses Responses API with `previous_response_id` for multi-turn context.
- Models: `qwen3.7-plus` for reasoning, `text-embedding-v4` for embeddings.

### 6.2 Memory Model (PML)
- M1: Raw events
- M2: Structured data
- M3: Operational SOPs
- M4: Execution traces
- M5: Decision records
- M6: Learning notes
- M7: Strategic insights

### 6.3 SAF Whitelist
- Read-only tools (`get_server_health`, `list_processes`, `check_ports`, `read_file`, `query_memory`) are inherently safe.
- Shell commands are whitelisted by prefix in `config/allowed-commands.js`.
- Mutating actions require approval unless auto-executed as low-risk.
- Direct admin file writes are allowed and audited (agent still uses full SAF).

### 6.4 Local-First Strategy
- All development and testing run in Docker Compose locally.
- Alibaba Cloud ECS deployment is deferred until submission-ready.
- Containerized PostgreSQL + Redis replace RDS/Redis for cost control.

---

## 7. Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| Frontend Settings page "Save" button does not persist to backend | UI-only threshold sliders | Low priority; thresholds are environment-driven |
| No real authentication/authorization | All users treated as admin | Acceptable for hackathon demo; use SAF for action control |
| Telegram bot starts automatically if token is present | May poll in local dev | Expected behavior |
| `GITHUB_TOKEN` and `RESEND_API` in `.env` are optional | Some features disabled if missing | Documented in local-first strategy |
| Alibaba Cloud not provisioned | Cannot satisfy live demo URL requirement yet | Deferred until submission |
| Day 9 frontend source check relies on HTTP fallback in containers | Test is container-aware | Validated via `http://althr-frontend:3001` |

---

## 8. Next Steps / Backlog

Priority order for a resuming agent:

1. **Restart the stack** and verify all services healthy.
2. **Run Day 3–9 validation tests** to confirm nothing regressed.
3. **Complete Day 10 — Alibaba Cloud Deployment:**
   - Create `backend/src/utils/alibaba.js` proof file.
   - Create `docker-compose.prod.yml` for ECS.
   - Provision ECS instance (free trial or pay-as-you-go).
   - Push to GitHub public repo.
   - Deploy to ECS and obtain live demo URL.
4. **Day 11 — README + Architecture Diagram + Demo Video:**
   - Polish README with screenshots and deployment instructions.
   - Create architecture diagram (PNG/SVG).
   - Record 3–5 minute demo video.
5. **Day 12 — Final Submission:**
   - Submit to Devpost with repo link, demo URL, and video.
   - Verify all submission requirements.

---

## 9. External Context Required Before Acting

Before making any code or architectural changes, the resuming agent must read and synthesize the following external context documents. These frameworks inform the long-term direction of the project.

| Document | Location | Why it matters |
|---|---|---|
| `CRDS_SPECIFICATION.md` | `SYSTEMS-FRAMEWORKS/` | Competitive reaction scoring and cascade veto patterns |
| `decision intelligence by claude.md` | `SYSTEMS-FRAMEWORKS/` | Warning against count-based decision allocation |
| `decision intelligence supply chain.md` | `SYSTEMS-FRAMEWORKS/` | Treating data as an information portfolio |
| `decision intelligence system by gpt.md` | `SYSTEMS-FRAMEWORKS/` | Decision mass, density, energy, and risk allocation |
| `disc2.md` | `SYSTEMS-FRAMEWORKS/` | 10-layer Decision Intelligence Supply Chain |
| `drev (3).md` | `SYSTEMS-FRAMEWORKS/` | Pairwise decision verification and resilience |
 | `DRE_SPECIFICATION.md` | `SYSTEMS-FRAMEWORKS/` | Iterative research engine for solution recommendation |
| `docs/SYSTEMS-SYNTHESIS.md` | `TRACK4/docs/` | Synthesis of the seven frameworks applied to ALTHR |
| `docs/SYSTEMS-INDEX.md` | `TRACK4/docs/` | Per-system grades, validation methods, domains, and real-life uses |

**Required output before proceeding:** The resuming agent must produce a short statement of belief summarizing:

1. What the seven frameworks have in common.
2. Which framework would most differentiate ALTHR in the hackathon.
3. Whether the current ALTHR architecture is the right foundation for these frameworks.

This statement should be added to the session notes or shared with the user before any implementation begins.

## 10. How to Resume Work

### 10.1 Quick Start

```powershell
# 1. Open the repository
cd "C:\Users\Sav-Dev\Documents\HACKATHON\QWENCLOUD\TRACK4"

# 2. Start Docker Desktop if not running
& "C:\Program Files\Docker\Docker\Docker Desktop.exe"

# 3. Start the stack
docker-compose up -d --build

# 4. Verify health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
curl http://localhost:3000/api/health

# 5. Run validation tests
docker exec -i althr-backend node tests/day3-validation.js
docker exec -i althr-backend node tests/day4-validation.js
docker exec -i althr-backend node tests/day5-validation.js
docker exec -i althr-backend node tests/day6-validation.js
docker exec -i althr-backend node tests/day9-validation.js

# 6. Open the dashboard
Start-Process "http://localhost:3001"
```

### 9.2 Before Any Code Change

1. Check this `HANDOFF.md` for current state.
2. Read `docs/deployment/local-first-strategy.md` for the active strategy.
3. Read `docs/deployment/pre-submission-validation.md` for the validation workflow.
4. Check `git status` and `git log` to match commit style.
5. Run the relevant Day validation test after changes.

### 9.3 Before Committing

```powershell
git status
git diff
git log
```

Use conventional commit style:

```
<type>: <short description>

<body>

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>
```

---

## 11. Methodology for Constructing Handoff Reports

To ensure precise continuation for any future agent, every handoff report should follow this structure:

### 10.1 Required Sections

1. **Protocol Metadata** — name, date, version, repository, branch, last commit.
2. **Purpose** — why the document exists and who should read it.
3. **Project Identity** — name, track, status, strategy.
4. **Completed Work** — chronological or feature-based summary.
5. **Current State** — services, environment, validation status, git state.
6. **Architecture Overview** — directory structure and data flow.
7. **Key Decisions** — patterns, model choices, API paths, security model.
8. **Known Limitations** — issues, workarounds, and priority.
9. **Next Steps** — ordered backlog for resuming work.
10. **Resume Instructions** — copy-paste commands to get back to a working state.
11. **Handoff Methodology** — instructions for creating the next handoff report.

### 10.2 Data Gathering Steps

Before writing a handoff report, the outgoing agent must:

1. Run `git log --oneline` and record the last commit hash.
2. Run `git status` to confirm working tree state.
3. Run `docker ps` to record service status.
4. Run all validation tests and record results.
5. Check `.env` for available keys (do not record values).
6. Review the most recent code changes via `git diff`.
7. Identify any uncommitted or stray files.

### 10.3 Naming Convention

- **Primary protocol name:** Agent Continuity Protocol (ACP)
- **Alternative name:** Project State Handoff (PSH)
- **File name:** `docs/HANDOFF.md`
- **Date format:** ISO 8601 — `YYYY-MM-DD HH:MM:SS UTC`

### 10.4 Sign-Off

The outgoing agent must update the handoff date and commit the document before transferring responsibility.

---

## 12. Contact & References

- **Support:** https://windsurf.com/support
- **Devin CLI docs:** invoke `skill devin-for-terminal`
- **Qwen Cloud docs:** https://docs.qwencloud.com
- **Alibaba Cloud Free Trial:** https://free.alibabacloud.com/

---

## 13. Sign-Off

| Field | Value |
|---|---|
| Handoff completed by | Devin (AI agent) |
| Handoff date | 2026-07-03 12:00:00 UTC |
| Commit hash | `894dff1` |
| Next expected action | Start Docker, run stack, proceed to Day 10 (Alibaba Cloud deployment) |

