// backend/src/utils/audit.js
// Immutable audit logger. Every agent/human/system operation is recorded in
// audit_log, which has BEFORE UPDATE/DELETE triggers that raise an exception.

const { query } = require("../db/pool");

/**
 * @param {object} args
 * @param {string} args.operation  create|read|update|delete|execute|block
 * @param {string} args.actor      agent | human:username | system
 * @param {string} args.target     what was affected
 * @param {string} args.target_type memory|command|file|container|process
 * @param {string} [args.reasoning]
 * @param {number} [args.confidence]
 * @param {object} [args.safResult]  { l1, l2, ... } or full SAF result
 * @param {string} args.result     success|failure|blocked|...
 * @param {string} [args.ipAddress]
 * @returns {Promise<{id:number}>}
 */
async function audit({
  operation,
  actor,
  target,
  target_type,
  reasoning = null,
  confidence = null,
  safResult = null,
  result,
  ipAddress = null,
}) {
  const res = await query(
    `INSERT INTO audit_log
       (operation, actor, target, target_type, reasoning, confidence, saf_result, result, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::inet)
     RETURNING id, timestamp`,
    [
      operation,
      actor,
      target,
      target_type,
      reasoning,
      confidence,
      safResult ? JSON.stringify(safResult) : null,
      result,
      ipAddress,
    ]
  );
  return res.rows[0];
}

async function queryAudit({ type, limit = 50, from, to } = {}) {
  const conditions = [];
  const params = [];
  if (type) { params.push(type); conditions.push(`operation = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`timestamp >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`timestamp <= $${params.length}`); }
  params.push(limit);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const res = await query(
    `SELECT * FROM audit_log ${where} ORDER BY timestamp DESC LIMIT $${params.length}`,
    params
  );
  return res.rows;
}

module.exports = { audit, queryAudit };
