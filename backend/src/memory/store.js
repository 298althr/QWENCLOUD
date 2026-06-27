// backend/src/memory/store.js
// PML memory store/query with:
//  - text-embedding-v4 vectorization for M6 (Learning) and M7 (Strategic)
//  - pgvector cosine similarity semantic search
//  - Redis hot cache for M1 (recent events stream) and session state

const { query } = require("../db/pool");
const { embed } = require("../qwen/embeddings");
const { client: redisClient } = require("../db/redis");

const TABLE_BY_LAYER = {
  M1: "m1_raw_events",
  M2: "m2_structured_data",
  M3: "m3_operational",
  M4: "m4_execution",
  M5: "m5_decision",
  M6: "m6_learning",
  M7: "m7_strategic",
};

// Layers that have an `embedding` column (vector(1024)) for semantic search.
const EMBEDDED_LAYERS = new Set(["M6", "M7"]);

// Redis key patterns (DB 0: events, DB 1: sessions, DB 2: cache)
const M1_STREAM_KEY = "m1:events";
const M1_STREAM_MAXLEN = 10000; // cap the stream length

/**
 * Store a memory in a PML layer.
 * For M6/M7, generates a text-embedding-v4 vector and stores it.
 * For M1, also pushes to the Redis hot cache stream.
 *
 * @param {"M1"|"M2"|"M3"|"M4"|"M5"|"M6"|"M7"} layer
 * @param {string} content  The memory content / note
 * @param {object} metadata  Layer-specific structured fields
 */
