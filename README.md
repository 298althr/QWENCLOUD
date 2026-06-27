# ALTHR Autopilot — Track 4: Autopilot Agent

**Hackathon:** Global AI Hackathon Series with Qwen Cloud
**Track:** Track 4 — Autopilot Agent
**Project:** ALTHR Autopilot — AI-Native Server Operations Agent
**Window:** Jun 27, 2026 → Jul 9, 2026 (12 days)

---

## Quick Navigation

> **New to this project?** Start with [`docs/handover/quickstart.md`](docs/handover/quickstart.md), then read the [`docs/handover/context-graph.md`](docs/handover/context-graph.md) to understand how everything connects.

| What you need | Where to find it |
|---|---|
| **Full build plan** (12-day schedule, checklists, validation) | [`docs/TRACK4-BUILD-PLAN.md`](docs/TRACK4-BUILD-PLAN.md) |
| **Gap analysis & optimized plan** (corrections to original plan) | [`docs/GAP-ANALYSIS.md`](docs/GAP-ANALYSIS.md) |
| **System architecture** (how components connect) | [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md) |
| **Data flow** (how a message travels through the system) | [`docs/architecture/data-flow.md`](docs/architecture/data-flow.md) |
| **Security architecture** (SAF 7-layer framework) | [`docs/architecture/security-architecture.md`](docs/architecture/security-architecture.md) |
| **API reference** (all endpoints) | [`docs/api/api-reference.md`](docs/api/api-reference.md) |
| **Database schema** (all tables, indexes, triggers) | [`docs/database/schema.md`](docs/database/schema.md) |
| **Qwen AI Engine** (intent parsing, function calling, thinking mode) | [`docs/services/qwen-ai-engine.md`](docs/services/qwen-ai-engine.md) |
| **Certainty-Driven Pipeline** (7-stage decision gate) | [`docs/services/certainty-pipeline.md`](docs/services/certainty-pipeline.md) |
| **SAF Framework** (7-layer security check) | [`docs/services/saf-framework.md`](docs/services/saf-framework.md) |
| **PML Memory System** (7-layer memory + learning loop) | [`docs/services/pml-memory.md`](docs/services/pml-memory.md) |
| **Monitoring Service** (anomaly detection + streaming) | [`docs/services/monitoring-service.md`](docs/services/monitoring-service.md) |
| **Telegram Bot** (commands, inline keyboards, approvals) | [`docs/services/telegram-bot.md`](docs/services/telegram-bot.md) |
| **API Gateway** (Express routes + WebSocket) | [`docs/services/api-gateway.md`](docs/services/api-gateway.md) |
| **Alibaba Cloud Integration** (ECS, OSS, Cloud Monitor) | [`docs/services/alibaba-cloud.md`](docs/services/alibaba-cloud.md) |
| **Docker setup** | [`docs/deployment/docker-setup.md`](docs/deployment/docker-setup.md) |
| **Alibaba Cloud deployment guide** | [`docs/deployment/alibaba-cloud-setup.md`](docs/deployment/alibaba-cloud-setup.md) |
| **Hackathon compliance checklist** | [`docs/compliance/hackathon-rules.md`](docs/compliance/hackathon-rules.md) |
| **Team handover guide** | [`docs/handover/quickstart.md`](docs/handover/quickstart.md) |
| **Context graph** (visual map of all components) | [`docs/handover/context-graph.md`](docs/handover/context-graph.md) |

---

## Folder Structure

