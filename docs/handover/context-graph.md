# Context Graph — Visual Map of All Components

## How Everything Connects

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL INTERFACES                              │
│                                                                          │
│   Telegram Bot API          Web Browser (Next.js)                        │
│         │                          │                                     │
│         ▼                          ▼                                     │
│   ┌──────────┐              ┌──────────────┐                             │
│   │ Telegram  │              │  Web         │                             │
│   │ Bot       │              │  Dashboard   │                             │
│   │           │              │  (Next.js)   │                             │
│   └─────┬────┘              └──────┬───────┘                             │
│         │                          │                                     │
└─────────┼──────────────────────────┼─────────────────────────────────────┘
          │                          │
          │    ┌─────────────────────┤
          │    │                     │
          ▼    ▼                     │
┌─────────────────────────────────────┐
│        API GATEWAY                   │     docs/services/api-gateway.md
│  Express.js + Socket.io (port 3000)  │
│                                      │
│  REST: /api/agent, /api/command,     │
│        /api/file, /api/docker,       │
│        /api/processes, /api/ports,   │
│        /api/audit, /api/memory,      │
│        /api/deployments, /api/health │
│                                      │
│  WS: reasoning_stream,               │
│      response_stream,                │
│      anomaly_alert,                  │
│      approval_needed                 │
└──────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      QWEN AI ENGINE                  │     docs/services/qwen-ai-engine.md
│                                      │
│  ┌──────────────┐  ┌───────────────┐ │
│  │ Intent Parser │  │ Action Planner│ │
│  │ qwen3.7-plus  │  │ qwen3.7-max   │ │
│  │               │  │ + thinking    │ │
│  └──────┬───────┘  └───────┬───────┘ │
│         │                  │         │
│  ┌──────┴──────────────────┴───────┐ │
│  │  12 Function Calling Tools       │ │
│  │  execute_command, read_file,     │ │
│  │  write_file, list_processes,     │ │
│  │  check_ports, docker_build,      │ │
│  │  git_clone, run_security_scan,   │ │
│  │  get_server_health, saf_check,   │ │
│  │  query_memory, store_memory      │ │
│  └──────────────────────────────────┘ │
│                                      │
│  ┌──────────────┐  ┌───────────────┐ │
│  │ Confidence   │  │ Conversations │ │
│  │ Scorer       │  │ API           │ │
│  │ (structured  │  │ (cross-device │ │
│  │  output JSON)│  │  sessions)    │ │
│  └──────────────┘  └───────────────┘ │
│                                      │
│  ┌──────────────┐                    │
│  │ Embeddings   │                    │
│  │ text-embed-  │                    │
│  │ ding-v4      │                    │
│  │ (1024 dims)  │                    │
│  └──────────────┘                    │
└──────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   CERTAINTY-DRIVEN PIPELINE          │     docs/services/certainty-pipeline.md
│                                      │
│  1. Problem Definition                │
│  2. Context Identification           │
│  3. Constraint Mapping                │
│  4. Intent Clarification              │
│  5. Expert Validation                 │
│  6. Confidence Scoring (JSON)         │
│  7. Authorization (auto/approve/block)│
└──────────────┬───────────────────────┘
               │
       ┌───────┼───────┐
       ▼       ▼       ▼
    Auto    Approve   Block
       │       │       │
       │       │       └─→ Audit Log (blocked)
       │       │
       │  ┌────┘
       ▼  ▼
