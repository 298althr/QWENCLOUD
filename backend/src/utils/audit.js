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
  // Sanitize IP address for inet cast
  let safeIp = null;
  if (ipAddress) {
    const cleaned = String(ipAddress).replace(/^::ffff:/, "");
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleaned) || /^[0-9a-f:]+$/i.test(cleaned)) {
      safeIp = cleaned;
    }
  }
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

async function queryAudit({ type, operation, limit = 50, from, to, target_type } = {}) {
  const conditions = [];
  const params = [];
  if (type) { params.push(type); conditions.push(`operation = $${params.length}`); }
  if (operation) { params.push(operation); conditions.push(`operation = $${params.length}`); }
  if (target_type) { params.push(target_type); conditions.push(`target_type = $${params.length}`); }
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

function reqIp(req) {
  if (!req) return null;
  const fwd = req.headers?.["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}

module.exports = { audit, queryAudit, reqIp };