async function store(layer, content, metadata = {}) {
  const table = TABLE_BY_LAYER[layer];
  if (!table) throw new Error(`unknown PML layer: ${layer}`);

  let row;

  switch (layer) {
    case "M1": {
      row = (await query(
        `INSERT INTO m1_raw_events (event_type, raw_data, severity) VALUES ($1, $2, $3) RETURNING id, timestamp`,
        [metadata.event_type || "agent_note", { content, ...metadata }, metadata.severity || "info"]
      )).rows[0];
      // Push to Redis hot cache (best-effort)
      pushM1ToRedis({ id: row.id, timestamp: row.timestamp, event_type: metadata.event_type || "agent_note", content, severity: metadata.severity || "info" });
      return row;
    }
    case "M2":
      return (await query(
        `INSERT INTO m2_structured_data (source, structured_json, server_id) VALUES ($1, $2, $3) RETURNING id`,
        [metadata.source || "agent", { content, ...metadata }, metadata.server_id || "default"]
      )).rows[0];
    case "M3":
      return (await query(
        `INSERT INTO m3_operational (sop_name, trigger, steps_json, auto_generated) VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          metadata.sop_name || content.slice(0, 80),
          metadata.trigger || "manual",
          metadata.steps_json || [{ step: content }],
          !!metadata.auto_generated,
        ]
      )).rows[0];
    case "M4":
      return (await query(
        `INSERT INTO m4_execution (action_id, action_type, action_detail, result, saf_passed, human_approved) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          metadata.action_id || `act_${Date.now()}`,
          metadata.action_type || "command",
          content,
          metadata.result || "success",
          metadata.saf_passed ?? true,
          !!metadata.human_approved,
        ]
      )).rows[0];
    case "M5":
      return (await query(
        `INSERT INTO m5_decision (action_id, context, alternatives_json, confidence, dq_score, chosen_action, reasoning, risk_level) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          metadata.action_id,
          metadata.context || content,
          metadata.alternatives_json || [],
          metadata.confidence ?? 0,
          metadata.dq_score ?? null,
          metadata.chosen_action || content,
          metadata.reasoning || null,
          metadata.risk_level || "low",
        ]
      )).rows[0];
    case "M6": {
      // Generate embedding for semantic search
      let embedding = metadata.embedding;
      if (!embedding && content) {
        try { embedding = await embed(content); } catch (e) { console.warn("[memory] embed failed for M6:", e.message); }
      }
      const vecLiteral = embedding ? `[${embedding.join(",")}]` : null;
      return (await query(
        `INSERT INTO m6_learning (action_id, error_type, drift, improvement_note, pattern_hash, reinforcement_count, embedding)
         VALUES ($1, $2, $3, $4, $5, $6, $7::vector) RETURNING id`,
        [
          metadata.action_id || null,
          metadata.error_type || null,
          metadata.drift ?? null,
          content,
          metadata.pattern_hash || null,
          metadata.reinforcement_count || 0,
          vecLiteral,
        ]
      )).rows[0];
    }
    case "M7": {
      let embedding = metadata.embedding;
      if (!embedding && content) {
        try { embedding = await embed(content); } catch (e) { console.warn("[memory] embed failed for M7:", e.message); }
      }
      const vecLiteral = embedding ? `[${embedding.join(",")}]` : null;
      return (await query(
        `INSERT INTO m7_strategic (event_type, description, impact, impact_score, embedding)
         VALUES ($1, $2, $3, $4, $5::vector) RETURNING id`,
        [
          metadata.event_type || "policy_update",
          content,
          metadata.impact || "neutral",
          metadata.impact_score ?? 0,
          vecLiteral,
        ]
      )).rows[0];
    }
    default:
      throw new Error(`unhandled PML layer: ${layer}`);
  }
}

/**
 * Retrieve recent rows from a PML layer.
 * Excludes the raw embedding vector from the response (too large for API payloads).
 */
async function retrieve(layer, { limit = 10, offset = 0 } = {}) {
  const table = TABLE_BY_LAYER[layer];
  if (!table) throw new Error(`unknown PML layer: ${layer}`);
  // For embedded layers, select all columns except the embedding vector
  const cols = EMBEDDED_LAYERS.has(layer)
    ? `id, timestamp, ${layer === "M6" ? "action_id, error_type, drift, improvement_note, pattern_hash, reinforcement_count" : "event_type, description, impact, impact_score"}`
    : `*`;
  const res = await query(
    `SELECT ${cols} FROM ${table} ORDER BY timestamp DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return res.rows;
}

/**
 * Semantic search across M6 and/or M7 using text-embedding-v4 + pgvector
 * cosine similarity (<=> operator).
 *
 * @param {string} queryString  Natural-language query
 * @param {string[]} [layers=["M6","M7"]]  which layers to search
 * @param {number} [limit=10]
 * @returns {Promise<{results: Array}>}
 */
async function semanticSearch(queryString, layers = ["M6", "M7"], limit = 10) {
  const qEmbedding = await embed(queryString);
  const vecLiteral = `[${qEmbedding.join(",")}]`;
  const results = [];

  for (const layer of layers) {
    if (!EMBEDDED_LAYERS.has(layer)) continue;
    const table = TABLE_BY_LAYER[layer];
    let res;
    if (layer === "M6") {
      res = await query(
        `SELECT id, timestamp, improvement_note AS content, error_type, pattern_hash,
                1 - (embedding <=> $1::vector) AS similarity
         FROM m6_learning
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [vecLiteral, limit]
      );
    } else {
      res = await query(
        `SELECT id, timestamp, description AS content, event_type, impact, impact_score,
                1 - (embedding <=> $1::vector) AS similarity
         FROM m7_strategic
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [vecLiteral, limit]
      );
    }
    for (const r of res.rows) {
      results.push({ ...r, layer, similarity: Number(r.similarity) });
    }
  }

  // Sort combined results by similarity descending
  results.sort((a, b) => b.similarity - a.similarity);
  return { results: results.slice(0, limit), count: results.length };
}

/**
 * Tool-facing query used by toolExecutor.query_memory.
 * - For M6/M7 with a query string: semantic search via embeddings.
 * - For M1: pull from Redis hot cache first, fall back to PG.
 * - Otherwise: recent-rows retrieval with optional keyword filter.
 */
async function queryLayer(layer, { query: q, limit = 10 } = {}) {
  // Semantic search for embedded layers
  if (q && EMBEDDED_LAYERS.has(layer)) {
    const { results } = await semanticSearch(q, [layer], limit);
    return { layer, count: results.length, rows: results };
  }

  // M1 hot path: try Redis stream first
  if (layer === "M1") {
    const cached = await readM1FromRedis(limit).catch(() => []);
    if (cached.length) {
      const filtered = q ? cached.filter((r) => JSON.stringify(r).toLowerCase().includes(String(q).toLowerCase())) : cached;
      return { layer, count: filtered.length, rows: filtered, source: "redis" };
    }
  }

  // Fallback: PG recent rows
  const rows = await retrieve(layer, { limit });
  if (!q) return { layer, count: rows.length, rows };
  const needle = String(q).toLowerCase();
  const filtered = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(needle));
  return { layer, count: filtered.length, rows: filtered };
}

// ---- Redis hot cache for M1 (recent events stream) ----

async function pushM1ToRedis(event) {
  if (!redisClient.isOpen) return;
  try {
    await redisClient.xAdd(M1_STREAM_KEY, "*", {
      id: String(event.id),
      event_type: event.event_type,
      content: String(event.content).slice(0, 2000),
      severity: event.severity,
      timestamp: String(event.timestamp),
    }, { MAXLEN: M1_STREAM_MAXLEN });
  } catch (e) {
    // best-effort; don't fail the store
  }
}

async function readM1FromRedis(count = 50) {
  if (!redisClient.isOpen) return [];
  const entries = await redisClient.xRevRange(M1_STREAM_KEY, "+", "-", { COUNT: count });
  return entries.map((e) => ({
    redis_id: e.id,
    id: Number(e.message.id),
    event_type: e.message.event_type,
    content: e.message.content,
    severity: e.message.severity,
    timestamp: e.message.timestamp,
  }));
}

module.exports = {
  store,
  retrieve,
  query: queryLayer,
  semanticSearch,
  pushM1ToRedis,
  readM1FromRedis,
  TABLE_BY_LAYER,
  EMBEDDED_LAYERS,
};
