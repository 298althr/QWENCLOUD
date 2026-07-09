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

const apiKey = process.env.DASHSCOPE_API_KEY || "missing-key";
if (!process.env.DASHSCOPE_API_KEY) {
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
  TURBO: "qwen-turbo", // fast: intent parsing, simple commands
  EMBEDDING: "text-embedding-v4", // memory vectorization (1024 dims)
};

// Free tier models available on the DashScope OpenAI-compatible endpoint.
// Keep this list small and verified — many legacy model IDs (qwen1.5/qwen2)
// return 404 on the international endpoint.
const FREE_MODELS = [
  "qwen-turbo",   // fast, cheap, great for simple/moderate tasks
  "qwen-plus",    // default reasoning
  "qwen-max",     // complex reasoning
];

// Token usage tracking (in-memory, could be persisted to database)
// Paid models (qwen3.7-* series) are marked as exhausted because their free quota
// is depleted. The system will automatically rotate to free tier models below.
const tokenUsage = {
  "qwen3.7-plus": { used: 1000000, total: 1000000, remaining: 0 },
  "qwen3.7-max": { used: 1000000, total: 1000000, remaining: 0 },
};

// Initialize free models with full capacity
FREE_MODELS.forEach(model => {
  if (!tokenUsage[model]) {
    tokenUsage[model] = { used: 0, total: 1000000, remaining: 1000000 };
  }
});

/**
 * Multi-model routing with token-aware rotation.
 * Selects model based on task complexity AND available token capacity.
 * Prioritizes models with most remaining tokens within the complexity tier.
 */
function selectModel(taskType) {
  // Determine complexity tier
  let tier = [];
  switch (taskType) {
    case "simple":
    case "intent":
    case "status":
      tier = ["qwen-plus", "qwen-turbo"];
      break;
    case "moderate":
    case "dre":
    case "drev":
    case "confidence":
    case "ai-command-execution":
      tier = ["qwen-plus", "qwen-max", "qwen-turbo"];
      break;
    case "complex":
    case "diagnosis":
    case "planning":
      tier = ["qwen-max", "qwen-plus", "qwen-turbo"];
      break;
    case "embedding":
      return MODELS.EMBEDDING;
    default:
      tier = ["qwen-plus", "qwen-turbo"];
  }

  // Filter tier to available models with remaining tokens
  const available = tier.filter(model => {
    const usage = tokenUsage[model];
    return usage && usage.remaining > 10000; // Reserve 10k buffer
  });

  if (available.length === 0) {
    console.warn(`[qwen] No models with sufficient tokens in tier ${taskType}, falling back to qwen-turbo`);
    return "qwen-turbo";
  }

  // Select model with most remaining tokens
  const selected = available.reduce((best, current) => {
    return tokenUsage[current].remaining > tokenUsage[best].remaining ? current : best;
  });

  return selected;
}

/**
 * Mark a model's free quota as exhausted (e.g. after a 403 from the provider).
 * Guardrails will then skip it on the next rotation attempt.
 */
function markModelExhausted(model) {
  if (!tokenUsage[model]) {
    tokenUsage[model] = { used: 0, total: 1000000, remaining: 1000000 };
  }
  tokenUsage[model].used = tokenUsage[model].total;
  tokenUsage[model].remaining = 0;
  console.warn(`[qwen] Model ${model} marked as exhausted (free quota depleted)`);
}

/**
 * Update token usage after API call
 */
function updateTokenUsage(model, inputTokens, outputTokens) {
  if (!tokenUsage[model]) {
    tokenUsage[model] = { used: 0, total: 1000000, remaining: 1000000 };
  }
  
  const totalTokens = inputTokens + outputTokens;
  tokenUsage[model].used += totalTokens;
  tokenUsage[model].remaining = Math.max(0, tokenUsage[model].total - tokenUsage[model].used);
  
  console.log(`[qwen] Token usage: ${model} - Used: ${tokenUsage[model].used.toLocaleString()}, Remaining: ${tokenUsage[model].remaining.toLocaleString()}`);
  
  // Warn if running low
  if (tokenUsage[model].remaining < 50000) {
    console.warn(`[qwen] WARNING: ${model} running low on tokens (${tokenUsage[model].remaining.toLocaleString()} remaining)`);
  }
}

/**
 * Get token usage statistics
 */
function getTokenUsage() {
  return tokenUsage;
}

/**
 * Get best available model for a task
 */
function getBestModel(taskType) {
  return selectModel(taskType);
}

/**
 * Smoke-test the Qwen connection with a trivial prompt.
 * Returns the model's reply text.
 */
async function testConnection() {
  const { guardedCreate } = require("./guardrails");
  const res = await guardedCreate(qwen, {
    model: MODELS.PLUS,
    messages: [
      { role: "system", content: "You are a connection test. Reply with the number only." },
      { role: "user", content: "What is 2+2?" },
    ],
    max_tokens: 10,
  }, { module: "test-connection", taskType: "simple" });
  return res.choices[0].message.content;
}

module.exports = {
  qwen,
  qwenResponses,
  MODELS,
  selectModel,
  markModelExhausted,
  updateTokenUsage,
  getTokenUsage,
  getBestModel,
  FREE_MODELS,
  CHAT_BASE_URL,
  RESPONSES_BASE_URL,
  testConnection,
};
