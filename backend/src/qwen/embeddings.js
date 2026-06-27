// backend/src/qwen/embeddings.js
// text-embedding-v4 integration for PML memory vectorization.
// Used by M6 (Learning) and M7 (Strategic) for semantic search via pgvector.

const { qwen, MODELS } = require("./client");

/**
 * Generate an embedding for a single text.
 * @param {string} text
 * @param {number} [dimensions=1024]
 * @returns {Promise<number[]>}  embedding vector
 */
async function embed(text, dimensions = 1024) {
  const res = await qwen.embeddings.create({
    model: MODELS.EMBEDDING,
    input: text,
    dimensions,
  });
  return res.data[0].embedding;
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
    const res = await qwen.embeddings.create({
      model: MODELS.EMBEDDING,
      input: slice,
      dimensions,
    });
    // Sort by index to preserve order
    const sorted = res.data.slice().sort((a, b) => a.index - b.index);
    for (const d of sorted) all.push(d.embedding);
  }
  return all;
}

module.exports = { embed, embedBatch };
