# ALTHR Autopilot - Architecture Diagram

This document provides a clear visual representation of the ALTHR Autopilot system architecture, showing how Qwen Cloud connects to the backend, database, and frontend.

## Architecture Diagram (SVG)

![Architecture Diagram](./architecture.svg)

The SVG file is at `docs/architecture.svg`. Open it in any browser to view or export as PNG.

---

## High-Level System Architecture

```mermaid
graph TB
    subgraph "User Interfaces"
        Web[Web Dashboard<br/>Next.js + TypeScript]
        Telegram[Telegram Bot]
    end

    subgraph "API Gateway"
        API[Express.js + Socket.io]
    end

    subgraph "Intelligence Layer"
        Qwen[Qwen Cloud API<br/>qwen3.7-plus / qwen3.7-max<br/>text-embedding-v4]
        DRE[DRE - Deep Research Engine]
        DREV[DREV - DRE Verification]
        CRDS[CRDS - Contextual Reaction Decision Scoring]
        DISC[DISC - Diverse Information Source Credibility]
        DQS[DQS - Decision Quality Score]
        Critique[Claude Critique<br/>External LLM Cross-Check]
        Explain[Explainability Layer]
    end

    subgraph "Security Layer"
        SAF[SAF 7-Layer Framework<br/>Asset • Identity • Network<br/>Policy • Logging • Containment • Governance]
        Whitelist[Command Whitelist]
        Audit[Immutable Audit Log]
    end

    subgraph "Memory Layer"
        PML[PML 7-Layer Memory<br/>M1-M7 with pgvector]
        Redis[Redis Cache]
    end

    subgraph "Monitoring Layer"
        Monitor[System Monitor<br/>CPU • Memory • Disk<br/>Docker • Processes • Ports]
        Alibaba[Alibaba Cloud<br/>ECS • OSS • Cloud Monitor]
    end

    subgraph "Data Storage"
        PG[(PostgreSQL<br/>pgvector)]
        RDS[(Alibaba Cloud RDS)]
    end

    subgraph "Remote Management"
        SSH[SSH Client<br/>ssh2]
        Remote[Remote Linux Hosts<br/>Any Server via SSH]
    end

    Web --> API
    Telegram --> API
    API --> Monitor
    API --> Qwen
    API --> SAF
    API --> PML
    API --> Redis
    API --> SSH

    Qwen --> DRE
    DRE --> DREV
    DREV --> CRDS
    CRDS --> DISC
    DISC --> DQS
    DQS --> Critique
    Critique --> Explain

    SAF --> Whitelist
    SAF --> Audit
    Whitelist --> API
    Audit --> PG

    PML --> PG
    Redis --> PML

    Monitor --> Alibaba
    Alibaba --> Monitor

    SSH --> Remote

    PG --> RDS

    style Web fill:#4F46E5,color:#fff
    style Telegram fill:#229954,color:#fff
    style API fill:#E67E22,color:#fff
    style Qwen fill:#FF6B6B,color:#fff
    style SAF fill:#9B59B6,color:#fff
    style PML fill:#3498DB,color:#fff
    style Monitor fill:#1ABC9C,color:#fff
    style Alibaba fill:#E74C3C,color:#fff
    style PG fill:#95A5A6,color:#fff
    style SSH fill:#F39C12,color:#fff
```

---

## Data Flow: Agent Decision Pipeline

