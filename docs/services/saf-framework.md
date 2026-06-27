# Service: SAF (Security-by-Architecture Framework)

## Purpose

A 7-layer security check that every action must pass before execution. Any layer failure blocks the action and creates an immutable audit log entry.

## Key File

| File | Responsibility |
|---|---|
| `backend/src/pipeline/saf.js` | 7-layer SAF check implementation |
| `backend/src/config/allowed-commands.js` | Command whitelist |

## The 7 Layers

| Layer | Name | Check | Pass Condition |
|---|---|---|---|
| L1 | Asset Classification | Classify target criticality | Risk level allows action on this asset class |
| L2 | Identity & Authority | Verify user role | User has `admin` role |
| L3 | Network Segmentation | Check execution scope | Action executes locally |
| L4 | Policy Enforcement | Check command whitelist | Command is in allowed list |
| L5 | Immutable Logging | Verify audit trail | Audit log entry will be created |
| L6 | Containment | Check blast radius | Risk level vs asset class acceptable |
| L7 | Governance | Check approval | Auto-approved or human-approved |

## Asset Classification

| Class | Assets | Rule |
|---|---|---|
| Critical | `nginx`, `postgres`, `redis`, `docker`, `sshd` | Only low-risk actions allowed |
| Important | `node`, `pm2`, `nginx-worker` | Low + medium risk allowed |
| Non-critical | Everything else | All risk levels allowed |

## Dependencies

- **Inputs from:** Certainty Pipeline (authorized actions)
- **Outputs to:** Execution Layer (passed actions), Audit Log (all results)
- **Uses:** Command whitelist, user role from auth system

## Full Implementation

See `docs/architecture/security-architecture.md` for the complete layer-by-layer flow and authorization matrix.
See `docs/TRACK4-BUILD-PLAN.md` Section 5C for the full code stub.
