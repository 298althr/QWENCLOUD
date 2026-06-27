# API Reference

## Base URL

```
Local:    http://localhost:3000
Cloud:    https://your-ecs-ip:3000
```

## Authentication

All endpoints except `/api/health` require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Admin-level actions additionally require TOTP verification.

---

## Health

### `GET /api/health`
Service health check. No auth required.

**Response:**
```json
{ "status": "ok", "timestamp": "2026-06-27T12:00:00Z" }
```

---

## Agent (NL Commands)

### `POST /api/agent`
Send a natural language message to the agent. Triggers the full pipeline: Qwen → Certainty → SAF → Execute.

**Request:**
```json
{ "message": "restart nginx and check port 3000" }
```

**Response (200):**
```json
{
  "action_id": "act_042",
  "intent": "restart_and_check",
  "plan": [
    { "tool": "execute_command", "args": { "command": "systemctl restart nginx" } },
    { "tool": "check_ports", "args": {} }
  ],
  "confidence": 0.82,
  "risk_level": "medium",
  "authorization": "human_approval_required",
  "reasoning": "..."
}
```

---

## Command

### `POST /api/command`
Execute a direct shell command (bypasses NL parsing, still goes through SAF).

**Request:**
```json
{ "command": "ls -la /var/log", "timeout": 10000 }
```

**Response (200):**
```json
{ "exit_code": 0, "stdout": "...", "stderr": "", "time_ms": 120 }
```

---

## Monitoring

### `GET /api/processes`
List running processes.

**Query params:** `sort_by=cpu|mem|pid` (default: `cpu`), `limit=50`

**Response:**
```json
{ "processes": [{ "pid": 1234, "name": "node", "cpu": 12.5, "mem": 45.2 }] }
```

### `GET /api/ports`
List listening ports.

**Response:**
```json
{ "ports": [{ "port": 3000, "pid": 1234, "protocol": "tcp", "state": "LISTEN" }] }
```

### `GET /api/health/server`
Server health summary.

**Response:**
```json
{ "cpu": 12.5, "ram": 34.2, "disk": 67.0, "uptime": "5d 3h 22m" }
```

---

## Docker

### `GET /api/docker/containers`
List Docker containers.

**Response:**
```json
{ "containers": [{ "id": "abc123", "name": "app", "status": "running", "ports": ["3000:3000"] }] }
```

### `POST /api/docker/build`
Build a Docker image. **Admin only.**

**Request:**
```json
{ "dockerfile": "FROM node:18...", "tag": "myapp:latest", "timeout": 120000 }
```

---

## Deployments

### `POST /api/deployments`
Create a new deployment from a GitHub repo. **Admin only.**

**Request:**
```json
{ "repo_url": "https://github.com/example/repo", "port": 8080 }
```

### `GET /api/deployments`
List all deployments.

---

## Files

### `GET /api/file/list?path=/var/log`
List directory contents.

### `GET /api/file/read?path=/etc/nginx/nginx.conf`
Read file contents.

### `POST /api/file/write`
Write file. **Admin only.**

**Request:**
```json
{ "path": "/etc/nginx/conf.d/app.conf", "content": "server { ... }" }
```

---

## Security & Audit

### `GET /api/audit?type=execute&limit=50`
Query the immutable audit log.

**Query params:** `type` (operation type), `limit`, `from` (timestamp), `to` (timestamp)

### `POST /api/security/scan`
Run a security scan. **Admin only.**

**Request:**
```json
{ "tool": "rkhunter" }
```

---

## Memory (PML)

### `GET /api/memory/:layer`
Get memories from a specific PML layer (M1-M7).

**Query params:** `limit=20`, `offset=0`

### `POST /api/memory/store`
Store a memory in a PML layer.

**Request:**
```json
{ "layer": "M6", "content": "CPU spike from node-worker fixed by kill", "metadata": { "type": "remediation" } }
```

### `GET /api/memory/search?query=CPU+problems&layers=M6,M7`
Semantic search across memory layers using `text-embedding-v4` embeddings.

**Response:**
```json
{ "results": [{ "layer": "M6", "content": "...", "similarity": 0.92, "id": 42 }] }
```

---

## Analytics

### `GET /api/analytics/dq-trend`
DQ score trend over time.

**Response:**
```json
{ "scores": [{ "date": "2026-07-01", "dq_score": 87.5 }] }
```

### `GET /api/learning/lessons`
Learned patterns from M6.

---

## WebSocket Events

Connect to `ws://localhost:3000` with Socket.io client.

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `agent_message` | `{ message: string }` | Send NL message via WebSocket |
| `approve_action` | `{ action_id: string }` | Approve a pending action |
| `reject_action` | `{ action_id: string, reason: string }` | Reject a pending action |
| `cancel_action` | `{ action_id: string }` | Cancel executing action |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `reasoning_stream` | `{ chunk: string }` | Qwen `reasoning_content` chunk (live thinking) |
| `response_stream` | `{ chunk: string }` | Qwen `content` chunk (live response) |
| `anomaly_alert` | `{ type: string, severity: string, data: object }` | Anomaly detected |
| `action_update` | `{ action_id: string, status: string, result?: object }` | Action status change |
| `approval_needed` | `{ action_id: string, plan: array, confidence: number }` | Approval required |
| `saf_result` | `{ action_id: string, layers: object, passed: boolean }` | SAF check result |
