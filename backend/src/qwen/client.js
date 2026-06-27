// backend/src/qwen/client.js
// Qwen Cloud API wrapper using the OpenAI SDK in compatible mode.
// All LLM calls in ALTHR Autopilot go through this client (no other LLMs).
//
// Base URLs:
//   Chat Completions / Embeddings: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
//   Responses / Conversations:     https://dashscope-intl.aliyuncs.com/api/v2/apps/protocols/compatible-mode/v1

const OpenAI = require("openai");

const CHAT_BASE_URL =
  process.env.QWEN_BASE_URL ||
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
// Responses API uses the SAME base URL as Chat Completions (the legacy
// /api/v2/apps/protocols/ path is being deprecated — see GAP-ANALYSIS.md).
const RESPONSES_BASE_URL =
  process.env.QWEN_RESPONSES_BASE_URL || CHAT_BASE_URL;

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) {
  // eslint-disable-next-line no-console
  console.warn("[qwen] DASHSCOPE_API_KEY not set — LLM calls will fail.");
}

// Primary client (Chat Completions + Embeddings + Responses)
// All three endpoints live under the same /compatible-mode/v1 base URL.
const qwen = new OpenAI({ apiKey, baseURL: CHAT_BASE_URL });

// Responses API client (same base URL; kept as a separate alias for clarity).
// Used for multi-turn conversation via previous_response_id (the Qwen
// "Conversations API" is the Responses API with previous_response_id, NOT
// a separate conversations.create() resource — see GAP-ANALYSIS.md GAP-1).
const qwenResponses = qwen;

// Canonical model names used across the project
const MODELS = {
  PLUS: "qwen3.7-plus", // default: intent parsing, chat, confidence scoring
  MAX: "qwen3.7-max", // complex: diagnosis, multi-step planning (thinking mode)
  FLASH: "qwen3.6-flash", // fast: quick status checks
  EMBEDDING: "text-embedding-v4", // memory vectorization (1024 dims)
};

/**
 * Smoke-test the Qwen connection with a trivial prompt.
 * Returns the model's reply text.
 */
async function testConnection() {
  const res = await qwen.chat.completions.create({
    model: MODELS.PLUS,
    messages: [
      { role: "system", content: "You are a connection test. Reply with the number only." },
      { role: "user", content: "What is 2+2?" },
    ],
  });
  return res.choices[0].message.content;
}

module.exports = {
  qwen,
  qwenResponses,
  MODELS,
  CHAT_BASE_URL,
  RESPONSES_BASE_URL,
  testConnection,
};
