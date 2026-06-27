# Service: Monitoring Service

## Purpose

Continuous monitoring of server health metrics. Detects anomalies (CPU spikes, RAM pressure, disk pressure, process crashes, port conflicts) and triggers the Qwen AI Engine for diagnosis + remediation.

## Key Files

| File | Responsibility |
|---|---|
| `backend/src/monitors/cpu.js` | CPU anomaly detector |
| `backend/src/monitors/memory.js` | RAM anomaly detector |
| `backend/src/monitors/disk.js` | Disk anomaly detector |
| `backend/src/monitors/process.js` | Process crash detector |
| `backend/src/monitors/ports.js` | Port conflict detector |

## Monitoring Loop

```
Every 30 seconds:
    ├── Poll CPU usage     → anomaly if > 85% for 5 min
    ├── Poll RAM usage     → anomaly if > 90%
    ├── Poll Disk usage    → anomaly if > 85%
    ├── Check processes    → anomaly on exit code != 0
    └── Check ports        → anomaly on duplicate binding
```

## Anomaly Handling Flow

```
Anomaly detected
    │
    ▼
1. Store in M1 (Raw Event Memory) via Redis stream
    │
    ▼
2. Trigger Qwen diagnosis:
   - Model: qwen3.7-max
   - enable_thinking: true
   - thinking_budget: 2000
   - stream: true
   - reasoning_content streamed to dashboard via WebSocket
    │
    ▼
3. Generate remediation plan:
   - response_format: { type: "json_object" }
   - Returns: { action, confidence, risk_level }
    │
    ▼
4. Route through Certainty Pipeline
    │
    ▼
5. Notify user:
   - Telegram: alert message + approval buttons
   - Dashboard: real-time alert via WebSocket
```

## Thresholds (Configurable)

| Metric | Default Threshold | Configurable Via |
|---|---|---|
| CPU | > 85% for 5 min | Settings page |
| RAM | > 90% | Settings page |
| Disk | > 85% | Settings page |
| Process crash | exit code != 0 | Always on |
| Port conflict | duplicate binding | Always on |

## WebSocket Events

| Event | Payload | Recipient |
|---|---|---|
| `anomaly_detected` | `{ type, severity, data }` | All connected dashboards |
| `diagnosis_stream` | `{ reasoning_chunk }` | All connected dashboards |
| `diagnosis_complete` | `{ action, confidence, risk_level }` | All connected dashboards |
| `alert_resolved` | `{ anomaly_id, resolution }` | All connected dashboards |

## Dependencies

- **Inputs from:** Server OS (via `execute_command` tool), Settings (thresholds)
- **Outputs to:** Qwen AI Engine (diagnosis trigger), PML M1 (raw events), WebSocket (dashboard alerts), Telegram Bot (notifications)
- **External:** Linux system commands (`top`, `free`, `df`, `ps`, `ss`)
