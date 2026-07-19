const { query } = require("../db/pool");

let schemaInitialized = false;

async function ensureSchema() {
  if (schemaInitialized) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS action_history (
        id              SERIAL PRIMARY KEY,
        timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        category        VARCHAR(50) NOT NULL,
        action          VARCHAR(100) NOT NULL,
        target          TEXT,
        actor           VARCHAR(100) NOT NULL DEFAULT 'system',
        result          VARCHAR(20) NOT NULL DEFAULT 'success',
        detail          JSONB,
        duration_ms     INTEGER
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_action_history_ts ON action_history(timestamp DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_action_history_cat ON action_history(category)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_action_history_action ON action_history(action)`);
    schemaInitialized = true;
  } catch (e) {
    console.warn("[actionHistory] schema init failed:", e.message);
    schemaInitialized = true;
  }
}

ensureSchema();

async function logAction({ category, action, target, actor, result, detail, duration_ms }) {
  await query(
    `INSERT INTO action_history (category, action, target, actor, result, detail, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      category || "system",
      action || "unknown",
      target || null,
      actor || "system",
      result || "success",
      detail ? JSON.stringify(detail) : null,
      duration_ms || null,
    ]
  );
}

async function getActionHistory({ category, action, limit = 50, from, to } = {}) {
  const conditions = [];
  const params = [];
  if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
  if (action) { params.push(action); conditions.push(`action = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`timestamp >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`timestamp <= $${params.length}`); }
  params.push(Math.min(limit, 500));
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(
    `SELECT * FROM action_history ${where} ORDER BY timestamp DESC LIMIT $${params.length}`,
    params
  );
  return result.rows;
}

module.exports = { logAction, getActionHistory, ensureSchema };