```mermaid
sequenceDiagram
    participant User as User
    participant Web as Web Dashboard
    participant API as API Gateway
    participant Monitor as System Monitor
    participant Qwen as Qwen Cloud
    participant Pipeline as Decision Pipeline
    participant SAF as SAF Framework
    participant Audit as Audit Log
    participant DB as PostgreSQL
    participant Remote as Remote Host

    User->>Web: Trigger action / report issue
    Web->>API: POST /agent
    API->>Monitor: Collect system state
    Monitor-->>API: CPU, mem, disk, Docker metrics
    API->>Qwen: Send context + user request
    Qwen-->>API: Initial analysis + proposed actions

    API->>Pipeline: Run 7-layer decision pipeline
    Pipeline->>Pipeline: DRE (Deep Research)
    Pipeline->>Pipeline: DREV (Verification)
    Pipeline->>Pipeline: CRDS (Reaction Scoring)
    Pipeline->>Pipeline: DISC (Source Credibility)
    Pipeline->>Pipeline: DQS (Quality Score)
    Pipeline->>Pipeline: Critique (External LLM)
    Pipeline->>Pipeline: Explainability
    Pipeline-->>API: Final decision + confidence

    API->>SAF: Run 7-layer security check
    SAF->>SAF: L1: Asset classification
    SAF->>SAF: L2: Identity & authority
    SAF->>SAF: L3: Network segmentation
    SAF->>SAF: L4: Command whitelist
    SAF->>SAF: L5: Immutable logging
    SAF->>SAF: L6: Blast radius containment
    SAF->>SAF: L7: Governance (HITL)
    SAF-->>API: Pass / Require approval

    alt Confidence >= 0.85 AND SAF passes
        API->>Remote: Execute command via SSH
        Remote-->>API: Command result
        API->>Audit: Log action + result
        Audit->>DB: Write immutable record
        API-->>Web: Success notification
    else High-risk OR low confidence
        API->>DB: Create approval request
        API-->>Web: Show approval dialog
        User->>Web: Approve / Reject
        Web->>API: POST /approvals/approve
        API->>Remote: Execute command
        API->>Audit: Log action + approval
        API-->>Web: Execution result
    end
```

---

## Component Details

### User Interfaces

- **Web Dashboard** (Next.js + TypeScript + Tailwind CSS)
  - Real-time monitoring dashboard
  - AI agent chat interface
  - Approval queue management
  - Remote SSH host management
  - Decision intelligence visualization

- **Telegram Bot** (Node.js + Telegram Bot API)
  - Mobile-first control interface
  - Command execution
  - Approval/reject actions
  - System status alerts

### API Gateway

- **Express.js + Socket.io**
  - REST API for all operations
  - WebSocket for real-time updates
  - Route handlers for monitoring, decisions, memory, security
  - Authentication and authorization middleware

### Intelligence Layer (Qwen Cloud)

- **Qwen Models**: qwen3.7-plus, qwen3.7-max, text-embedding-v4
- **7-Layer Decision Pipeline**:
  1. **DRE** (Deep Research Engine): Generates candidate solutions
  2. **DREV** (DRE Verification): Validates evidence for each candidate
  3. **CRDS** (Contextual Reaction Decision Scoring): Scores action impact
  4. **DISC** (Diverse Information Source Credibility): Ranks information sources
  5. **DQS** (Decision Quality Score): Calculates overall decision quality
  6. **Critique** (Claude Critique): External LLM cross-check for bias
  7. **Explainability**: Human-readable reasoning explanation

### Security Layer (SAF 7-Layer Framework)

1. **L1 - Asset Classification**: Critical / Important / Normal
2. **L2 - Identity & Authority**: Admin / Operator / Viewer
3. **L3 - Network Segmentation**: Local execution only
4. **L4 - Policy Enforcement**: Command whitelist
5. **L5 - Immutable Logging**: Audit log with triggers
6. **L6 - Containment**: Blast radius limits
7. **L7 - Governance**: Human-in-the-loop for high-risk actions

### Memory Layer (PML 7-Layer)

1. **M1 - Episodic**: Specific events and experiences
2. **M2 - Semantic**: Facts and concepts
3. **M3 - Procedural**: How-to knowledge
4. **M4 - Working**: Short-term context
5. **M5 - Emotional**: Sentiment and impact
6. **M6 - Social**: User preferences and interactions
7. **M7 - Meta-cognitive**: Learning and self-improvement

### Monitoring Layer

