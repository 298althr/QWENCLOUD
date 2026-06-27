# Service: API Gateway

## Purpose

Express.js server with WebSocket (Socket.io) that serves as the central API layer. Routes all requests from Telegram bot and web dashboard to the appropriate services (Qwen AI Engine, Execution Layer, PML Memory).

## Key Files

| File | Responsibility |
|---|---|
| `backend/src/server.js` | Express + WebSocket entry point |
| `backend/src/routes/agent.js` | `/api/agent` — NL → action pipeline |
| `backend/src/routes/command.js` | `/api/command` — direct command execution |
| `backend/src/routes/file.js` | `/api/file/*` — file operations |
| `backend/src/routes/docker.js` | `/api/docker/*` — Docker operations |
| `backend/src/routes/monitor.js` | `/api/processes`, `/api/ports` — monitoring |
| `backend/src/routes/deploy.js` | `/api/deployments` — deployment management |
| `backend/src/routes/security.js` | `/api/audit`, `/api/security/*` — security + audit |
| `backend/src/routes/memory.js` | `/api/memory/*` — PML memory CRUD + search |
| `backend/src/routes/health.js` | `/api/health` — health check endpoint |

## REST Endpoints

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | `/api/health` | Service health check | None |
| POST | `/api/agent` | Send NL message → agent processes | JWT |
| POST | `/api/command` | Execute direct command (bypasses NL) | JWT + Admin |
| GET | `/api/processes` | List running processes | JWT |
| GET | `/api/ports` | List listening ports | JWT |
| GET | `/api/health/server` | Server health (CPU, RAM, Disk) | JWT |
| GET | `/api/docker/containers` | List Docker containers | JWT |
| POST | `/api/docker/build` | Build Docker image | JWT + Admin |
| POST | `/api/deployments` | Create new deployment | JWT + Admin |
| GET | `/api/deployments` | List deployments | JWT |
| GET | `/api/file/list` | List directory contents | JWT |
| GET | `/api/file/read` | Read file contents | JWT |
| POST | `/api/file/write` | Write file | JWT + Admin |
| GET | `/api/audit` | Query audit log | JWT |
| POST | `/api/security/scan` | Run security scan | JWT + Admin |
| GET | `/api/memory/:layer` | Get memories from a PML layer | JWT |
| POST | `/api/memory/store` | Store a memory | JWT |
| GET | `/api/memory/search` | Semantic search across layers | JWT |
| GET | `/api/analytics/dq-trend` | DQ score trend over time | JWT |
| GET | `/api/learning/lessons` | Learned patterns from M6 | JWT |

## WebSocket Events

| Event | Direction | Payload | Description |
|---|---|---|---|
| `connection` | Client → Server | — | Client connects |
| `agent_message` | Client → Server | `{ message }` | NL message via WebSocket |
| `reasoning_stream` | Server → Client | `{ chunk }` | Qwen `reasoning_content` chunks |
| `response_stream` | Server → Client | `{ chunk }` | Qwen `content` chunks |
| `anomaly_alert` | Server → Client | `{ type, data }` | Anomaly detected |
| `action_update` | Server → Client | `{ action_id, status }` | Action status change |
| `approval_needed` | Server → Client | `{ action_id, plan }` | Approval required |

## Authentication

- JWT tokens for all authenticated endpoints
- TOTP for admin-level actions
- Token stored in `sessions` table with expiry

## Dependencies

- **Inputs from:** Telegram Bot, Web Dashboard (REST + WebSocket)
- **Outputs to:** Qwen AI Engine, Execution Layer, PML Memory, Monitoring Service
- **External:** Express.js, Socket.io, JWT

## Port

Default: `3000` (configurable via `PORT` env var)
