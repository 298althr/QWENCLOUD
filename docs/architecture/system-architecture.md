# System Architecture

## High-Level Component Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACES                              │
│                                                                      │
│  ┌──────────────┐              ┌──────────────────────────┐         │
│  │  Telegram Bot │              │  Web Dashboard (Next.js)  │         │
│  │  (Mobile)     │              │  Luxury Dark Mode         │         │
│  └──────┬───────┘              └──────────┬───────────────┘         │
│         │                                 │                          │
└─────────┼─────────────────────────────────┼──────────────────────────┘
          │                                 │
          ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                               │
│  Express.js + WebSocket (Socket.io) — port 3000                      │
│                                                                      │
│  Routes: /api/agent, /api/command, /api/file/*, /api/docker/*,      │
│          /api/health, /api/processes, /api/ports, /api/audit,       │
│          /api/deployments, /api/memory/*                             │
│                                                                      │
│  See: docs/services/api-gateway.md                                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    QWEN AI REASONING ENGINE                          │
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐              │
│  │ Intent Parser│  │ Action Planner│  │ Confidence Scorer│            │
│  │ (qwen3.7-plus)│  │(qwen3.7-max) │  │ (DQS formula)   │            │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────┘              │
│         │                │                    │                      │
│  See: docs/services/qwen-ai-engine.md                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CERTAINTY-DRIVEN DECISION PIPELINE                      │
│                                                                      │
│  1. Problem Definition                                                │
│  2. Context Identification                                           │
│  3. Constraint Mapping                                                │
│  4. Intent Clarification                                              │
│  5. Expert Validation                                                 │
│  6. Confidence Scoring (structured output)                           │
│  7. Execution Authorization (auto / approve / block)                 │
│                                                                      │
│  See: docs/services/certainty-pipeline.md                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   [Auto-Execute]    [Human Approval]    [Block + Escalate]
          │                    │                    │
          │           Telegram + Dashboard          │
          │           approval buttons              │
          └────────────────────┼────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              SECURITY-BY-ARCHITECTURE (SAF)                          │
│                                                                      │
│  L1: Asset Classification → L2: Identity/Authority →               │
│  L3: Network Segmentation → L4: Policy Enforcement →               │
│  L5: Immutable Logging → L6: Containment → L7: Governance          │
│                                                                      │
│  Every action passes through all 7 layers before execution.         │
│  See: docs/services/saf-framework.md                                 │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              EXECUTION & TOOL LAYER                                   │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐           │
│  │ Command   │ │ File Mgmt│ │ Docker   │ │ GitHub Clone │           │
│  │ Executor  │ │ (fs)     │ │ Build    │ │ (git)        │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐           │
│  │ Process   │ │ Port     │ │ Deploy   │ │ Security     │           │
│  │ Monitor   │ │ Monitor  │ │ Script   │ │ Audit        │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘           │
│                                                                      │
│  See: docs/services/monitoring-service.md                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              MEMORY & LEARNING LAYER (PML)                           │
│                                                                      │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐        │
│  │ M1: Raw   │  │ M2:       │  │ M3:       │  │ M4:       │        │
│  │ Events    │  │ Structured│  │ Operational│  │ Execution │        │
│  │ (Redis)   │  │ (PG)      │  │ (PG+Redis)│  │ (PG)      │        │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘        │
│  ┌───────────┐  ┌───────────┐  ┌───────────────────────┐          │
│  │ M5:       │  │ M6:       │  │ M7: Strategic         │          │
│  │ Decision  │  │ Learning  │  │ (regime changes,      │          │
│  │ Memory    │  │ Memory    │  │  major wins/losses)   │          │
│  │ (PG)      │  │ (PG+vec)  │  │ (PG+vec)              │          │
│  └───────────┘  └───────────┘  └───────────────────────┘          │
│                                                                      │
│  Storage: PostgreSQL (structured) + Redis (hot recall)              │
│  Embeddings: text-embedding-v4 (1024 dims) on M6/M7                │
│  See: docs/services/pml-memory.md                                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              ALIBABA CLOUD DEPLOYMENT                                │
│                                                                      │
│  ECS Instance (Ubuntu 22.04) → Docker → Express + Next.js           │
│  OSS (object storage for audit log backups)                         │
│  Cloud Monitor (external health checks + custom DQ metrics)         │
│                                                                      │
│  See: docs/services/alibaba-cloud.md                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Dependency Graph

```
Telegram Bot ──→ API Gateway ──→ Qwen AI Engine ──→ Certainty Pipeline
Web Dashboard ──→ API Gateway ──→ Qwen AI Engine ──→ Certainty Pipeline
                                          │
                                          ▼
                                    SAF Framework
                                          │
                                          ▼
                              Execution & Tool Layer
                                          │
                                          ▼
                                  PML Memory Layer
                                          │
                                          ▼
                              PostgreSQL + Redis + pgvector
                                          │
                                          ▼
                              Alibaba Cloud (ECS/OSS/CMS)
```

## Key Architectural Decisions

| Decision | Rationale |
|---|---|
| **Express.js (not FastAPI)** | Leverages existing Server22 codebase with 12+ working API endpoints |
| **PostgreSQL + Redis (not just Redis)** | Redis for hot recall (M1 events, session state), PG for persistent structured memory (M2-M7) |
| **pgvector fallback (not just OpenSearch)** | If OpenSearch setup takes too long on Alibaba Cloud, pgvector provides vector search within PostgreSQL |
| **Socket.io (not raw WebSocket)** | Auto-reconnection, rooms, broadcasting — simpler than raw WS for dashboard real-time updates |
| **Qwen Conversations API (not manual message arrays)** | Server-managed context across devices — no manual session state management |
| **Function calling (not prompt parsing)** | Qwen returns structured `tool_calls` JSON — more reliable than parsing free-text responses |
| **Immutable audit log (not regular log table)** | PostgreSQL triggers prevent UPDATE/DELETE — required for production-grade audit trail |