- **System Metrics**: CPU, memory, disk usage
- **Docker**: Container status, logs, resource usage
- **Processes**: Top processes by CPU/memory
- **Ports**: Listening ports and connections
- **Alibaba Cloud Integration**: ECS instance metrics, OSS storage, Cloud Monitor

### Data Storage

- **PostgreSQL (pgvector)**: Primary database with vector embeddings
- **Alibaba Cloud RDS**: Managed PostgreSQL for production
- **Redis**: Cache layer for performance

### Remote Management

- **SSH Client (ssh2)**: Generic SSH connection to any Linux host
- **Remote Hosts**: Configured via `REMOTE_HOSTS` environment variable
- **Capabilities**: Docker management, file operations, process control, port scanning

---

## Alibaba Cloud Integration

```mermaid
graph LR
    subgraph "ALTHR Autopilot"
        Backend[Backend API]
    end

    subgraph "Alibaba Cloud"
        ECS[ECS Instance<br/>Compute]
        RDS[RDS PostgreSQL<br/>Database]
        Redis[Redis<br/>Cache]
        OSS[OSS<br/>Object Storage]
        CM[Cloud Monitor<br/>Metrics]
    end

    Backend --> ECS
    Backend --> RDS
    Backend --> Redis
    Backend --> OSS
    Backend --> CM

    style Backend fill:#4F46E5,color:#fff
    style ECS fill:#E67E22,color:#fff
    style RDS fill:#3498DB,color:#fff
    style Redis fill:#9B59B6,color:#fff
    style OSS fill:#1ABC9C,color:#fff
    style CM fill:#E74C3C,color:#fff
```

**Implementation**: See `backend/src/utils/alibaba.js` for Alibaba Cloud SDK integration.

---

## Deployment Architecture

```mermaid
graph TB
    subgraph "Development"
        DevDocker[Docker Compose<br/>Local]
    end

    subgraph "Production"
        ECS[Alibaba Cloud ECS]
        DockerCompose[Docker Compose<br/>Production]
        RDS[Alibaba Cloud RDS]
        Redis[Alibaba Cloud Redis]
    end

    DevDocker -->|Deploy| ECS
    ECS --> DockerCompose
    DockerCompose --> RDS
    DockerCompose --> Redis

    style DevDocker fill:#95A5A6,color:#fff
    style ECS fill:#E67E22,color:#fff
    style DockerCompose fill:#3498DB,color:#fff
    style RDS fill:#2ECC71,color:#fff
    style Redis fill:#9B59B6,color:#fff
```

**Production Config**: See `docker-compose.prod.yml` for resource limits and production settings.

---

## SOS Layer Mapping

ALTHR Autopilot implements the Solution Operating System (SOS) architecture as a domain-specific implementation for server operations automation.

