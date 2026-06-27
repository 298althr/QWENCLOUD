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

| API | Base URL | Usage |
|---|---|---|
| Chat Completions | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | Intent parsing, function calling, thinking mode, structured output |
| Responses | `https://dashscope-intl.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1` | Conversations API, MCP tools |
| Embeddings | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | `text-embedding-v4` for memory vectorization |
| Conversations | `https://dashscope-intl.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1` | Cross-device session management |

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
- Conversations API message items expire after 7 days — pass system instructions via `instructions` parameter
- Context window: hard cap 4096 tokens for memory recall + 4096 for conversation + 1024 for system prompt
