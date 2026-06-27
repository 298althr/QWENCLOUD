# Track 4: Autopilot Agent — Comprehensive Build & Deploy Plan
**Hackathon:** Global AI Hackathon Series with Qwen Cloud  
**Track:** Track 4 — Autopilot Agent  
**Project Name:** **ALTHR Autopilot** — AI-Native Server Operations Agent  
**Window:** Jun 27, 2026 → Jul 9, 2026 (12 days)  

---

## 1. Project Identity

### Name
**ALTHR Autopilot** — *An AI agent that autonomously manages server infrastructure end-to-end, from natural language commands to automated remediation, with human-in-the-loop governance at every critical decision point.*

### One-Line Pitch
> "Server22 meets Qwen: a production-grade autopilot that perceives server state, reasons about anomalies, executes remediations, and learns from outcomes — all through a Telegram-first interface with a luxury dark-mode dashboard."

### Track 4 Fit Statement
The hackathon asks for: *"Build an Agent that automates real-world business workflows end-to-end... handle ambiguous inputs, invoke external tools, and incorporate human-in-the-loop checkpoints at critical decision points. Emphasis on production-readiness over toy demos."*

ALTHR Autopilot delivers:
- **Real-world workflow:** Server management (deployment, monitoring, security auditing, file operations, Docker builds)
- **Ambiguous inputs:** Natural language via Telegram → Qwen parses intent → routes to correct API
- **External tools:** 12+ existing API endpoints + Qwen custom skills + Alibaba Cloud APIs
- **Human-in-the-loop:** Certainty-Driven Decision Pipeline (7-stage) with explicit authorization gates
- **Production-readiness:** Dockerized, deployed on Alibaba Cloud, with audit logging and security-by-architecture

---

## 1B. Stay-in-Line Compliance Instructions

> **RULE:** Read this section at the start of every build session. If any work deviates from these constraints, stop and realign immediately. The hackathon rules are non-negotiable. Disqualification is worse than a missed feature.

### Hard Requirements from Official Rules (QWEN-CLOUD.txt)

| # | Requirement | Source | Status | Verification |
|---|---|---|---|---|
| R1 | **Must use Qwen models from Qwen Cloud** | §4 Project Requirements | ☐ | `DASHSCOPE_API_KEY` set; all LLM calls go to `dashscope-intl.aliyuncs.com` |
| R2 | **Must deploy backend on Alibaba Cloud** | §4 Submission Requirements | ☐ | Code file in repo showing Alibaba Cloud SDK usage (ECS/OSS/CloudMonitor) |
| R3 | **Public GitHub repo with open-source license** | §4 Submission Requirements | ☐ | License file in root; "MIT" visible in repo About section |
| R4 | **Text description explaining features** | §4 Submission Requirements | ☐ | Devpost submission text field completed |
| R5 | **Architecture diagram (visual)** | §4 Submission Requirements | ☐ | PNG/PDF in repo + Devpost; shows Qwen → backend → DB → frontend |
| R6 | **Demo video ≤3 minutes** | §4 Submission Requirements | ☐ | Uploaded to YouTube/Vimeo/Youku; link in Devpost |
| R7 | **Working demo accessible to judges** | §4 Testing | ☐ | Public URL + login creds in testing instructions |
| R8 | **Track selection: Track 4 — Autopilot Agent** | §4 Submission Requirements | ☐ | Selected on Devpost submission form |
| R9 | **Must be original work** | §7 IP Rights | ☐ | No third-party code without attribution/license |
| R10 | **Must be in English** | §4 Language Requirements | ☐ | All submission materials in English |
| R11 | **Must function as depicted in video** | §4 Functionality | ☐ | Video shows real working product, not mockups |
| R12 | **Project significantly updated during hackathon** | §4 New & Existing | ☐ | Git commit history shows work after May 26, 2026 |

### Judging Criteria Alignment Check

| Criterion | Weight | Our Score Target | How We Hit It | Check Before Submitting |
|---|---|---|---|---|
| **Innovation & AI Creativity** | 30% | 28/30 | Qwen function calling (12 tools), thinking mode for diagnosis, structured output for DQS, Conversations API for cross-device, MCP server, Batch API | Demo shows Qwen calling tools + thinking mode reasoning chain live |
| **Technical Depth & Engineering** | 30% | 27/30 | 7-layer SAF, Certainty-Driven Pipeline, PML 7-tier memory, WebSocket streaming, Docker on Alibaba Cloud, immutable audit logging | Architecture diagram shows all layers; code is clean and modular |
| **Problem Value & Impact** | 25% | 22/25 | Real server management (not toy), production-ready, open-source potential, scalable to multi-server fleets | Demo solves a real DevOps problem end-to-end |
| **Presentation & Documentation** | 15% | 14/15 | Architecture diagram, 3-min demo video, comprehensive README, Luxury Dark Mode dashboard, blog post | Video is polished; README has setup + screenshots |

### Stage One Pass/Fail Gate

Stage One checks: Does the project reasonably fit Track 4 and reasonably apply Qwen Cloud APIs?
- ☐ Track 4 fit: Automates real-world business workflows end-to-end ✓
- ☐ Qwen Cloud usage: Chat Completions + Function Calling + Thinking + Embeddings + Conversations + Structured Output ✓
- ☐ Alibaba Cloud deployment proof: Code file with SDK calls ✓

**If any of these fail, the submission does not advance to Stage Two. Verify before Day 12.**

### Anti-Deviation Rules for the Build Team

1. **No scope creep.** The 8 features in Section 2 are the final feature set. New ideas go in a `FUTURE.md` file, not into the build.
2. **No alternative LLMs.** All reasoning goes through Qwen Cloud API. No OpenAI, no Anthropic, no local models. Only Qwen.
3. **No skipping Alibaba Cloud.** Even if local dev works perfectly, the submission requires Alibaba Cloud proof. Deploy by Day 10.
4. **No proprietary code.** Everything in the public repo must be open-source licensed. Third-party deps must have compatible licenses.
5. **No fake demos.** The video shows the real working product. No mockups, no pre-recorded API responses.
6. **No missing submission components.** Check the submission checklist (Section 12) every day from Day 10 onward.
7. **English only.** All code comments, README, video narration, Devpost text — all in English.
8. **3-minute video hard cap.** Judges are not required to watch beyond 3 minutes. Keep it under.
9. **Blog post is bonus.** Write it only if Days 11-12 are on track. Don't sacrifice submission quality for blog post.
10. **Submit early.** Target Day 12 morning. Do not wait until 1:59 PM Pacific on July 9.

---

## 2. Selling Points & Key Features

### Feature 1: Natural Language Server Operations (NL-SOP)
**What:** Users send natural language messages via Telegram or the web dashboard. Qwen parses intent, decomposes into multi-step action plans, and executes against server APIs.

**Why it wins:** Eliminates the need to memorize CLI commands or API endpoints. "Restart the Node process and check if port 3000 is free" becomes a single message.

**Underlying systems:** Server22 API layer (`/api/command`, `/api/processes`, `/api/ports`), Qwen **function calling** (Chat Completions API with `tools` parameter, `parallel_tool_calls`, `tool_choice` for forced SAF checks)

### Feature 2: Autonomous Anomaly Remediation (AAR)
**What:** Continuous monitoring detects anomalies (CPU spikes, process crashes, port conflicts, disk pressure). Qwen diagnoses root cause using **thinking mode** (`enable_thinking: true`, `thinking_budget: 2000`), proposes remediation via **structured output** (`response_format: { type: "json_object" }`), and executes — but only after passing through the Certainty-Driven Pipeline's confidence gate.

**Why it wins:** Most monitoring tools alert you. ALTHR Autopilot alerts you *and* fixes the problem, with a paper trail. The reasoning chain is visible in real-time on the dashboard via **streaming** (`stream: true` — `reasoning_content` streamed separately from `content`).

**Underlying systems:** ADCOS Layer 1 (Sensing) + Layer 3 (Decision Intelligence) + Certainty-Driven Pipeline Stages 1-7 + Qwen thinking mode (`qwen3.7-max` for complex diagnosis)

### Feature 3: One-Command Deployments (OCD)
**What:** "Deploy the app from GitHub repo X with Docker, expose on port 8080, and set up health checks." Qwen generates the Dockerfile/compose, clones the repo, builds the image, deploys, and verifies — all from one message.

**Why it wins:** Turns a 15-minute manual DevOps ritual into a 30-second conversation.

**Underlying systems:** Server22 Docker Build System + GitHub Integration (`/api/git/clone`, `/api/docker/*`) + UDIT pipeline (Input → Interpretation → Validation → Human Review → Decision → Execution → Audit → Learning)

### Feature 4: Memory-Driven Intelligence (MDI)
**What:** The agent remembers every command, every outcome, every error. Over sessions, it learns which remediations work for which alert patterns, and proactively suggests fixes before you ask. Uses **Qwen Conversations API** for cross-device session continuity (Telegram ↔ dashboard) and **`text-embedding-v4`** for semantic memory search.

**Why it wins:** This is the Track 4 differentiator. Most agents are stateless. ALTHR Autopilot has a 7-layer memory system with server-managed context via Qwen's Conversations API (`conversation` parameter — no manual message array management).

**Underlying systems:** PML (Performance Memory Layer) — M1 Raw Event, M2 Structured Data, M3 Operational (SOPs/runbooks), M4 Execution (actions/costs), M5 Decision (context/alternatives/confidence), M6 Learning (errors/drift/improvements), M7 Strategic (regime changes/major wins) + Qwen Conversations API + `text-embedding-v4` (1024 dimensions)

### Feature 5: Security-by-Architecture Governance (SAG)
**What:** Every action passes through a 7-layer security framework before execution. Asset classification → identity verification → network segmentation check → policy enforcement → immutable logging → containment → governance compliance. Actions that fail any layer are blocked and escalated.