```mermaid
graph TB
    subgraph "SOS Layer 1: Experience Layer"
        Web[Web Dashboard]
        Telegram[Telegram Bot]
    end

    subgraph "SOS Layer 2: Problem Understanding"
        Intent[Intent Parser]
        Context[Context Acquisition]
    end

    subgraph "SOS Layer 3: Universal Intelligence Kernel UIK"
        UIC[UIC - Universal Intelligence Cell]
        UO[UO - Universal Orchestrator]
        USMS[USMS - State Management]
        UEB[UEB - Event Bus]
        IQF[IQF - Intelligence Quality]
        PML[PML - Performance Memory]
        MCS[MCS - Mechanical Control]
        RIL[RIL - Resource Intelligence]
    end

    subgraph "SOS Layer 4: Intelligence Pipeline"
        DRE[DRE - Deep Research]
        DREV[DREV - Verification]
        CRDS[CRDS - Context Scoring]
        DISC[DISC - Source Credibility]
        DQS[DQS - Decision Quality]
        Critique[Critique - External LLM]
        Explain[Explainability]
    end

    subgraph "SOS Layer 5: Simulation Adapted"
        SystemState[System State]
        WalkForward[Walk-Forward Validation]
    end

    subgraph "SOS Layer 6: Solution Architecture"
        ActionPlan[Action Planning]
        Roadmap[Execution Roadmap]
    end

    subgraph "SOS Layer 7: Execution & Learning"
        Orchestrator[Execution Manager]
        Monitor[Monitoring Engine]
        Learning[Learning Engine]
    end

    subgraph "SOS Layer 8: Platform Integration"
        Qwen[Qwen Cloud]
        Alibaba[Alibaba Cloud]
        SSH[Remote SSH]
    end

    subgraph "SOS Layer 9: Engineering"
        Backend[Backend Service]
        Frontend[Frontend Service]
        PG[PostgreSQL]
        Redis[Redis]
    end

    subgraph "SOS Layer 10: Governance"
        SAF[SAF 7-Layer]
        Validation[5-Level Validation]
    end

    Web --> Intent
    Telegram --> Intent
    Intent --> Context
    Context --> UIC
    UIC --> UO
    UO --> DRE
    DRE --> DREV
    DREV --> CRDS
    CRDS --> DISC
    DISC --> DQS
    DQS --> Critique
    Critique --> Explain
    Explain --> ActionPlan
    ActionPlan --> Roadmap
    Roadmap --> Orchestrator
    Orchestrator --> Monitor
    Orchestrator --> Learning
    Learning --> PML
    Orchestrator --> SAF
    SAF --> Validation
    UO --> USMS
    UO --> UEB
    UO --> IQF
    UO --> RIL
    UO --> MCS
    SystemState --> WalkForward
    Qwen --> DRE
    Alibaba --> Monitor
    SSH --> Orchestrator
    Backend --> PG
    Backend --> Redis
    Frontend --> Backend

    style Web fill:#4F46E5,color:#fff
    style Telegram fill:#229954,color:#fff
    style UIC fill:#E67E22,color:#fff
    style UO fill:#E67E22,color:#fff
    style DRE fill:#FF6B6B,color:#fff
    style DREV fill:#FF6B6B,color:#fff
    style CRDS fill:#FF6B6B,color:#fff
    style DISC fill:#FF6B6B,color:#fff
    style DQS fill:#FF6B6B,color:#fff
    style Critique fill:#FF6B6B,color:#fff
    style Explain fill:#FF6B6B,color:#fff
    style SAF fill:#9B59B6,color:#fff
    style PML fill:#3498DB,color:#fff
    style Monitor fill:#1ABC9C,color:#fff
    style Learning fill:#1ABC9C,color:#fff
    style Qwen fill:#E74C3C,color:#fff
    style Alibaba fill:#E74C3C,color:#fff
    style SSH fill:#F39C12,color:#fff
    style PG fill:#95A5A6,color:#fff
    style Redis fill:#95A5A6,color:#fff
```

**Mapping Details:**
- **SOS V1 (Foundation)**: Core philosophy alignment
- **SOS V2 (UIK)**: UIC, UO, USMS, UEB, IQF, PML, MCS, RIL implemented
- **SOS V3 (Problem Understanding)**: Intent parser, context acquisition
- **SOS V4 (Intelligence Pipeline)**: DRE, DREV, CRDS, DISC, DQS, Critique, Explainability
- **SOS V5 (Simulation)**: Adapted to system state + walk-forward validation (SAF provides governance)
- **SOS V6 (Solution Architecture)**: Action planning, execution roadmap
- **SOS V7 (Execution & Learning)**: Orchestrator, monitor, learning engine
- **SOS V8 (Platform Integration)**: Qwen Cloud, Alibaba Cloud, Remote SSH
- **SOS V9 (Engineering)**: Microservices, event-driven, polyglot persistence
- **SOS V10 (Governance)**: SAF 7-layer, 5-level validation

For detailed mapping, see [`docs/sos-althr-mapping.md`](docs/sos-althr-mapping.md).