```
TRACK4/
├── README.md                           ← You are here — navigation hub
├── docs/
│   ├── TRACK4-BUILD-PLAN.md            ← Master build plan (12-day schedule, checklists)
│   ├── architecture/
│   │   ├── system-architecture.md      ← High-level component diagram + connections
│   │   ├── data-flow.md                ← Step-by-step message flow through the system
│   │   └── security-architecture.md    ← SAF 7-layer framework details
│   ├── services/
│   │   ├── qwen-ai-engine.md           ← Qwen Cloud integration (intent, tools, thinking, embeddings)
│   │   ├── certainty-pipeline.md       ← 7-stage Certainty-Driven Decision Pipeline
│   │   ├── saf-framework.md            ← 7-layer Security-by-Architecture
│   │   ├── pml-memory.md               ← 7-layer Performance Memory Layer + learning loop
│   │   ├── monitoring-service.md       ← Anomaly detection (CPU, RAM, disk, process, ports)
│   │   ├── telegram-bot.md             ← Telegram bot interface (commands, approvals)
│   │   ├── api-gateway.md              ← Express.js API routes + WebSocket
│   │   └── alibaba-cloud.md            ← Alibaba Cloud SDK integration (ECS, OSS, Cloud Monitor)
│   ├── api/
│   │   └── api-reference.md            ← All REST + WebSocket endpoints
│   ├── database/
│   │   └── schema.md                   ← PostgreSQL schema (7 PML tables + audit + auth)
│   ├── deployment/
│   │   ├── docker-setup.md             ← Docker Compose configuration
│   │   └── alibaba-cloud-setup.md      ← Alibaba Cloud ECS/RDS/Redis/OSS setup guide
│   ├── handover/
│   │   ├── quickstart.md               ← 10-minute onboarding for new team members
│   │   └── context-graph.md            ← Visual map of all components and their relationships
│   └── compliance/
│       └── hackathon-rules.md          ← Compliance checklist mapped to QWEN-CLOUD.txt
│
├── backend/                            ← Backend source code (Node.js + Express)
├── frontend/                           ← Frontend source code (Next.js + TypeScript)
├── docker/                             ← Docker Compose files + Dockerfiles
└── scripts/                            ← Setup and deployment scripts
```

---

## Service Overview

| Service | Tech | Key Files | Documentation |
|---|---|---|---|
| **Qwen AI Engine** | Node.js + `openai` SDK | `backend/src/qwen/` | [`docs/services/qwen-ai-engine.md`](docs/services/qwen-ai-engine.md) |
| **Certainty Pipeline** | Node.js | `backend/src/pipeline/certainty.js` | [`docs/services/certainty-pipeline.md`](docs/services/certainty-pipeline.md) |
| **SAF Framework** | Node.js | `backend/src/pipeline/saf.js` | [`docs/services/saf-framework.md`](docs/services/saf-framework.md) |
| **PML Memory** | Node.js + PostgreSQL + Redis | `backend/src/memory/` | [`docs/services/pml-memory.md`](docs/services/pml-memory.md) |
| **Monitoring** | Node.js | `backend/src/monitors/` | [`docs/services/monitoring-service.md`](docs/services/monitoring-service.md) |
| **Telegram Bot** | Node.js + Telegram Bot API | `backend/src/telegram/bot.js` | [`docs/services/telegram-bot.md`](docs/services/telegram-bot.md) |
| **API Gateway** | Express.js + Socket.io | `backend/src/routes/` | [`docs/services/api-gateway.md`](docs/services/api-gateway.md) |
| **Alibaba Cloud** | Alibaba Cloud SDKs | `backend/src/utils/alibaba.js` | [`docs/services/alibaba-cloud.md`](docs/services/alibaba-cloud.md) |
| **Frontend** | Next.js + TypeScript + Tailwind | `frontend/src/` | (TBD during build) |

---

## Key Decisions

- **LLM:** Qwen Cloud only (`qwen3.7-plus`, `qwen3.7-max`, `qwen3.6-flash`) — no alternative LLMs
- **Cloud:** Alibaba Cloud (ECS + OSS + Cloud Monitor) — required by hackathon
- **Database:** PostgreSQL (Alibaba Cloud RDS) + Redis (Alibaba Cloud Redis)
- **Bot:** Telegram-first interface + web dashboard
- **Security:** SAF 7-layer framework on every action
- **Memory:** 7-layer PML with embeddings (`text-embedding-v4`)
- **License:** MIT (open-source)

---

## Build Status

| Phase | Days | Status |
|---|---|---|
| Phase 1: Foundation | Days 1-3 (Jun 27-29) | ✅ Complete (Days 1-3) |
| Phase 2: Memory & Intelligence | Days 4-6 (Jun 30-Jul 2) | ✅ Complete (Days 4-6) |
| Phase 3: UI & Polish | Days 7-9 (Jul 3-5) | Day 7-8 ✅ — in progress |
| Phase 4: Cloud Deploy & Submit | Days 10-12 (Jul 6-8) | Not started |

See [`docs/TRACK4-BUILD-PLAN.md`](docs/TRACK4-BUILD-PLAN.md) Section 6 for detailed checklists.
