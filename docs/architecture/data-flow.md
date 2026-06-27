# Data Flow — How a Message Travels Through the System

## Flow 1: Natural Language Command (Happy Path)

```
User sends "restart nginx" via Telegram
    │
    ▼
┌─ Telegram Bot (bot.js) ──────────────────────────────┐
│  Receives message, forwards to API Gateway           │
│  POST /api/agent { message: "restart nginx" }        │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ API Gateway (routes/agent.js) ──────────────────────┐
│  Receives request, calls Qwen AI Engine              │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ Qwen AI Engine ─────────────────────────────────────┐
│                                                      │
│  Step 1: Intent Parser (qwen3.7-plus)                │
│  → Returns: { intent: "restart_service",             │
│               params: { service: "nginx" } }          │
│                                                      │
│  Step 2: Action Planner (qwen3.7-max + thinking)     │
│  → Returns: [                                        │
│      { tool: "execute_command",                      │
│        args: { command: "systemctl restart nginx" } },│
│      { tool: "get_server_health",                    │
│        args: {} }                                     │
│    ]                                                  │
│                                                      │
│  Step 3: Confidence Scorer (qwen3.7-plus + JSON)     │
│  → Returns: { confidence: 0.82,                      │
│               risk_level: "medium",                   │
│               reasoning: "..." }                      │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ Certainty Pipeline (pipeline/certainty.js) ─────────┐
│                                                      │
│  Stage 1: Problem Definition ✓                       │
│  Stage 2: Context Identification ✓                   │
│  Stage 3: Constraint Mapping ✓                       │
│  Stage 4: Intent Clarification ✓                     │
│  Stage 5: Expert Validation ✓                        │
│  Stage 6: Confidence = 0.82 (medium)                 │
│  Stage 7: Authorization = "human_approval_required"  │
│           (risk_level = "medium" → needs approval)   │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ Telegram Bot ───────────────────────────────────────┐
│  Sends inline keyboard:                               │
│  "Plan: systemctl restart nginx + health check"      │
│  "Confidence: 82% | Risk: Medium"                     │
│  [✅ Approve]  [❌ Reject]  [📝 Modify]               │
└──────────────────────┬───────────────────────────────┘
                       │
                  User taps [✅ Approve]
                       │
                       ▼
┌─ SAF Framework (pipeline/saf.js) ────────────────────┐
│                                                      │
│  L1: Asset Classification → "nginx" = critical       │
│      → Pass (risk is medium, not high)               │
│  L2: Identity & Authority → user role = admin        │
│      → Pass                                          │
│  L3: Network Segmentation → local execution          │
│      → Pass                                          │
│  L4: Policy Enforcement → "systemctl restart"        │
│      → in whitelist → Pass                           │
│  L5: Immutable Logging → audit_log entry created     │
│      → Pass                                          │
│  L6: Containment → blast radius = single service     │
│      → Pass                                          │
│  L7: Governance → human approved                     │
│      → Pass                                          │
│                                                      │
│  Result: ALL 7 LAYERS PASSED → Execute               │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ Execution Layer (utils/executor.js) ────────────────┐
│  Executes: systemctl restart nginx                   │
│  Timeout: 30s                                        │
│  Result: success (exit code 0)                       │
│  Time cost: 1,240ms                                  │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ PML Memory Layer (memory/pml.js) ───────────────────┐
│                                                      │
│  M1: Raw Event → { event: "nginx_restart", ... }     │
│  M4: Execution → { action_id: "act_042",             │
│                     result: "success", ... }          │
│  M5: Decision → { confidence: 0.82,                  │
│                    chosen: "restart", ... }           │
│  M6: Learning → { pattern: "nginx_restart_fixes",    │
│                    reinforcement_count: +1 }          │
│                                                      │
│  Audit log entry created (immutable)                 │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ Telegram Bot ───────────────────────────────────────┐
│  Sends result:                                       │
│  "✅ Done. nginx restarted in 1.2s.                  │
│   Health check: CPU 12%, RAM 34%.                    │
│   Logged as action #042. DQ Score: 87/100."          │
└──────────────────────────────────────────────────────┘
```

## Flow 2: Anomaly Detection (Auto-Triggered)

```
Monitoring loop polls every 30s
    │
    ├── CPU > 85% for 5 min? ──→ ANOMALY
    ├── RAM > 90%? ────────────→ ANOMALY
    ├── Disk > 85%? ───────────→ ANOMALY
    ├── Process crash? ────────→ ANOMALY
    └── Port conflict? ────────→ ANOMALY
    │
    ▼ (anomaly detected)
┌─ PML M1 ─────────────────────────────────────────────┐
│  Store raw event: { type: "cpu_spike",               │
│                      value: 94, duration: "5m" }     │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ Qwen AI Engine (qwen3.7-max + thinking + stream) ───┐
│  Diagnosis with enable_thinking: true                │
│  thinking_budget: 2000                               │
│  stream: true                                        │
│                                                      │
│  reasoning_content streamed to dashboard via WS      │
│  → "Analyzing CPU spike..."                          │
│  → "Top process: node-worker (PID 1234) at 87%..."   │
│  → "Previous similar event: act_031 (3 days ago)..." │
│  → "Recommended action: kill PID 1234, restart"      │
│                                                      │
│  content: { action: "kill_and_restart",              │
│             pid: 1234, confidence: 0.78 }            │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ Certainty Pipeline ─────────────────────────────────┐
│  Confidence: 0.78 (medium)                           │
│  Authorization: human_approval_required              │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌─ Notification ───────────────────────────────────────┐
│  Telegram: "⚠️ CPU at 94%. Root cause: node-worker.  │
│   Proposed fix: kill + restart. Approve?"            │
│  Dashboard: Alert in real-time via WebSocket         │
└──────────────────────────────────────────────────────┘
```

## Flow 3: Cross-Device Session Continuity

```
User on Telegram: "check disk space"
    │
    ▼
Qwen Conversations API (conversation_id: conv_abc123)
    │
    ▼
Response: "Disk usage: 67%. Largest: /var/log (12GB)."

    ...later, user opens web dashboard...

User on Dashboard: "clean up the logs"
    │
    ▼
Same conversation_id: conv_abc123
    │
    ▼
Qwen remembers context: "You asked about disk space earlier.
    /var/log has 12GB. I'll clean logs older than 7 days."
    │
    ▼
Proceeds through Certainty Pipeline → SAF → Execute
```

## Data Storage Flow

```
                    ┌───────────┐
                    │  Redis    │
                    │  (hot)    │
                    │           │
                    │ M1 events │
                    │ Sessions  │
                    │ Cache     │
                    └─────┬─────┘
                          │
                    ┌─────┴─────┐
                    │ PostgreSQL│
                    │ (warm)    │
                    │           │
                    │ M2-M5     │
                    │ Audit log │
                    │ Users     │
                    │ Sessions  │
                    │ Qwen conv │
                    └─────┬─────┘
                          │
                    ┌─────┴─────┐
                    │ pgvector  │
                    │ /OpenSearch│
                    │ (cold)    │
                    │           │
                    │ M6 vector │
                    │ M7 vector │
                    │ Semantic  │
                    │ search    │
                    └───────────┘
```