**Why it wins:** Demonstrates production-grade safety, not a toy demo. Judges explicitly weight "architecture quality" and "error handling."

**Underlying systems:** SAF (Security-by-Architecture Framework) + Server22 Security Audit System (RKHunter, Lynis, audit logs)

### Feature 6: Decision Quality Scoring (DQS)
**What:** Every action the agent takes is scored on Decision Quality = f(Information Quality, Model Quality, Reasoning Quality, Execution Quality, Learning Quality). Qwen returns scores via **structured output** (`response_format: { type: "json_object" }`). Low-DQ actions require human approval; high-DQ actions can auto-execute.

**Why it wins:** Makes the human-in-the-loop checkpoint *intelligent* rather than arbitrary. Shows sophisticated AI governance.

**Underlying systems:** DQS framework + Certainty-Driven Pipeline Stage 6 (Confidence Scoring) + Qwen structured output (guaranteed valid JSON)

### Feature 7: Audit Trail & Learning Loop (ATLL)
**What:** Every action is logged immutably with: timestamp, trigger, reasoning chain, confidence score, human approval status, execution result, and outcome. The agent periodically reviews its own audit trail to update its remediation playbooks.

**Why it wins:** Closes the loop. The agent gets better over time. This is "continuous learning" made visible.

**Underlying systems:** Organizational Learning System (Action → Outcome → Measurement → Error Detection → Model Update → Policy Update → New Action) + PML M6 Learning Memory

### Feature 8: Multi-Channel Interface (Telegram + Web Dashboard)
**What:** Full functionality via Telegram bot (mobile-first, instant) and a luxury dark-mode web dashboard (desktop, visual). Both channels share the same Qwen **Conversations API** session — start a command on Telegram, continue on the dashboard with full context preserved.

**Why it wins:** Shows production thinking — real operators use phones on the go and desktops at their desk. Cross-device continuity via Qwen's server-managed conversations (no manual context syncing).

**Underlying systems:** Server22 Telegram bot + `control-panel-complete.html` (redesigned with Luxury Dark Mode design tokens) + Qwen Conversations API (`conversation` parameter for cross-device sessions)

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER INTERFACES                              │
│                                                                  │
│  ┌──────────────┐     ┌──────────────────────────┐              │
│  │  Telegram Bot │     │  Web Dashboard (Next.js)  │              │
│  │  (Mobile)     │     │  Luxury Dark Mode         │              │
│  └──────┬───────┘     └──────────┬───────────────┘              │
│         │                         │                              │
└─────────┼─────────────────────────┼──────────────────────────────┘
          │                         │
          ▼                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY LAYER                             │
