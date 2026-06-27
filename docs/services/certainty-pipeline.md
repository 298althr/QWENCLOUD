# Service: Certainty-Driven Decision Pipeline

## Purpose

A 7-stage gate that every proposed action must pass through before execution. Ensures the agent reasons about the problem, evaluates confidence, and obtains proper authorization before acting.

## Key File

| File | Responsibility |
|---|---|
| `backend/src/pipeline/certainty.js` | 7-stage pipeline implementation |

## The 7 Stages

| Stage | Name | What Happens | Qwen Feature |
|---|---|---|---|
| 1 | Problem Definition | What is being asked? | Thinking mode (`enable_thinking: true`) |
| 2 | Context Identification | What server state is relevant? | Thinking mode |
| 3 | Constraint Mapping | What limits apply (SAF, timeouts, permissions)? | Thinking mode |
| 4 | Intent Clarification | What does the user actually want? | Thinking mode |
| 5 | Expert Validation | Does the proposed action make sense? | Thinking mode |
| 6 | Confidence Scoring | Score 0-1 + risk level | Structured output (`response_format: json_object`) |
| 7 | Execution Authorization | Auto-execute / approve / block | Code logic (no Qwen) |

## Authorization Logic

```
IF confidence >= 0.85 AND risk_level == "low":
    → auto-execute (no human approval needed)

ELSE IF confidence >= 0.50:
    → human_approval_required (Telegram + dashboard buttons)

ELSE:
    → blocked_escalate (action blocked, logged, user notified)
```

## Code Stub

See `docs/TRACK4-BUILD-PLAN.md` Section 5C for the full implementation stub.

Key parameters:
- Model: `qwen3.7-max` (stages 1-5), `qwen3.7-plus` (stage 6)
- `enable_thinking: true`, `thinking_budget: 1500`, `preserve_thinking: true`
- `response_format: { type: "json_object" }` for confidence scoring

## Dependencies

- **Inputs from:** Qwen AI Engine (action plans)
- **Outputs to:** SAF Framework (authorized actions), Telegram Bot (approval requests)
- **Uses:** Qwen thinking mode + structured output

## Data Stored

Each pipeline run stores:
- `reasoning` (thinking mode output) → `m5_decision.reasoning`
- `confidence` → `m5_decision.confidence`
- `certainty_stages` (JSONB) → `m5_decision.certainty_stages`
- `risk_level` → `m5_decision.risk_level`
