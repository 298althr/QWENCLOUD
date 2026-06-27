# Service: Alibaba Cloud Integration

## Purpose

Provides integration with Alibaba Cloud services (ECS, OSS, Cloud Monitor) as required by the hackathon submission rules. The proof file (`backend/src/utils/alibaba.js`) demonstrates real Alibaba Cloud SDK usage.

## Key File

| File | Responsibility |
|---|---|
| `backend/src/utils/alibaba.js` | Alibaba Cloud SDK integration (ECS, OSS, Cloud Monitor) — **hackathon proof file** |

## Services Used

| Service | Purpose | SDK Package |
|---|---|---|
| **ECS** | Hosts the Express backend + Docker containers | `@alicloud/ecs20140526` |
| **OSS** | Stores immutable audit log backups + memory snapshots | `ali-oss` |
| **Cloud Monitor** | External health checks + custom DQ score metrics | `@alicloud/cms20190101` |

## Environment Variables

```
ALIBABA_CLOUD_ACCESS_KEY_ID=your_access_key
ALIBABA_CLOUD_ACCESS_KEY_SECRET=your_secret_key
```

## Functions

### `backupAuditLog(logEntry)`
Uploads an audit log entry as JSON to OSS bucket `althr-autopilot-logs`.
Path: `audit-logs/{date}/{logEntry.id}.json`

### `reportDQScore(score, agentName)`
Sends a custom metric `DQ_Score` to Cloud Monitor with the agent name as dimension.

### `ecsClient`
ECS client for querying instance status and restarting instances.

## Hackathon Proof

The hackathon requires: *"Proof must be a link to a code file in their code repo that demonstrates use of Alibaba Cloud services and APIs."*

This file (`alibaba.js`) is the proof. It must:
- Import real Alibaba Cloud SDK packages
- Initialize clients with real access keys
- Make actual API calls (not just define functions)
- Be linked in the Devpost submission

## Deployment Architecture

```
Alibaba Cloud ECS (Ubuntu 22.04)
├── Docker Engine
│   ├── althr-autopilot (Node.js backend, port 3000)
│   ├── althr-frontend (Next.js, port 3001)
│   └── postgres (if not using RDS)
│
├── Alibaba Cloud RDS PostgreSQL
│   └── Schema: althr_autopilot (7 PML tables + audit + auth)
│
├── Alibaba Cloud Redis
│   ├── DB 0: M1 Event Buffer
│   ├── DB 1: M3 Procedure Cache
│   └── DB 2: Session Cache
│
├── Alibaba Cloud OSS
│   └── Bucket: althr-autopilot-logs
│       └── audit-logs/{date}/{id}.json
│
└── Alibaba Cloud Cloud Monitor
    └── Custom Metric: DQ_Score
```

## Dependencies

- **Inputs from:** Execution Layer (audit log entries), Certainty Pipeline (DQ scores)
- **Outputs to:** OSS (log backups), Cloud Monitor (custom metrics)
- **External:** Alibaba Cloud SDKs

## Setup Guide

See `docs/deployment/alibaba-cloud-setup.md` for step-by-step ECS/RDS/Redis/OSS provisioning.
