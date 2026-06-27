// backend/src/memory/store.js
// PML memory store/query. Day 2 baseline: writes structured rows to the correct
// PML table. Semantic search + embeddings (text-embedding-v4) land in Day 4.

const { query } = require("../db/pool");

const TABLE_BY_LAYER = {
  M1: "m1_raw_events",
  M2: "m2_structured_data",
  M3: "m3_operational",
  M4: "m4_execution",
  M5: "m5_decision",
  M6: "m6_learning",
  M7: "m7_strategic",
};

/**
 * Store a memory in a PML layer.
 * @param {"M1"|"M2"|"M3"|"M4"|"M5"|"M6"|"M7"} layer
 * @param {string} content  The memory content / note
 * @param {object} metadata  Layer-specific structured fields
 */
async function store(layer, content, metadata = {}) {
  const table = TABLE_BY_LAYER[layer];
  if (!table) throw new Error(`unknown PML layer: ${layer}`);

  switch (layer) {
    case "M1":
      return (await query(
        `INSERT INTO m1_raw_events (event_type, raw_data, severity) VALUES ($1, $2, $3) RETURNING id`,
        [metadata.event_type || "agent_note", { content, ...metadata }, metadata.severity || "info"]
      )).rows[0];
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
    case "M6":
      // embedding populated in Day 4
      return (await query(
        `INSERT INTO m6_learning (action_id, error_type, drift, improvement_note, pattern_hash, reinforcement_count) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          metadata.action_id || null,
          metadata.error_type || null,
          metadata.drift ?? null,
          content,
          metadata.pattern_hash || null,
          metadata.reinforcement_count || 0,
        ]
      )).rows[0];
    case "M7":
      return (await query(
        `INSERT INTO m7_strategic (event_type, description, impact, impact_score) VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          metadata.event_type || "policy_update",
          content,
          metadata.impact || "neutral",
          metadata.impact_score ?? 0,
        ]
      )).rows[0];
    default:
      throw new Error(`unhandled PML layer: ${layer}`);
  }
}

/**
 * Query a PML layer. Day 2: simple recent-rows retrieval.
 * Day 4 adds semantic search via text-embedding-v4.
 */
async function retrieve(layer, { limit = 10 } = {}) {
  const table = TABLE_BY_LAYER[layer];
  if (!table) throw new Error(`unknown PML layer: ${layer}`);
  const res = await query(`SELECT * FROM ${table} ORDER BY timestamp DESC LIMIT $1`, [limit]);
  return res.rows;
}

/**
 * Tool-facing query used by toolExecutor.query_memory.
 * Accepts an optional `query` (ignored until Day 4 semantic search).
 */
async function queryLayer(layer, { query: q, limit = 10 } = {}) {
  // Day 2: keyword filter on text-ish columns; Day 4 upgrades to vector search.
  const rows = await retrieve(layer, { limit });
  if (!q) return { layer, count: rows.length, rows };
  const needle = String(q).toLowerCase();
  const filtered = rows.filter((r) =>
    JSON.stringify(r).toLowerCase().includes(needle)
  );
  return { layer, count: filtered.length, rows: filtered };
}

module.exports = { store, retrieve, query: queryLayer, TABLE_BY_LAYER };
