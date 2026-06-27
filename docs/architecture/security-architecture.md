# Security Architecture — SAF (Security-by-Architecture Framework)

## Overview

Every action the agent proposes must pass through 7 security layers before execution. Any layer failure blocks the action and logs it to the immutable audit trail.

## The 7 Layers

```
Action Proposed
      │
      ▼
┌─────────────────────────────────────────┐
│ L1: Asset Classification                │
│ Classify the target asset criticality   │
│ → critical | important | non-critical   │
│                                          │
│ Pass: risk_level allows action on asset │
│ Fail: asset too critical for this risk  │
└──────────────────┬──────────────────────┘
                   │ Pass
                   ▼
┌─────────────────────────────────────────┐
│ L2: Identity & Authority                │
│ Verify user identity and authority      │
│ → Check JWT token + user role           │
│                                          │
│ Pass: user has required role (admin)    │
│ Fail: user lacks authority              │
└──────────────────┬──────────────────────┘
                   │ Pass
                   ▼
┌─────────────────────────────────────────┐
│ L3: Network Segmentation                │
│ Check network isolation and access      │
│ → Verify execution is local to server   │
│                                          │
│ Pass: action executes locally           │
│ Fail: action targets external system    │
└──────────────────┬──────────────────────┘
                   │ Pass
                   ▼
┌─────────────────────────────────────────┐
│ L4: Policy Enforcement                  │
│ Validate against allowed-actions policy │
│ → Check command against whitelist       │
│                                          │
│ Pass: command is in whitelist           │
│ Fail: command NOT in whitelist          │
└──────────────────┬──────────────────────┘
                   │ Pass
                   ▼
┌─────────────────────────────────────────┐
│ L5: Immutable Logging                   │
│ Ensure action will be logged immutably  │
│ → audit_log table with UPDATE/DELETE    │
│   prevention triggers                   │
│                                          │
│ Pass: audit log entry will be created   │
│ Fail: logging unavailable               │
└──────────────────┬──────────────────────┘
                   │ Pass
                   ▼
┌─────────────────────────────────────────┐
│ L6: Containment                         │
│ Verify blast radius is contained        │
│ → Check risk_level vs asset_class       │
│                                          │
│ Pass: blast radius acceptable            │
│ Fail: blast radius too large            │
└──────────────────┬──────────────────────┘
                   │ Pass
                   ▼
┌─────────────────────────────────────────┐
│ L7: Governance                          │
│ Check governance compliance + approval  │
│ → Auto-approve (low risk, high conf)    │
│ → Human approval (medium risk)          │
│ → Block + escalate (high risk)          │
│                                          │
│ Pass: approval obtained or not needed   │
│ Fail: approval required but not given   │
└──────────────────┬──────────────────────┘
                   │ Pass
                   ▼
            EXECUTE ACTION
```

## Asset Classification Rules

| Asset | Classification | Examples |
|---|---|---|
| **Critical** | Highest priority — service disruption = downtime | `nginx`, `postgres`, `redis`, `docker`, `sshd` |
| **Important** | Medium priority — degraded performance possible | `node`, `pm2`, `nginx-worker` |
| **Non-critical** | Low priority — safe to restart/modify | log files, temp files, non-essential processes |

## Command Whitelist

```
Allowed commands:
  ls, ps, top, htop, cat, grep, tail, head, wc
  docker ps, docker logs, docker stats, docker inspect
  git clone, git pull, git status
  rkhunter, lynis, systemctl status
  kill, restart, free, df, du, netstat, ss
```

Any command NOT in this list is blocked at L4.

## Authorization Matrix

| Risk Level | Confidence | Authorization | Behavior |
|---|---|---|---|
| Low | ≥ 0.85 | Auto-execute | No human approval needed |
| Low | 0.50-0.84 | Human approval | Telegram + dashboard approval buttons |
| Medium | ≥ 0.85 | Human approval | Telegram + dashboard approval buttons |
| Medium | 0.50-0.84 | Human approval | Telegram + dashboard approval buttons |
| High | Any | Block + escalate | Action blocked, logged, user notified |
| Any | < 0.50 | Block + escalate | Action blocked, logged, user notified |

## Audit Log Immutability

The `audit_log` table has PostgreSQL triggers that prevent UPDATE and DELETE operations:

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

Every SAF check result (pass/fail per layer) is stored in the `audit_log.saf_result` JSONB column.

## Key File

- **Implementation:** `backend/src/pipeline/saf.js`
- **Code stub:** See `docs/TRACK4-BUILD-PLAN.md` Section 5C
- **Schema:** See `docs/database/schema.md` — `audit_log` table