│  Express.js + WebSocket (port 3000)                              │
│  Routes: /api/agent, /api/command, /api/file/*, /api/docker/*,  │
│          /api/health, /api/processes, /api/ports, /api/audit,   │
│          /api/deployments, /api/memory/*                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              QWEN AI REASONING ENGINE                            │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐          │
│  │ Intent Parser│  │ Action Planner│  │ Confidence Scorer│         │
│  │ (Qwen)       │  │ (Qwen + Tools)│  │ (DQS Formula)    │         │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────┘          │
│         │                │                    │                  │
│         ▼                ▼                    ▼                  │
│  ┌─────────────────────────────────────────────────┐            │
│  │        CERTAINTY-DRIVEN DECISION PIPELINE         │            │
│  │  Problem → Context → Constraints → Intent →      │            │
│  │  Expert Validation → Confidence → Authorization  │            │
│  └──────────────────────┬──────────────────────────┘            │
│                         │                                        │
│          ┌──────────────┼──────────────┐                        │
│          ▼              ▼              ▼                        │
│     [Auto-Execute]  [Human Approval]  [Block + Escalate]       │
└─────────────────────────┼────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              EXECUTION & TOOL LAYER                              │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐       │
│  │ Command   │ │ File Mgmt│ │ Docker   │ │ GitHub Clone │       │
│  │ Executor  │ │ (fs)     │ │ Build    │ │ (git)        │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐       │
│  │ Process   │ │ Port     │ │ Deploy   │ │ Security     │       │
│  │ Monitor   │ │ Monitor  │ │ Script   │ │ Audit        │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              SECURITY-BY-ARCHITECTURE (SAF)                      │
│  L1: Asset Classification → L2: Identity/Authority →            │
│  L3: Network Segmentation → L4: Policy Enforcement →            │
│  L5: Immutable Logging → L6: Containment → L7: Governance       │
│  (Every action passes through all 7 layers before execution)    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              MEMORY & LEARNING LAYER (PML)                       │
│                                                                  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │
│  │ M1: Raw   │  │ M2:       │  │ M3:       │  │ M4:       │    │
│  │ Events    │  │ Structured│  │ Operational│  │ Execution │    │
│  │ (logs)    │  │ (PG tables)│  │ (SOPs)    │  │ (actions) │    │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │
│  ┌───────────┐  ┌───────────┐  ┌───────────────────────┐      │
│  │ M5:       │  │ M6:       │  │ M7: Strategic         │      │
│  │ Decision  │  │ Learning  │  │ (regime changes,      │      │
│  │ Memory    │  │ Memory    │  │  major wins/losses)   │      │
│  └───────────┘  └───────────┘  └───────────────────────┘      │
│                                                                  │
│  Storage: PostgreSQL (structured) + Redis (hot recall)          │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              ALIBABA CLOUD DEPLOYMENT                            │
│  ECS Instance (Ubuntu) → Docker → Express + Qwen Proxy          │
│  OSS (object storage for logs/backups)                          │
│  Cloud Monitor (external health checks)                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. UI Feature Accessibility Map

### Web Dashboard — Navigation Tree

```
ALTHR AUTOPILOT DASHBOARD
│
├── 🏠 HOME / OVERVIEW
│   ├── Server Health Summary (CPU, RAM, Disk, Uptime)
│   ├── Active Agent Sessions (count, status)
│   ├── Recent Actions (last 10 with DQ scores)
│   ├── Pending Human Approvals (count, urgency)
│   └── System Status Indicators (API, DB, Redis, Qwen)
│
├── 🤖 AGENT CONSOLE
│   ├── Natural Language Input Bar
│   ├── Active Reasoning Chain (live display of:
│   │   ├── Intent Parsed
│   │   ├── Action Plan Generated
│   │   ├── Confidence Score
│   │   ├── SAF Layer Checks (7 layers, pass/fail)
│   │   └── Awaiting Approval / Executing / Complete
│   ├── Action History (scrollable, filterable)
│   └── Cancel / Override Button (human override)
│
├── 📊 MONITORING
│   ├── Processes (real-time table, sortable)
│   ├── Ports (listening ports, PID, protocol)
│   ├── Resource Graphs (CPU, RAM, Disk over time)
│   ├── Docker Containers (status, images, ports)
│   └── Alert Feed (anomalies detected by agent)
│
├── 🚀 DEPLOYMENTS
│   ├── New Deployment (NL input → auto-generate Dockerfile)
│   ├── Deployment History (table: repo, status, timestamp)
│   ├── Active Deployments (running containers)
│   └── Rollback (one-click, with confirmation gate)
│
├── 📁 FILE MANAGER
│   ├── Directory Browser (tree view)
│   ├── File Editor (inline, with save)
│   ├── Upload / Download
│   └── Permission Viewer
│
├── 🔒 SECURITY
│   ├── Audit Log (immutable, searchable)
│   ├── RKHunter Scan Results (last scan, findings)
│   ├── Lynis Scan Results (hardening score)
│   ├── SAF Layer Status (7 layers, all green/red)
│   └── Blocked Actions Log (actions that failed SAF)
│
├── 🧠 MEMORY & LEARNING
│   ├── M1: Raw Events (log stream)
│   ├── M2: Structured Data (queryable tables)
│   ├── M3: Operational Memory (SOPs, runbooks)
│   ├── M4: Execution Memory (action → cost tracking)
│   ├── M5: Decision Memory (context, alternatives, confidence)
│   ├── M6: Learning Memory (errors, drift, improvements)
│   ├── M7: Strategic Memory (regime changes, major events)
│   └── Learning Curve Chart (DQ score trend over time)
│
├── ⚙️ SETTINGS
│   ├── Agent Configuration
│   │   ├── Confidence Threshold (slider: auto-execute vs. require approval)
│   │   ├── Allowed Commands (whitelist editor)
│   │   ├── Timeout Settings (per action type)
│   │   └── Qwen Model Selection (Qwen-Plus, Qwen-Max, etc.)
│   ├── SAF Policy Editor
│   │   ├── Asset Classification Rules
│   │   ├── Identity/Authority Rules
│   │   └── Policy Enforcement Rules
│   ├── Notification Preferences (Telegram, Email, Dashboard)
│   ├── API Keys (Qwen, Resend, GitHub — masked)
│   └── Alibaba Cloud Config (ECS, OSS, Cloud Monitor)
│
└── 📈 ANALYTICS
    ├── Decision Quality Dashboard (DQ scores over time)
    ├── Agent Performance Metrics (success rate, avg confidence)
    ├── Remediation Effectiveness (fix success per anomaly type)
    ├── Execution Cost Tracking (time, resources per action)
    └── Learning Rate Chart (improvement velocity)
```

### Telegram Bot — Command Map

```
TELEGRAM INTERFACE
│
├── /start — Initialize session, show capabilities
├── /status — Server health summary (inline buttons)
│
├── Natural Language (free text) → Qwen parses intent
│   ├── "restart nginx" → Command Executor
│   ├── "deploy repo X" → Deployment Pipeline
│   ├── "what's using port 3000?" → Port Monitor
│   ├── "scan for rootkits" → Security Audit
│   ├── "show last 10 errors" → Audit Log
│   ├── "free up disk space" → File Manager + Command
│   └── "backup the database" → Deployment + File
│
├── /approve <action_id> — Approve pending human-in-the-loop action
├── /reject <action_id> — Reject pending action (with reason prompt)
├── /memory — View recent memory entries (M1-M7)
├── /security — Run security scan (RKHunter + Lynis)
├── /deploy <repo_url> — Quick deploy shortcut
├── /containers — List Docker containers
├── /logs <type> — View logs (deploy, build, runtime, server, audit)
├── /config — View/edit agent configuration
├── /analytics — View DQ scores and performance metrics
└── /cancel — Cancel currently executing action
```

### Accessibility Flow (User Journey)

```
User sends "CPU is at 95%, fix it"
        │
        ▼
┌─ Telegram ──────────────────────────────────────────────┐
│  Bot receives message                                   │
│  → Forwarded to Qwen Intent Parser                      │
│  → Qwen returns: { intent: "remediate_high_cpu",        │
│                    params: { threshold: 95 } }           │
│  → Action Planner generates 3-step plan:                │
│     1. Get top processes by CPU                         │
│     2. Identify anomalous process                       │
│     3. Kill or restart (requires approval)              │
│  → Confidence Scorer: 0.72 (medium)                     │
│  → Certainty Pipeline: Stage 7 = Authorization needed   │
│  → Telegram sends: "Plan ready. Approve?"               │
│     with [✅ Approve] [❌ Reject] [📝 Modify] buttons   │
│                                                         │
│  User taps [✅ Approve]                                 │
│  → SAF layers 1-7 execute                               │
│  → Action executed                                      │
│  → Result logged to M4 (Execution Memory)               │
│  → Outcome evaluated → M6 (Learning Memory)             │
│  → Telegram sends: "Done. CPU now 23%. Killed process   │
│     X (PID 1234). Logged as action #567."               │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Technology Stack

| Layer | Technology | Justification |
|---|---|---|
| AI Engine — Default | `qwen3.7-plus` via OpenAI-compatible Chat Completions API | Balanced speed/quality; required by hackathon |
| AI Engine — Complex | `qwen3.7-max` with `enable_thinking: true`, `thinking_budget: 2000` | Root cause diagnosis, multi-step remediation planning |
| AI Engine — Fast | `qwen3.6-flash` | Quick status checks, simple commands (cost-efficient) |
| AI Engine — Embeddings | `text-embedding-v4` (1024 dimensions) | Memory vectorization for semantic search across PML layers |
| AI Engine — Conversations | Qwen Conversations API (`conversation` parameter) | Cross-device session continuity (Telegram ↔ dashboard) |
| AI Engine — Structured Output | `response_format: { type: "json_object" }` | Guaranteed valid JSON for action plans, DQS scores, audit entries |
| AI Engine — Context Cache | Implicit cache (automatic, 80% savings on cached tokens) | Static system prompts (agent instructions + SAF rules) cached across calls |
| AI Engine — MCP | MCP server via Responses API (`tools: [{ type: "mcp", ... }]`) | Server ops tools exposed as MCP for extensibility |
| Qwen SDK | `openai` npm package with `baseURL: https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | OpenAI-compatible — 3-parameter migration |
| API Key | `DASHSCOPE_API_KEY` env var (key starts with `sk-`) | Qwen Cloud authentication |
| Backend | Node.js + Express | Existing Server22 codebase |
| Frontend | Next.js + TypeScript + Tailwind CSS | Upgrade from vanilla HTML; Luxury Dark Mode |
| State Management | Zustand | Lightweight, already used in Brotherly |
| Database | PostgreSQL (Alibaba Cloud RDS) | Structured memory (M2, M4, M5) |
| Cache/Hot Memory | Redis (Alibaba Cloud Redis) | M1 raw events, session state |
| Containerization | Docker + Docker Compose | Already in Server22 stack |
| Cloud Provider | Alibaba Cloud ECS + OSS + Cloud Monitor | Required by hackathon |
| Bot Interface | Telegram Bot API | Already integrated in Server22 |
| Email Notifications | Resend API | Already integrated |
| Auth | Tailscale + TOTP | Already used in admin-office |
| Logging | Winston + immutable audit log file | Server22 log infrastructure |
| Process Manager | PM2 | Planned in Server22 roadmap |
| Real-time | WebSocket (Socket.io) | Dashboard live updates; streams Qwen `reasoning_content` + `content` separately |
| Charts | Chart.js or Recharts | Already used; DQ score visualization |

---

## 5B. Database Schema (PostgreSQL)

```sql
-- ============================================================
-- ALTHR AUTOPILOT — PostgreSQL Schema for PML + Audit + Auth
-- ============================================================

-- Enable pgvector extension (fallback if OpenSearch unavailable)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- PML MEMORY TABLES (7 LAYERS)
-- ============================================================

-- M1: Raw Event Memory — high-frequency logs, short retention
CREATE TABLE m1_raw_events (
    id          SERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type  VARCHAR(50) NOT NULL,          -- 'cpu_spike', 'process_crash', 'port_conflict', etc.
    raw_data    JSONB NOT NULL,                -- raw event payload
    severity    VARCHAR(20) DEFAULT 'info',    -- 'info', 'warning', 'critical'
    resolved    BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_m1_timestamp ON m1_raw_events(timestamp DESC);
CREATE INDEX idx_m1_event_type ON m1_raw_events(event_type);
CREATE INDEX idx_m1_unresolved ON m1_raw_events(resolved) WHERE resolved = FALSE;

-- M2: Structured Data Memory — server state snapshots, configs
CREATE TABLE m2_structured_data (
    id              SERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source          VARCHAR(100) NOT NULL,     -- 'server_health', 'process_list', 'port_scan'
    structured_json JSONB NOT NULL,
    server_id       VARCHAR(50) DEFAULT 'default'
);
CREATE INDEX idx_m2_source ON m2_structured_data(source);
CREATE INDEX idx_m2_timestamp ON m2_structured_data(timestamp DESC);

-- M3: Operational Memory — SOPs, runbooks, remediation playbooks
CREATE TABLE m3_operational (
    id            SERIAL PRIMARY KEY,
    sop_name      VARCHAR(200) NOT NULL,
    trigger       VARCHAR(200) NOT NULL,       -- what condition activates this SOP
    steps_json    JSONB NOT NULL,              -- ordered list of steps
    success_count INTEGER DEFAULT 0,
    fail_count    INTEGER DEFAULT 0,
    last_used     TIMESTAMPTZ,
    last_updated  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    auto_generated BOOLEAN DEFAULT FALSE       -- true if agent created this from learning
);
CREATE INDEX idx_m3_trigger ON m3_operational(trigger);

-- M4: Execution Memory — every action the agent takes
CREATE TABLE m4_execution (
    id             SERIAL PRIMARY KEY,
    action_id      VARCHAR(50) UNIQUE NOT NULL, -- 'act_001', 'act_002', etc.
    timestamp      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action_type    VARCHAR(50) NOT NULL,        -- 'command', 'docker_build', 'git_clone', 'security_scan'
    action_detail  TEXT NOT NULL,               -- what was executed
    resource_cost  JSONB,                       -- {cpu_seconds, memory_mb, disk_mb}
    time_cost_ms   INTEGER,                     -- execution time in milliseconds
    result         VARCHAR(20) NOT NULL,        -- 'success', 'failure', 'timeout', 'blocked'
    result_detail  TEXT,
    saf_passed     BOOLEAN NOT NULL,
    human_approved BOOLEAN DEFAULT FALSE,
    approved_by    VARCHAR(100),
    approved_at    TIMESTAMPTZ
);
CREATE INDEX idx_m4_timestamp ON m4_execution(timestamp DESC);
CREATE INDEX idx_m4_action_type ON m4_execution(action_type);
CREATE INDEX idx_m4_result ON m4_execution(result);

-- M5: Decision Memory — context, alternatives, confidence for each decision
CREATE TABLE m5_decision (
    id               SERIAL PRIMARY KEY,
    action_id        VARCHAR(50) REFERENCES m4_execution(action_id),
    timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    context          TEXT NOT NULL,             -- what was the situation
    alternatives_json JSONB NOT NULL,           -- what other actions were considered
    confidence       DECIMAL(4,3) NOT NULL,     -- 0.000 to 1.000
    dq_score         DECIMAL(5,2),              -- 0 to 100
    chosen_action    TEXT NOT NULL,
    reasoning        TEXT,                      -- Qwen thinking mode output
    risk_level       VARCHAR(10) NOT NULL       -- 'low', 'medium', 'high'
);
CREATE INDEX idx_m5_confidence ON m5_decision(confidence);
CREATE INDEX idx_m5_timestamp ON m5_decision(timestamp DESC);

-- M6: Learning Memory — errors, drift, improvements (with vector embeddings)
CREATE TABLE m6_learning (
    id               SERIAL PRIMARY KEY,
    action_id        VARCHAR(50) REFERENCES m4_execution(action_id),
    timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_type       VARCHAR(100),              -- 'misdiagnosis', 'timeout', 'wrong_command'
    drift            DECIMAL(4,3),              -- confidence drift since last similar action
    improvement_note TEXT NOT NULL,             -- what was learned
    pattern_hash     VARCHAR(64),               -- MD5 of normalized pattern for dedup
    embedding        vector(1024),              -- text-embedding-v4 vector for semantic search
    reinforcement_count INTEGER DEFAULT 0       -- how many times this pattern was confirmed
);
CREATE INDEX idx_m6_error_type ON m6_learning(error_type);
CREATE INDEX idx_m6_pattern_hash ON m6_learning(pattern_hash);
-- Vector index for semantic search (pgvector)
CREATE INDEX idx_m6_embedding ON m6_learning USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- M7: Strategic Memory — regime changes, major wins/losses (with vector embeddings)
CREATE TABLE m7_strategic (
    id          SERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type  VARCHAR(100) NOT NULL,          -- 'regime_change', 'major_win', 'major_loss', 'policy_update'
    description TEXT NOT NULL,
    impact      VARCHAR(20) NOT NULL,           -- 'positive', 'negative', 'neutral'
    impact_score INTEGER,                       -- -10 to +10
    embedding   vector(1024)
);
CREATE INDEX idx_m7_event_type ON m7_strategic(event_type);
CREATE INDEX idx_m7_timestamp ON m7_strategic(timestamp DESC);

-- ============================================================
-- AUDIT LOG — IMMUTABLE
-- ============================================================

CREATE TABLE audit_log (
    id              SERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    operation       VARCHAR(20) NOT NULL,       -- 'create', 'read', 'update', 'delete', 'execute', 'block'
    actor           VARCHAR(100) NOT NULL,      -- 'agent', 'human:username', 'system'
    target          TEXT NOT NULL,              -- what was affected
    target_type     VARCHAR(50) NOT NULL,       -- 'memory', 'command', 'file', 'container', 'process'
    reasoning       TEXT,                       -- why this action was taken
    confidence      DECIMAL(4,3),
    saf_result      JSONB,                      -- {l1: 'pass', l2: 'pass', ..., l7: 'pass'}
    result          VARCHAR(20) NOT NULL,
    ip_address      INET,
    -- Immutable: no UPDATE or DELETE allowed (enforce via trigger)
    CONSTRAINT no_update CHECK (true)           -- placeholder; enforce via trigger
);

-- Trigger: prevent UPDATE and DELETE on audit_log
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is immutable: UPDATE and DELETE are not allowed';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_audit_update BEFORE UPDATE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
CREATE TRIGGER no_audit_delete BEFORE DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_operation ON audit_log(operation);
CREATE INDEX idx_audit_target_type ON audit_log(target_type);

-- ============================================================
-- USERS & AUTH
-- ============================================================

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    totp_secret     VARCHAR(255),
    role            VARCHAR(20) DEFAULT 'admin', -- 'admin', 'operator', 'viewer'
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login      TIMESTAMPTZ
);

CREATE TABLE sessions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    token           VARCHAR(500) UNIQUE NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ============================================================
-- CONVERSATIONS (Qwen Conversations API mapping)
-- ============================================================

CREATE TABLE qwen_conversations (
    id              SERIAL PRIMARY KEY,
    conversation_id VARCHAR(200) UNIQUE NOT NULL,  -- Qwen conversation ID
    user_id         INTEGER REFERENCES users(id),
    source          VARCHAR(20) NOT NULL,          -- 'telegram', 'dashboard'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_qwen_conv_user ON qwen_conversations(user_id);
```

---

## 5C. Framework Code Stubs

### SAF — Security-by-Architecture (7-Layer Check)

```javascript
// backend/src/pipeline/saf.js

const SAF_LAYERS = [
  { id: 'L1', name: 'Asset Classification', description: 'Classify the target asset criticality' },
  { id: 'L2', name: 'Identity & Authority', description: 'Verify user identity and authority level' },
  { id: 'L3', name: 'Network Segmentation', description: 'Check network isolation and access paths' },
  { id: 'L4', name: 'Policy Enforcement', description: 'Validate against allowed-actions policy' },
  { id: 'L5', name: 'Immutable Logging', description: 'Ensure action will be logged immutably' },
  { id: 'L6', name: 'Containment', description: 'Verify blast radius is contained' },
  { id: 'L7', name: 'Governance', description: 'Check governance compliance and approval' },
];

async function safCheck(action, target, riskLevel, userId) {
  const results = {};
  let allPassed = true;

  // L1: Asset Classification
  const assetClass = classifyAsset(target); // 'critical', 'important', 'non-critical'
  results.L1 = {
    passed: assetClass !== 'critical' || riskLevel === 'low',
    detail: `Asset classified as: ${assetClass}`,
  };
  if (!results.L1.passed) allPassed = false;

  // L2: Identity & Authority
  const user = await getUser(userId);
  results.L2 = {
    passed: user && user.role === 'admin',
    detail: `User: ${user?.username}, Role: ${user?.role}`,
  };
  if (!results.L2.passed) allPassed = false;

  // L3: Network Segmentation
  results.L3 = {
    passed: isLocalExecution(target),
    detail: 'Execution is local to server',
  };
  if (!results.L3.passed) allPassed = false;

  // L4: Policy Enforcement
  const allowed = isCommandAllowed(action);
  results.L4 = {
    passed: allowed,
    detail: allowed ? 'Command is in whitelist' : 'Command NOT in whitelist',
  };
  if (!results.L4.passed) allPassed = false;

  // L5: Immutable Logging
  results.L5 = {
    passed: true, // audit_log table with immutability trigger
    detail: 'Audit log entry will be created',
  };

  // L6: Containment
  results.L6 = {
    passed: riskLevel !== 'high' || assetClass === 'non-critical',
    detail: `Blast radius: ${riskLevel} risk on ${assetClass} asset`,
  };
  if (!results.L6.passed) allPassed = false;

  // L7: Governance
  const needsApproval = riskLevel !== 'low' || confidence < 0.85;
  results.L7 = {
    passed: !needsApproval || humanApproved,
    detail: needsApproval ? 'Requires human approval' : 'Auto-approved (low risk, high confidence)',
  };
  if (!results.L7.passed) allPassed = false;

  return { passed: allPassed, layers: results, riskLevel, assetClass };
}

function classifyAsset(target) {
  const critical = ['nginx', 'postgres', 'redis', 'docker', 'sshd'];
  const important = ['node', 'pm2', 'nginx-worker'];
  if (critical.some(c => target.includes(c))) return 'critical';
  if (important.some(c => target.includes(c))) return 'important';
  return 'non-critical';
}

function isCommandAllowed(command) {
  const whitelist = [
    'ls', 'ps', 'top', 'htop', 'cat', 'grep', 'tail', 'head', 'wc',
    'docker ps', 'docker logs', 'docker stats', 'docker inspect',
    'git clone', 'git pull', 'git status',
    'rkhunter', 'lynis', 'systemctl status',
    'kill', 'restart', 'free', 'df', 'du', 'netstat', 'ss',
  ];
  return whitelist.some(w => command.startsWith(w));
}

module.exports = { safCheck, SAF_LAYERS };
```

### Certainty-Driven Decision Pipeline (7-Stage)

```javascript
// backend/src/pipeline/certainty.js

const STAGES = [
  'problem_definition',
  'context_identification',
  'constraint_mapping',
  'intent_clarification',
  'expert_validation',
  'confidence_scoring',
  'execution_authorization',
];

async function runCertaintyPipeline({ userMessage, serverState, qwenClient }) {
  const pipelineResult = {
    stages: {},
    confidence: 0,
    authorized: false,
    action: null,
  };

  // Stages 1-5: Use Qwen thinking mode to reason through the problem
  const thinkingResponse = await qwenClient.chat.completions.create({
    model: 'qwen3.7-max',
    messages: [
      {
        role: 'system',
        content: `You are the Certainty-Driven Decision Pipeline. Analyze the user request through these stages:
1. Problem Definition: What is being asked?
2. Context Identification: What server state is relevant?
3. Constraint Mapping: What limits apply (SAF, timeouts, permissions)?
4. Intent Clarification: What does the user actually want?
5. Expert Validation: Does the proposed action make sense?

Current server state: ${JSON.stringify(serverState)}

Return your reasoning for each stage.`,
      },
      { role: 'user', content: userMessage },
    ],
    enable_thinking: true,
    thinking_budget: 1500,
    preserve_thinking: true,
  });

  pipelineResult.stages.thinking = thinkingResponse.choices[0].message.reasoning_content;
  pipelineResult.stages.answer = thinkingResponse.choices[0].message.content;

  // Stage 6: Confidence Scoring via structured output
  const confidenceResponse = await qwenClient.chat.completions.create({
    model: 'qwen3.7-plus',
    messages: [
      {
        role: 'system',
        content: 'Return JSON: {confidence: 0-1, risk_level: "low"|"medium"|"high", action: string, reasoning: string}',
      },
      { role: 'user', content: `Analysis: ${pipelineResult.stages.answer}` },
    ],
    response_format: { type: 'json_object' },
  });

  const plan = JSON.parse(confidenceResponse.choices[0].message.content);
  pipelineResult.confidence = plan.confidence;
  pipelineResult.action = plan.action;
  pipelineResult.risk_level = plan.risk_level;

  // Stage 7: Execution Authorization
  const AUTO_EXECUTE_THRESHOLD = 0.85;
  const LOW_RISK = plan.risk_level === 'low';

  if (plan.confidence >= AUTO_EXECUTE_THRESHOLD && LOW_RISK) {
    pipelineResult.authorized = true;
    pipelineResult.authorization_type = 'auto';
  } else if (plan.confidence >= 0.5) {
    pipelineResult.authorized = false;
    pipelineResult.authorization_type = 'human_approval_required';
  } else {
    pipelineResult.authorized = false;
    pipelineResult.authorization_type = 'blocked_escalate';
  }

  return pipelineResult;
}

module.exports = { runCertaintyPipeline, STAGES };
```

### DQS — Decision Quality Scorer

```javascript
// backend/src/qwen/confidence.js

async function calculateDQS(qwenClient, decision, outcome) {
  const response = await qwenClient.chat.completions.create({
    model: 'qwen3.7-plus',
    messages: [
      {
        role: 'system',
        content: `Evaluate the decision quality. Return JSON with scores 0-1 for each:
{
  "info_quality": 0-1,      // Was sufficient information available?
  "model_quality": 0-1,     // Was the right model/approach used?
  "reasoning_quality": 0-1, // Was the reasoning sound?
  "execution_quality": 0-1, // Was execution clean?
  "learning_quality": 0-1   // Was the outcome learned from?
}`,
      },
      {
        role: 'user',
        content: `Decision: ${JSON.stringify(decision)}\nOutcome: ${JSON.stringify(outcome)}`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const scores = JSON.parse(response.choices[0].message.content);
  // DQS = weighted average (equal weights for hackathon)
  const dqScore = (
    scores.info_quality +
    scores.model_quality +
    scores.reasoning_quality +
    scores.execution_quality +
    scores.learning_quality
  ) / 5 * 100;

  return { ...scores, dq_score: dqScore };
}

module.exports = { calculateDQS };
```

---

## 6. 12-Day Build Schedule

### Phase 1: Foundation (Days 1-3) — Jun 27-29

**Day 1: Project Scaffolding**
- [ ] Initialize Next.js + TypeScript + Tailwind project
- [ ] Set up monorepo structure: `/backend`, `/frontend`, `/docker`, `/docs`
- [ ] Create Express server with WebSocket support
- [ ] Set up PostgreSQL schema (run `schema.sql` from Section 5B — 7 PML tables + audit_log + users + sessions + qwen_conversations)
- [ ] Set up Redis connection (DB 0: events, DB 1: sessions, DB 2: cache)
- [ ] Create `.env` template: `DASHSCOPE_API_KEY`, `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`, `REDIS_URL`, `RESEND_API_KEY`, `ALIBABA_CLOUD_ACCESS_KEY_ID`, `ALIBABA_CLOUD_ACCESS_KEY_SECRET`
- [ ] Initialize Git repo with MIT license file in root
- [ ] First commit: `git commit -m "Day 1: project scaffold + schema"`

**Day 1 Validation:**
- [ ] `docker-compose up` starts PostgreSQL + Redis without errors
- [ ] `psql` connects and all tables exist: `\dt` shows m1_raw_events through m7_strategic + audit_log + users + sessions + qwen_conversations
- [ ] `redis-cli ping` returns PONG
- [ ] Express server responds on port 3000: `GET /api/health` returns `{ status: 'ok' }`
- [ ] Git repo is public on GitHub with MIT license visible in About section

**Day 2: Qwen Integration Core**
- [ ] Install `openai` npm package: `npm install openai`
- [ ] Implement Qwen API client (`backend/src/qwen/client.js`) with `baseURL: https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- [ ] Test Qwen connection: send a simple prompt to `qwen3.7-plus`, verify response
- [ ] Build intent parser: NL → structured JSON intent via `qwen3.7-plus` Chat Completions
- [ ] Build action planner: intent → multi-step action plan using `qwen3.7-max` with `enable_thinking: true`
- [ ] Implement **function calling** with 12 tool definitions (`tools` parameter):
  - [ ] `execute_command(command, timeout)` → runs shell command
  - [ ] `read_file(path)` → returns file contents
  - [ ] `write_file(path, content)` → writes file
  - [ ] `list_processes(sort_by, limit)` → returns process table
  - [ ] `check_ports()` → returns port table
  - [ ] `docker_build(dockerfile, tag, timeout)` → builds image
  - [ ] `git_clone(repo_url, dest)` → clones repo
  - [ ] `run_security_scan(tool)` → runs scan
  - [ ] `get_server_health()` → returns CPU/RAM/Disk
  - [ ] `saf_check(action, target, risk_level)` → 7-layer SAF validation
  - [ ] `query_memory(layer, query)` → retrieves from PML
  - [ ] `store_memory(layer, content, metadata)` → stores to PML
- [ ] Enable `parallel_tool_calls: true` for independent checks
- [ ] Implement forced tool calling for SAF: `tool_choice: { type: "function", function: { name: "saf_check" } }` with `enable_thinking: false`
- [ ] Implement streaming with function calling — aggregate `tool_calls` argument deltas across chunks
- [ ] Implement confidence scorer using DQS formula via `response_format: { type: "json_object" }`
- [ ] Commit: `git commit -m "Day 2: Qwen integration + 12 function calling tools"`

**Day 2 Validation:**
- [ ] Qwen API returns valid response for a test prompt: `"What is 2+2?"` → `"4"`
- [ ] Function calling works: send `"list all processes"` → Qwen returns `tool_calls` with `list_processes` → execute → return process list → Qwen generates natural language summary
- [ ] Parallel tool calling works: send `"check CPU, RAM, and disk"` → Qwen returns 3 parallel `tool_calls`
- [ ] Forced tool calling works: `tool_choice: saf_check` → Qwen returns SAF check result
- [ ] Structured output works: confidence scorer returns valid JSON with `confidence` field
- [ ] Streaming works: `stream: true` returns chunks with `delta.content` and `delta.tool_calls`

**Day 3: Decision Pipeline + SAF + Conversations API**
- [x] Implement Certainty-Driven Decision Pipeline (7 stages) using `enable_thinking: true`, `preserve_thinking: true`
- [x] Implement SAF 7-layer check function (see Section 5C stub) — every action passes through
- [x] Set up Qwen cross-device session continuity via Responses API + `previous_response_id`:
  - [x] **CORRECTION (GAP-1):** The "Conversations API" is NOT `qwen.conversations.create()`. It is the Responses API with `previous_response_id`. See `docs/GAP-ANALYSIS.md`.
  - [x] Start conversation: `qwen.responses.create({ model, input, instructions })` → store `response.id`
  - [x] Continue: `qwen.responses.create({ model, input, previous_response_id: lastId })`
  - [x] Store `conversation_id` (first response_id) + `last_response_id` in `qwen_conversations` table
  - [x] Same `last_response_id` chain works across Telegram and web dashboard
  - [x] **CORRECTION (GAP-2):** Responses API base URL is `/compatible-mode/v1` (same as Chat), NOT the deprecated `/api/v2/apps/protocols/` path
- [ ] Build approval/escalation system:
  - [ ] High confidence (>0.85) + low risk → auto-execute
  - [ ] Medium confidence (0.5-0.85) OR medium risk → require human approval
  - [ ] Low confidence (<0.5) OR high risk → block + escalate
- [ ] Wire up Telegram bot with inline keyboard buttons (Approve/Reject/Modify)
- [ ] Commit: `git commit -m "Day 3: certainty pipeline + SAF + conversations API"`

**Day 3 Validation:**
- [ ] End-to-end test: send `"restart nginx"` via Telegram → Qwen parses intent → generates plan → confidence score → SAF check → approval request → approve → execute → result logged
- [ ] SAF blocks dangerous command: send `"rm -rf /"` → SAF L4 fails → action blocked → audit log entry created
- [ ] Conversations API: send message from Telegram, then send follow-up from dashboard with same `conversation_id` → Qwen remembers context
- [ ] Audit log: verify `audit_log` table has entry for every action with `saf_result` JSON
- [ ] Try to UPDATE an audit_log row → should raise exception (immutable trigger works)

### Phase 2: Memory & Intelligence (Days 4-6) — Jun 30-Jul 2

**Day 4: PML Implementation + Embeddings**
- [ ] Implement memory store function: writes to correct PML table based on layer
- [ ] Implement memory retrieve function: reads from correct PML table
- [ ] Implement `text-embedding-v4` integration for M6/M7 vectorization:
  ```javascript
  const embedding = await qwen.embeddings.create({
    model: "text-embedding-v4", input: content, dimensions: 1024
  });
  ```
- [ ] Implement Redis hot cache for M1 (recent events stream) and session state
- [ ] Build memory query API: `GET /api/memory/:layer?query=...` with semantic search via embeddings
- [ ] Structure messages for implicit context cache: static system prompts at array start, variable server state at end
- [ ] Commit: `git commit -m "Day 4: PML 7-layer memory + embeddings + semantic search"`

**Day 4 Validation:**
- [ ] Store a memory in M6: call `store_memory('M6', 'CPU spike from node-worker fixed by kill', {})` → row exists in `m6_learning` with `embedding` populated
- [ ] Semantic search works: query `"CPU problems"` → returns the node-worker memory via vector similarity
- [ ] Redis hot cache: store event in M1 → Redis stream has entry → retrieve within 50ms
- [ ] Context cache: make 2 identical calls with same system prompt → second call shows cached tokens (check usage in response)

**Day 5: Learning Loop**
- [ ] Implement Organizational Learning System feedback loop: Action → Outcome → Measurement → Error Detection → Model Update → Policy Update
- [ ] Build "remediation playbook" auto-generation: when agent fixes an anomaly, store pattern in M3
- [ ] Next time similar anomaly occurs, agent checks M3 first (before Qwen diagnosis)
- [ ] Implement DQ score tracking and trend chart data API: `GET /api/analytics/dq-trend`
- [ ] Build "lessons learned" endpoint: `GET /api/learning/lessons`
- [ ] Commit: `git commit -m "Day 5: learning loop + playbook auto-generation + DQ tracking"`

**Day 5 Validation:**
- [ ] Trigger anomaly (simulate CPU spike) → agent fixes it → M3 has new SOP entry with `auto_generated: true`
- [ ] Trigger same anomaly again → agent checks M3 first → applies known fix → faster resolution
- [ ] DQ score API returns array of scores over time: `[{date, dq_score}, ...]`
- [ ] Lessons endpoint returns list of learned patterns from M6

**Day 6: Monitoring & Anomaly Detection + Streaming**
- [ ] Implement continuous monitoring loop (polls every 30s):
  - [ ] CPU usage → anomaly if >85% for 5 min
  - [ ] RAM usage → anomaly if >90%
  - [ ] Disk usage → anomaly if >85%
  - [ ] Process crashes → anomaly on exit code != 0
  - [ ] Port conflicts → anomaly on duplicate binding
- [ ] When anomaly detected:
  1. [ ] Store in M1 (Raw Event)
  2. [ ] Trigger Qwen diagnosis with `qwen3.7-max` + `enable_thinking: true` + `thinking_budget: 2000` + `stream: true`
  3. [ ] Stream `reasoning_content` to dashboard via WebSocket (live reasoning chain)
  4. [ ] Generate remediation plan via `response_format: { type: "json_object" }`
  5. [ ] Route through Certainty Pipeline
  6. [ ] Notify user via Telegram + Dashboard
- [ ] Build alert feed WebSocket endpoint for real-time dashboard updates
- [ ] Implement streaming with function calling: aggregate `tool_calls` argument deltas across chunks
- [ ] Commit: `git commit -m "Day 6: anomaly detection + streaming diagnosis + WebSocket alerts"`

**Day 6 Validation:**
- [ ] Simulate CPU spike (run `stress --cpu 4 --timeout 300`) → monitoring detects within 30s → M1 entry created → Qwen diagnosis triggered → reasoning streamed to dashboard → remediation plan generated
- [ ] WebSocket: dashboard receives alert in real-time when anomaly detected
- [ ] Streaming: `reasoning_content` chunks appear in dashboard "Reasoning Chain" panel before final `content` appears in "Response" panel
- [ ] End-to-end: anomaly → detect → diagnose → plan → approve → fix → verify → learn

### Phase 3: UI & Polish (Days 7-9) — Jul 3-5

**Day 7: Dashboard Core**
- [ ] Build Next.js dashboard with Luxury Dark Mode design tokens:
  - [ ] Background: `#0A0A0A`, Surface: `#1A1A1A`, Primary: `#00D9FF`, Secondary: `#FFD700`
  - [ ] Text: `#E0E0E0`, Danger: `#FF4444`, Success: `#00FF88`
- [ ] Build Overview page (health summary, active sessions, pending approvals, recent actions)
- [ ] Build Agent Console (NL input bar, live reasoning chain display, action history)
- [ ] Implement WebSocket connection for real-time updates (Socket.io client)
- [ ] Commit: `git commit -m "Day 7: dashboard core + agent console + WebSocket"`

**Day 7 Validation:**
- [ ] Dashboard loads at `http://localhost:3000` with Luxury Dark Mode styling
- [ ] Overview page shows server health (CPU/RAM/Disk), pending approvals count, recent actions
- [ ] Agent Console: type NL command → see reasoning chain stream in real-time → see action plan → see result
- [ ] WebSocket: kill a process on server → dashboard updates without page refresh

**Day 8: Dashboard Pages**
- [ ] Build Monitoring page (processes table, ports table, resource graphs, Docker containers)
- [ ] Build Deployments page (new deployment wizard, history table, rollback button)
- [ ] Build File Manager page (directory browser, inline editor, upload/download)
- [ ] Build Security page (audit log table, RKHunter/Lynis results, SAF 7-layer status indicators)
- [ ] Build Memory & Learning page (7 PML layer viewers, learning curve chart)
- [ ] Build Settings page (confidence threshold slider, allowed commands editor, Qwen model selection, API keys)
- [ ] Build Analytics page (DQ dashboard, performance metrics, remediation effectiveness, learning rate)
- [ ] Commit: `git commit -m "Day 8: all dashboard pages built"`

**Day 8 Validation:**
- [ ] Every page in the navigation tree (Section 4) is accessible and renders without errors
- [ ] Monitoring page: processes table populates from `/api/processes`, ports from `/api/ports`
- [ ] Security page: SAF layer status shows 7 indicators (all green when no issues)
- [ ] Memory page: can view entries from each M1-M7 layer, search works
- [ ] Settings page: confidence threshold slider saves to backend, Qwen model dropdown persists

**Day 9: Telegram Bot Polish + Integration Testing**
- [ ] Complete all Telegram commands from the command map (Section 4)
- [ ] Add inline keyboards for approval flows (Approve/Reject/Modify buttons)
- [ ] Add rich formatting (markdown, code blocks for command output)
- [ ] End-to-end testing scenarios:
  - [ ] NL command → full pipeline → execution → logging → audit
  - [ ] Anomaly detection → auto-remediation → approval → fix → learning
  - [ ] Deployment from GitHub → Docker build → health check → running
  - [ ] Security scan (RKHunter + Lynis) → results display → audit log entry
  - [ ] Memory retrieval across all 7 layers via `/memory` command
  - [ ] Cross-device: start command on Telegram, continue on dashboard
- [ ] Fix bugs, error handling, edge cases
- [ ] Commit: `git commit -m "Day 9: telegram polish + full integration testing"`

**Day 9 Validation:**
- [ ] All 12 Telegram commands work: `/start`, `/status`, `/approve`, `/reject`, `/memory`, `/security`, `/deploy`, `/containers`, `/logs`, `/config`, `/analytics`, `/cancel`
- [ ] NL message `"CPU is at 95%, fix it"` → full pipeline → Telegram shows approval buttons → tap Approve → action executes → result message
- [ ] NL message `"deploy https://github.com/example/repo"` → git clone → docker build → container running → health check passes
- [ ] No unhandled exceptions in any test scenario
- [ ] Error handling: invalid command → graceful error message, not crash

### Phase 4: Cloud Deployment & Submission (Days 10-12) — Jul 6-8

**Day 10: Alibaba Cloud Deployment**
- [ ] Claim Alibaba Cloud ECS free trial via [Free Trial Center](https://free.alibabacloud.com/) (1C1G individual / 2C2G enterprise) OR provision a pay-as-you-go 2C4G instance (~$18–25 for 12 days)
- [ ] Install Docker + Docker Compose on ECS
- [ ] Create `docker-compose.prod.yml` with services:
  - [ ] `althr-autopilot` (Node.js backend + Next.js frontend)
  - [ ] `postgres` (containerized PG with pgvector — avoid RDS cost)
  - [ ] `redis` (containerized Redis — avoid managed Redis cost)
- [ ] Set up Alibaba Cloud OSS bucket for log backups
- [ ] Configure Alibaba Cloud Cloud Monitor for external health checks
- [ ] Write `backend/src/utils/alibaba.js` with real Alibaba Cloud SDK calls (see Section 8)
- [ ] Deploy to ECS: `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Verify all endpoints working on ECS: `curl http://ecs-ip:3000/api/health`
- [ ] Set up ngrok or Alibaba Cloud DNS for public access
- [ ] Commit: `git commit -m "Day 10: Alibaba Cloud deployment + proof file"`

**Day 10 Validation:**
- [ ] `backend/src/utils/alibaba.js` exists and imports `@alicloud/ecs20140526`, `ali-oss`, `@alicloud/cms20190101`
- [ ] ECS instance is running: `aliyun ecs DescribeInstances` shows it
- [ ] Application accessible via public URL: `curl https://your-domain/api/health` returns `{ status: 'ok' }`
- [ ] OSS bucket created: `aliyun oss ls` shows `althr-autopilot-logs`
- [ ] Audit log backup works: trigger an action → check OSS bucket has JSON file
- [ ] Cloud Monitor receives custom metric: trigger DQ score → check Cloud Monitor dashboard
- [ ] **R2 COMPLIANCE CHECK:** Alibaba Cloud proof file exists and is linked in repo

**Day 11: Documentation & Demo Prep**
- [ ] Write `README.md` with:
  - [ ] Project description (what it does, why it's useful)
  - [ ] Architecture diagram (embedded image)
  - [ ] Setup instructions (clone, env vars, docker-compose up)
  - [ ] API documentation (endpoints list)
  - [ ] Screenshots (dashboard, Telegram, agent console)
  - [ ] Tech stack list
  - [ ] Alibaba Cloud services used
- [ ] Create architecture diagram (use draw.io or Mermaid → export as PNG)
  - [ ] Shows: User → Telegram/Dashboard → Express API → Qwen Cloud → Function Calling → SAF → Execution → PML → Alibaba Cloud
- [ ] Record 3-minute demo video:
  - [ ] 0:00-0:30: Problem statement + project intro
  - [ ] 0:30-1:00: Telegram NL command → execution (show reasoning chain)
  - [ ] 1:00-1:30: Anomaly detection → auto-remediation with approval
  - [ ] 1:30-2:00: One-command deployment from GitHub
  - [ ] 2:00-2:30: Dashboard tour (memory, security, analytics)
  - [ ] 2:30-3:00: Learning loop demonstration + closing
- [ ] Upload video to YouTube (unlisted)
- [ ] Write blog post for bonus prize (only if all above is done)
- [ ] Commit: `git commit -m "Day 11: README + architecture diagram + demo video"`

**Day 11 Validation:**
- [ ] README.md is comprehensive: a new developer could clone and run the project
- [ ] Architecture diagram is a visual PNG (not text), clearly shows all components
- [ ] Demo video is ≤3 minutes, shows real working product, uploaded to YouTube
- [ ] Video link works: open in incognito browser
- [ ] **R5 COMPLIANCE CHECK:** Architecture diagram exists as PNG in repo
- [ ] **R6 COMPLIANCE CHECK:** Demo video ≤3 min on YouTube/Vimeo/Youku

**Day 12: Final Submission**
- [ ] Final testing on Alibaba Cloud deployment (all endpoints, all Telegram commands)
- [ ] Submit on Devpost:
  - [ ] Project name: "ALTHR Autopilot"
  - [ ] Track selection: Track 4 — Autopilot Agent
  - [ ] Text description (features, functionality, architecture)
  - [ ] Code repo URL (public, with MIT license visible in About)
  - [ ] Alibaba Cloud deployment proof (link to `backend/src/utils/alibaba.js`)
  - [ ] Architecture diagram (upload PNG)
  - [ ] Demo video URL (YouTube link)
  - [ ] Testing instructions (public URL + login credentials)
  - [ ] Blog post URL (optional, for bonus prize)
- [ ] Submit at least 2 hours before deadline (before 12:00 PM Pacific, Jul 9)
- [ ] **FULL COMPLIANCE CHECK (Section 1B):** Verify all R1-R12 checkboxes are ☑

**Day 12 Validation:**
- [ ] Devpost submission is complete — no empty required fields
- [ ] Public GitHub repo URL works in incognito browser
- [ ] MIT license file visible in repo About section
- [ ] `alibaba.js` proof file is accessible at the linked URL
- [ ] Demo video plays on YouTube
- [ ] Working demo URL is accessible (test from incognito)
- [ ] Login credentials (if needed) are included in testing instructions
- [ ] All text is in English
- [ ] Track selected: Track 4 — Autopilot Agent

---

## 7. Repository Structure

```
althr-autopilot/
├── README.md
├── LICENSE (MIT)
├── docker-compose.yml
├── .env.example
├── alibaba-cloud-deployment.md    ← Hackathon proof file
│
├── backend/
│   ├── package.json
│   ├── src/
│   │   ├── server.js               ← Express + WebSocket entry
│   │   ├── routes/
│   │   │   ├── agent.js            ← /api/agent (NL → action)
│   │   │   ├── command.js          ← /api/command
│   │   │   ├── file.js             ← /api/file/*
│   │   │   ├── docker.js           ← /api/docker/*
│   │   │   ├── monitor.js          ← /api/processes, /api/ports
│   │   │   ├── deploy.js           ← /api/deployments
│   │   │   ├── security.js         ← /api/audit, /api/security/*
│   │   │   ├── memory.js           ← /api/memory/*
│   │   │   └── health.js           ← /api/health
│   │   ├── qwen/
│   │   │   ├── client.js           ← Qwen API wrapper
│   │   │   ├── intent-parser.js    ← NL → structured intent
│   │   │   ├── action-planner.js   ← Intent → multi-step plan
│   │   │   ├── skills.js           ← Custom function definitions
│   │   │   └── confidence.js       ← DQS confidence scorer
│   │   ├── pipeline/
│   │   │   ├── certainty.js        ← 7-stage Certainty-Driven Pipeline
│   │   │   └── saf.js              ← 7-layer Security-by-Architecture
│   │   ├── memory/
│   │   │   ├── pml.js              ← PML store/retrieve (7 layers)
│   │   │   ├── learning.js         ← Learning loop + playbook gen
│   │   │   └── schema.sql          ← PostgreSQL schema (7 tables)
│   │   ├── monitors/
│   │   │   ├── cpu.js              ← CPU anomaly detector
│   │   │   ├── memory.js           ← RAM anomaly detector
│   │   │   ├── disk.js             ← Disk anomaly detector
│   │   │   ├── process.js          ← Process crash detector
│   │   │   └── ports.js            ← Port conflict detector
│   │   ├── telegram/
│   │   │   └── bot.js              ← Telegram bot with inline keyboards
│   │   ├── utils/
│   │   │   ├── audit.js            ← Immutable audit logger
│   │   │   ├── executor.js         ← Command executor with timeout
│   │   │   └── alibaba.js          ← Alibaba Cloud SDK integration
│   │   └── config/
│   │       └── allowed-commands.js ← Command whitelist
│   └── tests/
│       ├── intent-parser.test.js
│       ├── certainty-pipeline.test.js
│       ├── saf.test.js
│       └── memory.test.js
│
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                    ← Overview
│   │   │   ├── agent/page.tsx              ← Agent Console
│   │   │   ├── monitoring/page.tsx         ← Monitoring
│   │   │   ├── deployments/page.tsx        ← Deployments
│   │   │   ├── files/page.tsx              ← File Manager
│   │   │   ├── security/page.tsx           ← Security
│   │   │   ├── memory/page.tsx             ← Memory & Learning
│   │   │   ├── settings/page.tsx           ← Settings
│   │   │   └── analytics/page.tsx          ← Analytics
│   │   ├── components/
│   │   │   ├── AgentConsole.tsx
│   │   │   ├── ReasoningChain.tsx
│   │   │   ├── ApprovalCard.tsx
│   │   │   ├── ServerHealth.tsx
│   │   │   ├── ProcessTable.tsx
│   │   │   ├── PortTable.tsx
│   │   │   ├── ResourceGraph.tsx
│   │   │   ├── DockerContainerList.tsx
│   │   │   ├── DeploymentWizard.tsx
│   │   │   ├── FileBrowser.tsx
│   │   │   ├── AuditLog.tsx
│   │   │   ├── SAFStatus.tsx
│   │   │   ├── MemoryExplorer.tsx
│   │   │   ├── DQScoreChart.tsx
│   │   │   ├── LearningCurve.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── lib/
│   │   │   ├── api.ts              ← API client
│   │   │   ├── websocket.ts        ← WebSocket client
│   │   │   └── design-tokens.ts    ← Luxury Dark Mode tokens
│   │   └── stores/
│   │       └── agent-store.ts      ← Zustand store
│   └── public/
│       └── architecture-diagram.png
│
└── docs/
    ├── architecture.md
    ├── api-reference.md
    ├── alibaba-cloud-setup.md
    └── demo-script.md
```

---

## 8. Alibaba Cloud Integration (Hackathon Requirement)

### Required Proof
The hackathon requires: *"Proof must be a link to a code file in their code repo that demonstrates use of Alibaba Cloud services and APIs."*

### Implementation

**File:** `backend/src/utils/alibaba.js`

```javascript
// Alibaba Cloud SDK integration for ALTHR Autopilot
// This file demonstrates use of Alibaba Cloud services and APIs
// Required for hackathon submission proof

const ECS = require('@alicloud/ecs20140526').default;
const Oss = require('ali-oss');
const CloudMonitor = require('@alicloud/cms20190101').default;

// 1. ECS Instance Management
const ecsClient = new ECS({
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
  endpoint: 'ecs.ap-southeast-1.aliyuncs.com',
});
// Used for: querying instance status, restarting instances

// 2. OSS (Object Storage) for log backups
const ossClient = new Oss({
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
  region: 'oss-ap-southeast-1',
  bucket: 'althr-autopilot-logs',
});

// Upload audit log to OSS (immutable backup)
async function backupAuditLog(logEntry) {
  const date = new Date().toISOString().split('T')[0];
  await ossClient.put(
    `audit-logs/${date}/${logEntry.id}.json`,
    Buffer.from(JSON.stringify(logEntry))
  );
}

// 3. Cloud Monitor for external health checks + custom metrics
const cmsClient = new CloudMonitor({
  accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
  endpoint: 'metrics.ap-southeast-1.aliyuncs.com',
});

// Send DQ score as custom metric to Cloud Monitor
async function reportDQScore(score, agentName) {
  await cmsClient.putCustomMetric({
    MetricName: 'DQ_Score',
    Dimensions: JSON.stringify([{ value: agentName, key: 'agent' }]),
    Value: score,
  });
}

module.exports = { ecsClient, ossClient, cmsClient, backupAuditLog, reportDQScore };
```

### Services Used
| Service | Purpose | Hackathon Proof |
|---|---|---|
| **ECS** | Hosts the Express backend + Docker containers | Instance management API calls |
| **OSS** | Stores immutable audit log backups + memory snapshots | SDK upload calls in `alibaba.js` |
| **Cloud Monitor** | External health checks + custom DQ score metrics | Custom metric API calls |
| **Qwen Cloud API** | LLM reasoning, function calling, thinking, embeddings, conversations | `DASHSCOPE_API_KEY` + Chat Completions + Responses API |

### Qwen Cloud API Endpoints Used
| API | Base URL | Usage |
|---|---|---|
| Chat Completions | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | NL parsing, function calling, thinking mode, structured output |
| Responses | `https://dashscope-intl.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1` | Conversations API, MCP tools |
| Embeddings | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | `text-embedding-v4` for memory vectorization |
| Conversations | `https://dashscope-intl.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1` | Cross-device session management |

---

## 9. Judging Criteria Alignment

| Criterion | Weight | How We Score |
|---|---|---|
| **Innovation & AI Creativity** | 30% | Qwen custom skills for server ops; DQS-based confidence scoring; 7-layer PML memory; Certainty-Driven Pipeline as AI governance; auto-remediation with learning loop |
| **Technical Depth & Engineering** | 30% | 7-layer SAF security framework; WebSocket real-time; PostgreSQL + Redis dual storage; Docker Compose orchestration; immutable audit logging; command sandboxing with allowlist |
| **Problem Value & Impact** | 25% | Server management is a universal DevOps pain point; production-ready (not a toy); open-source community potential; scalable to multi-server fleets |
| **Presentation & Documentation** | 15% | Architecture diagram; 3-min demo video; comprehensive README; live dashboard with Luxury Dark Mode; blog post for bonus prize |

---

## 10. Risk Mitigation

| Risk | Mitigation |
|---|---|
| Qwen API rate limits | Implement request queue + retry with exponential backoff; use `qwen3.6-flash` for simple checks, `qwen3.7-plus` for normal, `qwen3.7-max` only for complex diagnosis. Leverage **implicit context cache** (80% savings on cached prefix tokens) by structuring messages with static system prompts first |
| Qwen thinking mode + forced tool_choice conflict | Thinking mode only supports `tool_choice: "auto"` or `"none"`. To force a specific tool (e.g., SAF check), set `enable_thinking: false` first |
| Qwen Conversations API message expiry | Individual message items expire after 7 days. Pass system instructions via `instructions` parameter, not as items. The conversation itself has no expiry |
| Alibaba Cloud setup time | Day 10 is dedicated; pre-create account before Day 1 |
| Telegram bot approval latency | Add timeout (5 min) → auto-reject if no response → log to audit |
| Docker build failures | Wrap in try/catch + timeout; fallback to pre-built images |
| PostgreSQL connection drops | Implement reconnection logic + Redis fallback for critical operations |
| Demo video quality | Write script on Day 11; do 3 takes; keep under 3 min |
| Submission deadline | Submit Day 12 morning, not last minute |

---

## 11. Why We Win — Competitive Analysis Against 1000+ Submissions

### The Reality of 1000+ Submissions

With 5030+ participants and 5 tracks, Track 4 will likely see 200-400 submissions. Most will be:
- **Type A (40%):** Simple chatbot wrappers — "send a message, get a response" with zero real-world automation
- **Type B (30%):** Demo-ware — looks good in video but breaks on edge cases, no error handling, no security
- **Type C (20%):** Competent agents — function calling + basic memory, but no governance, no learning loop
- **Type D (8%):** Strong submissions — real workflows, good architecture, some Qwen feature depth
- **Type E (2%):** Exceptional — production-grade, deep Qwen integration, novel architecture, real impact

**Our target: Type E. Here's how we get there.**

### Why ALTHR Autopilot Beats the Field

| Advantage | Most Competitors | ALTHR Autopilot | Impact on Judges |
|---|---|---|---|
| **Real-world foundation** | Built from scratch in 12 days, toy workflows | Built on Server22 — 12+ working API endpoints, real server management, real Docker builds | "Problem Value" (25%) — we solve a real pain point, not a synthetic one |
| **Qwen API depth** | 1-2 APIs used (Chat Completions only) | 6 Qwen APIs: Chat Completions, Responses, Embeddings, Conversations, Function Calling (12 tools), Thinking Mode, Structured Output, Context Cache | "Innovation & AI Creativity" (30%) — we use Qwen like a platform, not a wrapper |
| **AI governance** | None — agent does whatever it's told | 7-stage Certainty-Driven Pipeline + 7-layer SAF + DQS scoring = auditable, blockable, scoreable | "Technical Depth" (30%) — this is what "production-readiness" means |
| **Memory architecture** | Flat chat history or simple vector store | 7-layer PML with embeddings, learning loop, playbook auto-generation | "Innovation" (30%) — memory that learns, not just stores |
| **Security** | Zero security considerations | SAF 7-layer framework, command whitelist, immutable audit log, human-in-the-loop | "Technical Depth" (30%) — judges explicitly weight "error handling" |
| **Dual interface** | Web-only or CLI-only | Telegram (mobile/field) + Luxury Dark Mode web dashboard, both feature-complete, cross-device via Conversations API | "Presentation" (15%) — shows production thinking |
| **Embedded frameworks** | Ad hoc code, no theoretical foundation | 8 frameworks from systems research: DQS, MNIF, ADCOS, PML, UDIT, SAF, Certainty Pipeline, Organizational Learning System | "Innovation" (30%) — intellectual depth visible in architecture |
| **Streaming reasoning** | Black-box responses | `reasoning_content` streamed live to dashboard — judges see the agent thinking in real-time | "Presentation" (15%) — demo video will be compelling |

### What Could Beat Us (and How We Prevent It)

| Threat | Risk Level | How We Counter |
|---|---|---|
| A competitor with a more visually polished demo | Medium | Our Luxury Dark Mode + live reasoning stream + Telegram integration is inherently visual. Practice the demo script. |
| A competitor using more Qwen APIs (e.g., vision, file upload) | Low | We use 6+ Qwen APIs already. Adding vision would be nice but not necessary. Focus on depth over breadth. |
| A competitor with a more complex multi-agent system | Medium | Track 4 is about automation, not multi-agent. Our single-agent + 7-layer memory + governance is the right scope. |
| A competitor with real users / deployment evidence | Medium | Our Server22 foundation IS real deployment evidence. Show Docker containers running, real processes being managed. |
| A competitor with better documentation | Low | We have a comprehensive README + architecture diagram + this build plan. Write the blog post for bonus. |
| A competitor with a more novel problem domain | Medium | Server management is universal. Novelty is in our approach (AI governance + learning memory), not the domain. |

---

## 12. Limitations & Gap Closure

### Known Limitations (Honest Assessment)

| # | Limitation | Impact | Why It Exists | Gap Closure Strategy |
|---|---|---|---|---|
| L1 | **Single-server scope** — manages one ECS instance, not a fleet | Medium | 12-day build window; multi-server adds orchestration complexity (Kubernetes, service mesh) | **Demo:** Mention fleet scalability in video. **Code:** Abstract server ID in all API calls (`server_id` field in schema). **Post-hackathon:** Add Kubernetes integration. |
| L2 | **No automated tests** — manual testing only | Medium | Time constraint; writing tests competes with feature development | **Mitigate:** Day 9 integration testing is thorough (6 scenarios). **Post-hackathon:** Add Jest test suite. Judges see integration testing in the demo. |
| L3 | **No CI/CD pipeline** — manual Docker deployment | Low | Hackathon project; CI/CD setup takes 2+ hours | **Mitigate:** Docker Compose is reproducible. README has setup instructions. **Post-hackathon:** Add GitHub Actions. |
| L4 | **Telegram approval latency** — user must respond within 5 min or auto-reject | Low | Prevents blocking on unresponsive users | **Mitigate:** Auto-reject is the right behavior for production. Document it as a feature, not a bug. |
| L5 | **No multi-user support** — single admin user | Low | Hackathon scope; multi-user adds RBAC complexity | **Mitigate:** Schema has `users` table with `role` field. Mention multi-user readiness in README. |
| L6 | **Qwen API dependency** — if Qwen Cloud is down, agent is non-functional | Medium | Core architecture depends on Qwen for all reasoning | **Mitigate:** Redis caches recent decisions. Fallback: if Qwen is unreachable, agent enters "manual mode" (direct commands only, no NL parsing). **Code:** Add health check for Qwen API in monitoring loop. |
| L7 | **No persistent conversation history beyond Qwen's 7-day item expiry** | Low | Qwen Conversations API limitation | **Mitigate:** All decisions are logged in PML (M5 Decision Memory). Conversation context is supplementary, not primary. |
| L8 | **Command whitelist is static** — no dynamic policy updates | Low | Time constraint; dynamic policy adds complexity | **Mitigate:** Settings page has "allowed commands editor" UI. Backend reads from DB, not hardcoded. **Code:** `allowed-commands.js` reads from `m3_operational` table. |
| L9 | **No real anomaly ML model** — thresholds are hardcoded (CPU >85%, etc.) | Medium | Training an ML model takes data and time we don't have | **Mitigate:** Thresholds are configurable in Settings. **Post-hackathon:** Use Qwen to dynamically adjust thresholds based on historical patterns from M1. **Hackathon:** Frame as "rule-based anomaly detection with AI-powered diagnosis" — which is accurate. |
| L10 | **Demo video is 3 minutes** — can't show everything | Medium | Hackathon rule | **Mitigate:** Script the video carefully (Section Day 11). Show the most impressive features: NL command with reasoning stream, auto-remediation with approval, one-command deploy. Skip file manager, settings in video. |

### Gap Closure Priority Matrix

| Gap | Effort to Close | Impact on Score | Priority | Action |
|---|---|---|---|---|
| L1 (single-server) | High | Low | P3 | Mention in video; abstract in code |
| L2 (no tests) | Medium | Medium | P2 | Day 9 integration testing covers critical paths |
| L3 (no CI/CD) | Low | Low | P4 | Skip for hackathon |
| L6 (Qwen dependency) | Medium | High | P1 | Add Qwen health check + manual fallback mode |
| L9 (static thresholds) | High | Medium | P2 | Make configurable; frame as rule-based + AI diagnosis |
| L10 (3-min video) | Low | High | P1 | Script and practice video on Day 11 |

### What We're NOT Doing (and Why That's OK)

- **NOT building a multi-agent system** — Track 3 is for that. Track 4 is about end-to-end automation with a single agent.
- **NOT building a mobile app** — Telegram bot IS our mobile interface. Native app is unnecessary scope creep.
- **NOT building user authentication with OAuth** — JWT + TOTP is sufficient for hackathon. OAuth adds 4+ hours.
- **NOT building a plugin system** — MCP integration shows extensibility. Full plugin system is post-hackathon.
- **NOT training custom models** — Qwen Cloud models are the point of the hackathon. Fine-tuning would disqualify us.
- **NOT building analytics dashboards with custom charts** — Recharts/Chart.js is sufficient. Custom D3 visualizations are scope creep.

---

## 13. Key Differentiators vs. Other Submissions

1. **Not a toy demo** — Built on a real server management system (Server22) with 12+ working API endpoints
2. **AI governance is real** — Certainty-Driven Pipeline + DQS + SAF = auditable, blockable, scoreable actions
3. **Memory is architectural** — 7-layer PML, not just a chat history. The agent learns which fixes work.
4. **Security-by-design** — Every action passes through 7 security layers before execution. Most hackathon projects have zero security.
5. **Dual interface** — Telegram (mobile/field) + Web dashboard (desktop/visual). Both feature-complete.
6. **Embedded frameworks** — DQS, MNIF, ADCOS, PML, UDIT, SAF, Certainty Pipeline, Organizational Learning System — 8 intellectual frameworks from your research, not just code.

---

*End of Track 4 Build Plan. Ready to execute.*