┌─────────────────────────────────────┐
│      SAF FRAMEWORK (7 LAYERS)        │     docs/services/saf-framework.md
│                                      │
│  L1: Asset Classification             │
│  L2: Identity & Authority             │
│  L3: Network Segmentation             │
│  L4: Policy Enforcement (whitelist)   │
│  L5: Immutable Logging                │
│  L6: Containment                      │
│  L7: Governance                       │
│                                      │
│  Any layer FAIL → block + audit       │
│  All layers PASS → execute            │
└──────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      EXECUTION & TOOL LAYER          │
│                                      │
│  ┌──────────┐ ┌──────────┐          │
│  │ Command   │ │ File Mgmt│          │
│  │ Executor  │ │ (fs)     │          │
│  └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐          │
│  │ Docker    │ │ GitHub   │          │
│  │ Build     │ │ Clone    │          │
│  └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐          │
│  │ Process   │ │ Port     │          │
│  │ Monitor   │ │ Monitor  │          │
│  └──────────┘ └──────────┘          │
│  ┌──────────┐ ┌──────────┐          │
│  │ Deploy    │ │ Security │          │
│  │ Script    │ │ Audit    │          │
│  └──────────┘ └──────────┘          │
└──────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      PML MEMORY (7 LAYERS)           │     docs/services/pml-memory.md
│                                      │
│  ┌─────────┐  ┌─────────┐           │
│  │ M1: Raw │  │ M2:     │           │
│  │ Events  │  │ Struct  │           │
│  │ (Redis) │  │ (PG)    │           │
│  └─────────┘  └─────────┘           │
│  ┌─────────┐  ┌─────────┐           │
│  │ M3: Op  │  │ M4:     │           │
│  │ (PG+RD) │  │ Exec    │           │
│  └─────────┘  └─────────┘           │
│  ┌─────────┐  ┌─────────┐           │
│  │ M5:     │  │ M6:     │           │
│  │ Decision│  │ Learn   │           │
│  │ (PG)    │  │ (PG+vec)│           │
│  └─────────┘  └─────────┘           │
│  ┌─────────────────────┐            │
│  │ M7: Strategic       │            │
│  │ (PG+vec)            │            │
│  └─────────────────────┘            │
│                                      │
│  Learning Loop:                      │
│  Action → Outcome → M6 → M3 (SOP)   │
└──────────────┬───────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      ALIBABA CLOUD                   │     docs/services/alibaba-cloud.md
│                                      │
│  ECS (compute) ──→ Docker containers │
│  OSS (storage) ──→ Audit log backups │
│  Cloud Monitor ──→ DQ score metrics  │
│  RDS (PG)     ──→ M2-M7 + audit      │
│  Redis        ──→ M1 + cache         │
└─────────────────────────────────────┘
```

## Service-to-File Mapping

```
Service                    → Source File                           → Doc File
─────────────────────────────────────────────────────────────────────────────
Telegram Bot               → backend/src/telegram/bot.js           → docs/services/telegram-bot.md
API Gateway                → backend/src/server.js + routes/       → docs/services/api-gateway.md
Qwen AI Engine             → backend/src/qwen/                     → docs/services/qwen-ai-engine.md
Certainty Pipeline         → backend/src/pipeline/certainty.js     → docs/services/certainty-pipeline.md
SAF Framework              → backend/src/pipeline/saf.js           → docs/services/saf-framework.md
PML Memory                 → backend/src/memory/                   → docs/services/pml-memory.md
Monitoring                 → backend/src/monitors/                 → docs/services/monitoring-service.md
Alibaba Cloud Integration  → backend/src/utils/alibaba.js          → docs/services/alibaba-cloud.md
Web Dashboard              → frontend/src/                         → (TBD during build)
```

## Database-to-Service Mapping

```
Table              → Which Service Writes        → Which Service Reads
──────────────────────────────────────────────────────────────────────
m1_raw_events      → Monitoring Service          → Qwen AI Engine (context)
m2_structured_data → Monitoring Service          → Qwen AI Engine (context)
m3_operational     → PML Learning Loop           → Qwen AI Engine (SOPs)
m4_execution       → Execution Layer             → Dashboard, Analytics
m5_decision        → Certainty Pipeline          → Qwen AI Engine (history)
m6_learning        → PML Learning Loop           → Qwen AI Engine (patterns)
m7_strategic       → PML Learning Loop           → Qwen AI Engine (patterns)
audit_log          → SAF Framework               → Dashboard, Security page
users              → Auth system                 → Auth system
sessions           → Auth system                 → API Gateway
qwen_conversations → Telegram Bot + Dashboard    → Qwen AI Engine
```
