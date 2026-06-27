# Database Schema — PostgreSQL

## Overview

The database uses PostgreSQL (Alibaba Cloud RDS) with the `pgvector` extension for semantic search on memory layers M6 and M7.

## Schema File

The full SQL schema is in the build plan: `docs/TRACK4-BUILD-PLAN.md` Section 5B.
During implementation, it will be at: `backend/src/memory/schema.sql`

## Tables

### PML Memory Tables (7 Layers)

| Table | Layer | Purpose | Key Columns | Indexes |
|---|---|---|---|---|
| `m1_raw_events` | M1 | High-frequency logs, anomaly events | `event_type`, `severity`, `resolved` | timestamp DESC, event_type, unresolved |
| `m2_structured_data` | M2 | Server state snapshots, configs | `source`, `structured_json` | source, timestamp DESC |
| `m3_operational` | M3 | SOPs, runbooks, remediation playbooks | `sop_name`, `trigger`, `steps_json` | trigger |
| `m4_execution` | M4 | Every action: type, cost, result, approval | `action_id`, `action_type`, `result`, `saf_passed`, `human_approved` | timestamp DESC, action_type, result |
| `m5_decision` | M5 | Context, alternatives, confidence, reasoning | `action_id` (FK), `confidence`, `dq_score`, `risk_level` | confidence, dq_score |
| `m6_learning` | M6 | Errors, drift, improvements (with embeddings) | `pattern_type`, `embedding` (vector 1024) | pattern_type, embedding (ivfflat) |
| `m7_strategic` | M7 | Regime changes, major wins/losses (with embeddings) | `insight_type`, `embedding` (vector 1024) | insight_type, embedding (ivfflat) |

### Audit & Auth Tables

| Table | Purpose | Key Columns | Notes |
|---|---|---|---|
| `audit_log` | Immutable record of all operations | `operation`, `actor`, `memory_layer`, `result` | **Immutable** — UPDATE/DELETE triggers prevent modification |
| `users` | User accounts | `username`, `password_hash`, `totp_secret`, `is_active` | |
| `sessions` | JWT sessions | `token`, `user_id` (FK), `expires_at` | |
| `qwen_conversations` | Qwen Conversations API mapping | `conversation_id`, `user_id` (FK), `persona_id` (FK) | Cross-device session continuity |

## pgvector Configuration

```sql
CREATE EXTENSION IF NOT EXISTS vector;

-- M6: Learning Memory embeddings
CREATE TABLE m6_learning (
    ...
    embedding vector(1024)  -- text-embedding-v4
);
CREATE INDEX idx_m6_embedding ON m6_learning
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- M7: Strategic Memory embeddings
CREATE TABLE m7_strategic (
    ...
    embedding vector(1024)
);
CREATE INDEX idx_m7_embedding ON m7_strategic
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## Audit Log Immutability

```sql
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
```

## Redis Schema (Hot Memory)

| Redis DB | Key Pattern | Purpose | TTL |
|---|---|---|---|
| 0 | `m1:events:{timestamp}` | M1 raw event stream | 7 days |
| 1 | `m3:sop:{trigger_hash}` | M3 procedure cache | 24 hours |
| 2 | `session:{token}` | Session state | 1 hour |

## Relationships

```
users (1) ──→ (N) sessions
users (1) ──→ (N) qwen_conversations
m4_execution (1) ──→ (1) m5_decision  (via action_id FK)
qwen_conversations (N) ──→ (1) personas  (if personas table added)
```
