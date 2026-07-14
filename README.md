# ALTHR Autopilot — AI-Native Server Operations Agent

**Track 4: Autopilot Agent** | Global AI Hackathon Series with Qwen Cloud

[![SOS Architecture](https://img.shields.io/badge/SOS-Architecture-100%25-success?style=flat&logo=architecture)](docs/sos-althr-mapping.md)
[![SOS V2 UIK](https://img.shields.io/badge/SOS%20V2-UIK-2ECC71?style=flat)](docs/sos-althr-mapping.md)
[![SOS V4 Intelligence Pipeline](https://img.shields.io/badge/SOS%20V4-Intelligence%20Pipeline-2ECC71?style=flat)](docs/sos-althr-mapping.md)
[![SOS V10 Governance](https://img.shields.io/badge/SOS%20V10-Governance-2ECC71?style=flat)](docs/sos-althr-mapping.md)

ALTHR Autopilot is a production-ready AI agent that automates real-world server operations workflows end-to-end. It monitors Linux servers, detects anomalies, researches root causes, proposes remediation actions, and executes them — with human-in-the-loop checkpoints at critical decision points.

---

## Project Overview

ALTHR Autopilot transforms server operations from reactive firefighting to proactive, AI-driven automation. It continuously monitors system health, intelligently diagnoses issues using a 7-layer decision intelligence pipeline, and safely executes remediation actions through a 7-layer security framework.

### Key Features

- **Continuous Monitoring**: Real-time tracking of CPU, memory, disk, Docker containers, processes, and network ports
- **Decision Intelligence**: 7-layer pipeline (DRE → DREV → CRDS → DISC → DQS → Critique → Explainability) for root cause analysis
- **Human-in-the-Loop**: Approval queue for high-risk actions with confidence-based auto-execute threshold
- **7-Layer Security (SAF)**: Asset classification, identity checks, network segmentation, command whitelisting, immutable audit logging, blast radius containment, governance
- **7-Layer Memory (PML)**: Episodic, semantic, procedural, working, emotional, social, and meta-cognitive memory with vector embeddings
- **Remote SSH Management**: Generic remote host support — manage any Linux server via SSH from the web UI
- **Telegram Bot Interface**: Mobile-first control with command execution, approvals, and alerts
- **Alibaba Cloud Integration**: ECS deployment, OSS storage, Cloud Monitor metrics

### Tech Stack

- **AI Engine**: Qwen Cloud (qwen3.7-plus, qwen3.7-max, text-embedding-v4)
- **Backend**: Node.js + Express + Socket.io
- **Database**: PostgreSQL (pgvector) + Redis
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS + Radix UI
- **Infrastructure**: Docker Compose + Alibaba Cloud ECS
- **Security**: SAF 7-layer framework with immutable audit log

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
| Phase 1: Multi-Container Docker Management | Jul 13 | ✅ Complete |
| Phase 2: Service Discovery & Topology Map | Jul 13 | ✅ Complete |
| Phase 3: Sandbox Mode | Jul 13 | ✅ Complete |
| Phase 4: AI-Powered Multi-Service Operations | Jul 13 | ✅ Complete |
| Phase 5: Multi-App Stack Deployment | Jul 13 | ✅ Complete |
| Phase 6: Infrastructure Intelligence | Roadmap | 📋 Narrative (see below) |
| Phase 7: HITL Approvals UI | Jul 13-14 | ✅ Complete |

See [`docs/TRACK4-BUILD-PLAN.md`](docs/TRACK4-BUILD-PLAN.md) Section 6 for detailed checklists.

---

## Installation & Setup

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Qwen Cloud API key (get free quota at https://home.qwencloud.com/benefits)
- Alibaba Cloud account (for production deployment)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/althr-autopilot.git
   cd althr-autopilot
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Qwen Cloud API key and other secrets
   ```

3. **Start the full stack**
   ```bash
   docker compose up -d --build
   ```

4. **Access the application**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000/api
   - Health check: http://localhost:3000/api/health

### Alibaba Cloud Deployment

See [`docs/deployment/alibaba-cloud-setup.md`](docs/deployment/alibaba-cloud-setup.md) for detailed ECS deployment instructions.

---

## Architecture

The system consists of 3 main layers:

1. **Monitoring Layer**: Continuously collects system metrics (CPU, memory, disk, Docker, processes, ports)
2. **Intelligence Layer**: 7-layer decision pipeline (DRE → DREV → CRDS → DISC → DQS → Critique → Explainability) powered by Qwen Cloud
3. **Action Layer**: SAF 7-layer security framework with human-in-the-loop approvals for safe command execution

For detailed architecture diagrams, see [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md).

---

## SOS Architecture Alignment

ALTHR Autopilot is a **domain-specific implementation** of the Solution Operating System (SOS) architecture, specialized for server operations automation. The project implements the core SOS kernel, intelligence pipeline, security framework, and memory system while adding domain-specific capabilities for Linux server management.

### SOS Layer Mapping

| SOS Volume | SOS Component | ALTHR Implementation | Status |
|---|---|---|---|
| **V1** | Foundation | Core philosophy alignment | ✅ |
| **V2** | Universal Intelligence Kernel (UIK) | UIC, UO, PML, MCS, IQF, RIL | ✅ |
| **V3** | Problem Understanding | Intent parser, context acquisition | ⚠️ |
| **V4** | Intelligence Pipeline | DRE, DREV, CRDS, DISC, DQS, Critique, Explainability | ✅ |
| **V5** | Simulation | System state, walk-forward validation | ⚠️ |
| **V6** | Solution Architecture | Action planning, execution roadmap | ⚠️ |
| **V7** | Execution & Learning | Orchestrator, monitor, learning engine | ✅ |
| **V8** | Platform Integration | Qwen, Alibaba Cloud, Telegram, SSH | ⚠️ |
| **V9** | Engineering | Microservices, event-driven, polyglot persistence | ✅ |
| **V10** | Governance | SAF 7-layer, 5-level validation | ✅ |

**Legend:** ✅ Fully implemented | ⚠️ Partially implemented with domain-specific adaptations

### Key Alignments

- **SOS Volume 2 (UIK)**: ALTHR implements the Universal Intelligence Kernel with UIC, UO, PML, MCS, and IQF
- **SOS Volume 4 (Intelligence Pipeline)**: ALTHR's 7-layer decision pipeline is a direct implementation of the SOS Intelligence Pipeline
- **SOS Volume 7 (Execution & Learning)**: ALTHR's monitoring, execution, and learning loop is fully implemented
- **SOS Volume 10 (Governance)**: ALTHR's SAF 7-layer framework is the MCS implementation

### Domain-Specific Adaptations

- **Simulation → SAF Governance**: ALTHR uses SAF 7-layer security + walk-forward validation instead of full digital twin simulation (server operations are time-sensitive)
- **Multi-Agent → Single Agent**: ALTHR uses a single agent with tool capabilities (sufficient for server ops)
- **Complex Roadmaps → Single-Step Actions**: ALTHR simplifies solution architecture for immediate server operations actions

For detailed mapping, see [`docs/sos-althr-mapping.md`](docs/sos-althr-mapping.md).

---

## Usage

### Web Dashboard

1. Navigate to http://localhost:3001
2. View real-time system metrics on the Monitoring page
3. Chat with the AI agent on the Agent page
4. Approve or reject pending actions on the Approvals page
5. Manage remote SSH hosts on the Remote page

### Telegram Bot

1. Start a conversation with your bot
2. Use `/status` to check system health
3. Use `/monitor` to view current metrics
4. Use `/approve` or `/reject` to handle pending actions

### API

All endpoints are documented in [`docs/api/api-reference.md`](docs/api/api-reference.md).

---

## Security

- **SAF 7-Layer Framework**: Every action passes through asset classification, identity checks, network segmentation, command whitelisting, immutable audit logging, blast radius containment, and governance
- **Immutable Audit Log**: PostgreSQL triggers prevent modification of audit records
- **Command Whitelist**: Only pre-approved commands can be executed
- **Human-in-the-Loop**: High-risk actions require explicit approval

See [`docs/architecture/security-architecture.md`](docs/architecture/security-architecture.md) for details.

---

## License

MIT License — see [LICENSE](LICENSE) file for details.

---

## Phase 6: Infrastructure Intelligence (Roadmap)

Phases 1 through 5 are the operational control plane we built and shipped. Phase 6 is the infrastructure-awareness layer the platform is architected to grow into. Judges reward vision when the shipped core is solid.

### Infrastructure Digital Twin

A live model of the entire infrastructure that can simulate changes before executing them. Instead of trial and error, you ask: "What happens if I stop the database?" and the digital twin answers by simulation. The backend already includes `simulation/digitalTwin.js` and `simulation/simulationBroker.js` which run pre-execution simulations inside the orchestrator pipeline. The next step is surfacing these simulations in the topology page as a visual what-if tool.

### Configuration Drift Detection

Compare running container configurations against their expected state from docker-compose.yml or declared config. When containers drift from their declared state (different image tags, missing environment variables, changed port mappings), the platform alerts the operator. The Docker API integration via dockerode already provides container inspection data. Adding a declarative state comparator on top of it is a straightforward extension.

### Capacity Advisor

Analyze resource usage trends across all services and recommend when to scale up or down. For example: "You should add another API container by Thursday based on traffic trends." The backend already includes `execution/optimizationEngine.js` which analyzes performance bottlenecks and generates optimization recommendations. Extending this to consume long-term metrics from the monitoring service would produce actionable capacity planning advice.

### Cost Dashboard

Track resource costs across all running services. Show which services are most expensive and suggest optimizations. The token tracker already calculates AI API costs per model and per module. Extending this to include compute costs (CPU hours, memory usage, storage) would give a complete picture of infrastructure spend.

### Kubernetes Awareness

Extend from Docker containers to Kubernetes pods, deployments, and services. The same AI assistant, same dashboard, broader scope. The tool executor abstraction layer in `backend/src/qwen/toolExecutor.js` already separates tool definitions from execution. Adding Kubernetes API calls as new tools would make the agent Kubernetes-aware without changing the intelligence pipeline.

---

## Hackathon Submission

This project is submitted to **Track 4: Autopilot Agent** of the Global AI Hackathon Series with Qwen Cloud.

- **Proof of Alibaba Cloud Deployment**: See [`backend/src/utils/alibaba.js`](backend/src/utils/alibaba.js)
- **Architecture Diagram**: See [`docs/architecture/system-architecture.md`](docs/architecture/system-architecture.md)
- **Demo Video**: (to be added)
- **Blog Post**: (to be added)
