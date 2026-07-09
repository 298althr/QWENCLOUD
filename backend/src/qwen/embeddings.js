// backend/src/qwen/embeddings.js
// text-embedding-v4 integration for PML memory vectorization.
// Used by M6 (Learning) and M7 (Strategic) for semantic search via pgvector.

const { qwen, MODELS } = require("./client");
const tokenTracker = require("./tokenTracker");
const { checkRateLimit, checkCircuitBreaker, recordRateLimitCall, recordSuccess, recordFailure, CONFIG } = require("./guardrails");

/**
 * Generate an embedding for a single text.
 * @param {string} text
 * @param {number} [dimensions=1024]
 * @returns {Promise<number[]>}  embedding vector
 */
async function embed(text, dimensions = 1024) {
  const rl = checkRateLimit("embeddings");
  if (!rl.allowed) throw new Error(`[guardrails] ${rl.reason}`);
  const cb = checkCircuitBreaker();
  if (!cb.allowed) throw new Error(`[guardrails] ${cb.reason}`);
  recordRateLimitCall("embeddings");
  try {
    const res = await qwen.embeddings.create({
      model: MODELS.EMBEDDING,
      input: text,
      dimensions,
      timeout: CONFIG.requestTimeoutMs,
    });
    if (res.usage) {
      tokenTracker.record({
        model: MODELS.EMBEDDING,
        module: "embeddings",
        inputTokens: res.usage.prompt_tokens || tokenTracker.estimateTokens(text),
        outputTokens: 0,
      });
    }
    recordSuccess();
    return res.data[0].embedding;
  } catch (e) {
    recordFailure();
    throw e;
  }
}

/**
 * Generate embeddings for a batch of texts (max 10 per API call).
 * @param {string[]} texts
 * @param {number} [dimensions=1024]
 * @returns {Promise<number[][]>}  array of embedding vectors
 */
async function embedBatch(texts, dimensions = 1024) {
  if (!texts.length) return [];
  const all = [];
  const BATCH = 10;
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    const rl = checkRateLimit("embeddings");
    if (!rl.allowed) throw new Error(`[guardrails] ${rl.reason}`);
    recordRateLimitCall("embeddings");
    const res = await qwen.embeddings.create({
      model: MODELS.EMBEDDING,
      input: slice,
      dimensions,
      timeout: CONFIG.requestTimeoutMs,
    });
    if (res.usage) {
      tokenTracker.record({
        model: MODELS.EMBEDDING,
        module: "embeddings-batch",
        inputTokens: res.usage.prompt_tokens || tokenTracker.estimateTokens(slice.join(" ")),
        outputTokens: 0,
      });
    }
    // Sort by index to preserve order
    const sorted = res.data.slice().sort((a, b) => a.index - b.index);
    for (const d of sorted) all.push(d.embedding);
  }
  return all;
}

module.exports = { embed, embedBatch };
