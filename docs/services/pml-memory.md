# Service: PML (Performance Memory Layer)

## Purpose

A 7-layer memory system that stores everything the agent experiences — from raw events to strategic patterns. Enables cross-session learning, semantic search, and remediation playbook auto-generation.

## Key Files

| File | Responsibility |
|---|---|
| `backend/src/memory/pml.js` | Store/retrieve across 7 layers |
| `backend/src/memory/learning.js` | Learning loop + playbook generation |
| `backend/src/memory/schema.sql` | PostgreSQL schema (7 tables + audit + auth) |

## The 7 Memory Layers

| Layer | Name | Storage | Purpose | Retention |
|---|---|---|---|---|
| M1 | Raw Events | Redis (stream) + PG | High-frequency logs, anomaly events | 7 days |
| M2 | Structured Data | PostgreSQL | Server state snapshots, configs | 30 days |
| M3 | Operational | PG + Redis (hash) | SOPs, runbooks, remediation playbooks | 90 days |
| M4 | Execution | PostgreSQL | Every action: type, cost, result, approval | 30 days |
| M5 | Decision | PostgreSQL | Context, alternatives, confidence, reasoning | 365 days |
| M6 | Learning | PG + pgvector | Errors, drift, improvements (with embeddings) | Permanent |
| M7 | Strategic | PG + pgvector | Regime changes, major wins/losses (with embeddings) | Permanent |

## Storage Tiers

```
Hot (Redis)     → M1 events, M3 procedures, session state     [< 5ms access]
Warm (Postgres) → M2, M4, M5 structured data                  [< 20ms access]
Cold (pgvector) → M6, M7 vector embeddings + semantic search  [< 100ms access]
```

## Embeddings

- Model: `text-embedding-v4` (1024 dimensions)
- Applied to: M6 (Learning Memory), M7 (Strategic Memory)
- Used for: Semantic search ("find similar past issues")
- Batch limit: 10 texts per API call, max 8,192 tokens per batch

## Learning Loop

```
Action executed
    │
    ▼
Outcome measured (success/failure/timeout)
    │
    ▼
Error detection (if failure)
    │
    ▼
Pattern stored in M6 with embedding
    │
    ▼
If successful remediation → SOP auto-generated in M3
    │
    ▼
Next time similar anomaly occurs:
    Agent checks M3 first (before Qwen diagnosis)
    → Applies known fix → Faster resolution
```

## DQS Score Tracking

Every decision is scored on 5 dimensions (0-1 each):
1. Information Quality — was sufficient info available?
2. Model Quality — was the right model/approach used?
3. Reasoning Quality — was the reasoning sound?
4. Execution Quality — was execution clean?
5. Learning Quality — was the outcome learned from?

Overall DQ Score = average × 100 (0-100 scale)

## Dependencies

- **Inputs from:** Execution Layer (action results), Qwen AI Engine (via `query_memory`/`store_memory` tools)
- **Outputs to:** Qwen AI Engine (recalled context for future decisions), Dashboard (Memory Explorer, Learning Curve)
- **External:** PostgreSQL, Redis, pgvector extension

## Schema

See `docs/database/schema.md` for full table definitions, indexes, and triggers.
