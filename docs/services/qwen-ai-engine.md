# Service: Qwen AI Engine

## Purpose

The Qwen AI Engine is the reasoning core of ALTHR Autopilot. It converts natural language into structured intents, generates multi-step action plans, scores confidence, and provides streaming diagnosis — all through Qwen Cloud APIs.

## Key Files

| File | Responsibility |
|---|---|
| `backend/src/qwen/client.js` | Qwen API wrapper (OpenAI SDK with custom base_url) |
| `backend/src/qwen/intent-parser.js` | NL → structured JSON intent |
| `backend/src/qwen/action-planner.js` | Intent → multi-step action plan with tools |
| `backend/src/qwen/skills.js` | 12 function calling tool definitions |
| `backend/src/qwen/confidence.js` | DQS confidence scorer via structured output |

## Qwen Models Used

| Model | Use Case | Parameters |
|---|---|---|
| `qwen3.7-plus` | Default: intent parsing, chat, confidence scoring | Standard Chat Completions |
| `qwen3.7-max` | Complex: root cause diagnosis, multi-step planning | `enable_thinking: true`, `thinking_budget: 2000`, `preserve_thinking: true` |
| `qwen3.6-flash` | Fast: quick status checks, simple commands | Standard (cost-efficient) |
| `text-embedding-v4` | Memory vectorization | `dimensions: 1024` |

## Qwen API Endpoints

> **IMPORTANT:** All endpoints use the same base URL. The legacy
> `/api/v2/apps/protocols/compatible-mode/v1` path is being deprecated.
> See `docs/GAP-ANALYSIS.md` (GAP-1, GAP-2) for details.

| API | Endpoint | Base URL | Usage |
|---|---|---|---|
| Chat Completions | `POST /chat/completions` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | Intent parsing, function calling, thinking mode, structured output |
| Responses | `POST /responses` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | Multi-turn conversation via `previous_response_id`, built-in tools |
| Embeddings | `POST /embeddings` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | `text-embedding-v4` for memory vectorization |

### Multi-Turn Conversation (formerly "Conversations API")

The Qwen "Conversations API" is **not** a separate resource. Cross-device
session continuity is achieved via the **Responses API** with the
`previous_response_id` parameter:

```javascript
// Round 1
const r1 = await qwen.responses.create({ model: "qwen3.7-plus", input: "My name is Alice." });
// r1.id = "resp_xxx"

// Round 2 — Qwen remembers context via previous_response_id
const r2 = await qwen.responses.create({
  model: "qwen3.7-plus",
  input: "What is my name?",
  previous_response_id: r1.id,  // server manages context
});
// r2.output_text = "Your name is Alice."
```

- Response IDs expire after **7 days**
- System instructions should be passed via the `instructions` parameter
- The `qwen_conversations` table stores the `last_response_id` chain for
  cross-device continuity (Telegram ↔ dashboard)

## SDK Setup

```javascript
const OpenAI = require("openai");

const qwen = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,  // starts with sk-
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
});
```

## 12 Function Calling Tools

| Tool | Parameters | Description |
|---|---|---|
| `execute_command` | `command`, `timeout` | Runs shell command |
| `read_file` | `path` | Returns file contents |
| `write_file` | `path`, `content` | Writes file |
| `list_processes` | `sort_by`, `limit` | Returns process table |
| `check_ports` | (none) | Returns port table |
| `docker_build` | `dockerfile`, `tag`, `timeout` | Builds image |
| `git_clone` | `repo_url`, `dest` | Clones repo |
| `run_security_scan` | `tool` | Runs RKHunter or Lynis |
| `get_server_health` | (none) | Returns CPU/RAM/Disk |
| `saf_check` | `action`, `target`, `risk_level` | 7-layer SAF validation |
| `query_memory` | `layer`, `query` | Retrieves from PML |
| `store_memory` | `layer`, `content`, `metadata` | Stores to PML |

## Key Features

- **Parallel tool calling:** `parallel_tool_calls: true` — independent checks run simultaneously
- **Forced tool calling:** `tool_choice: { type: "function", function: { name: "saf_check" } }` with `enable_thinking: false`
- **Streaming:** `stream: true` — `reasoning_content` and `content` streamed separately via WebSocket
- **Structured output:** `response_format: { type: "json_object" }` — guaranteed valid JSON for DQS scores
- **Context cache:** Static system prompts at array start → implicit cache saves 80% on cached tokens
- **Conversations API:** `conversation` parameter → server-managed context across devices

## Dependencies

- **Inputs from:** API Gateway (`routes/agent.js`), Monitoring Service (anomaly triggers)
- **Outputs to:** Certainty Pipeline (action plans + confidence), PML Memory (store/retrieve via tools)
- **External:** Qwen Cloud API (`dashscope-intl.aliyuncs.com`)

## Known Constraints

- Thinking mode only supports `tool_choice: "auto"` or `"none"` — disable thinking to force a tool
- `text-embedding-v4` batch limit: 10 texts per API call, max 8,192 tokens per batch
- Responses API `previous_response_id` expires after 7 days — pass system instructions via `instructions` parameter
- Context window: hard cap 4096 tokens for memory recall + 4096 for conversation + 1024 for system prompt
- The legacy `/api/v2/apps/protocols/compatible-mode/v1` path is deprecated — use `/compatible-mode/v1` for all endpoints
