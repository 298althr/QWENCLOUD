// backend/src/pipeline/approvals.js
// Approval / escalation system.
// Holds pending human-in-the-loop actions and resolves them on approve/reject.
// Emits WebSocket events via the io instance set on the app.

const { v4: uuidv4 } = require("uuid");
const { query } = require("../db/pool");
const { audit } = require("../utils/audit");
const { executeTool } = require("../qwen/toolExecutor");

// In-memory cache for performance, backed by Postgres for persistence
const pending = new Map();

/**
 * Register a pending action awaiting human approval.
 * @returns {Promise<{action_id, status}>}
 */
async function createPendingAction({ plan, confidence, risk_level, saf, actor = "agent", source = "dashboard", io, decisionContext }) {
  const action_id = `act_${uuidv4().slice(0, 8)}`;
  const entry = {
    action_id,
    plan,
    confidence,
    risk_level,
    saf,
    status: "pending",
    actor,
    source,
    createdAt: new Date(),
    decisionContext: decisionContext || null,
  };
  
  // Persist to Postgres
  try {
    await query(
      `INSERT INTO pending_approvals (action_id, plan, confidence, risk_level, saf, status, actor, source, created_at, decision_context)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (action_id) DO UPDATE SET
         status = EXCLUDED.status,
         decision_context = EXCLUDED.decision_context`,
      [
        action_id,
        JSON.stringify(plan),
        confidence,
        risk_level,
        JSON.stringify(saf),
        "pending",
        actor,
        source,
        entry.createdAt,
        JSON.stringify(decisionContext || null)
      ]
    );
  } catch (e) {
    console.warn(`[approvals] Failed to persist to Postgres: ${e.message}`);
  }
  
  pending.set(action_id, entry);

  // Notify any connected dashboard/telegram clients with full DI context
  if (io) {
    io.emit("approval_needed", {
      action_id,
      plan,
      confidence,
      risk_level,
      saf,
      source,
      decisionContext: decisionContext || null,
      // Flatten key fields for easy display
      di_tier: decisionContext?.decision_mass?.tier || null,
      di_score: decisionContext?.decision_mass?.di || null,
      rrs: decisionContext?.crds?.rrs || null,
      crds_vetoed: decisionContext?.crds?.vetoed || false,
      drev_winner: decisionContext?.drev?.winner?.approach || null,
      drev_reserve: decisionContext?.drev?.reserve?.approach || null,
      drev_cr: decisionContext?.drev?.cr || null,
      drev_robustness: decisionContext?.drev?.robustness || null,
      dre_candidates: decisionContext?.dre?.candidates?.length || 0,
      dre_coverage: decisionContext?.dre?.coverage?.coverage || null,
      dre_contradiction: decisionContext?.dre?.contradiction_score || null,
      degradations: decisionContext?.degradations || [],
      explainability: decisionContext?.explainability || null,
    });
  }

  await audit({
    operation: "execute",
    actor,
    target: JSON.stringify(plan).slice(0, 500),
    target_type: "command",
    reasoning: `pending human approval (confidence=${confidence}, risk=${risk_level})`,
    confidence,
    safResult: saf,
    result: "blocked",
  });

  return { action_id, status: "pending" };
}

async function getPending(action_id) {
  // Check cache first
  if (pending.has(action_id)) {
    return pending.get(action_id);
  }
  
  // Load from Postgres
  try {
    const result = await query(
      `SELECT action_id, plan, confidence, risk_level, saf, status, actor, source, created_at, decision_context,
              executed_at, results, rejected_at, reject_reason
       FROM pending_approvals WHERE action_id = $1`,
      [action_id]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const entry = {
        action_id: row.action_id,
        plan: JSON.parse(row.plan),
        confidence: row.confidence,
        risk_level: row.risk_level,
        saf: JSON.parse(row.saf),
        status: row.status,
        actor: row.actor,
        source: row.source,
        createdAt: row.created_at,
        decisionContext: row.decision_context ? JSON.parse(row.decision_context) : null,
        executedAt: row.executed_at,
        results: row.results ? JSON.parse(row.results) : null,
        rejectedAt: row.rejected_at,
        rejectReason: row.reject_reason
      };
      pending.set(action_id, entry);
      return entry;
    }
  } catch (e) {
    console.warn(`[approvals] Failed to load from Postgres: ${e.message}`);
  }
  
  return null;
}

async function listPending() {
  // Load from Postgres to ensure persistence across restarts
  try {
    const result = await query(
      `SELECT action_id, plan, confidence, risk_level, saf, status, actor, source, created_at, decision_context
       FROM pending_approvals WHERE status = 'pending' ORDER BY created_at DESC`
    );
    const entries = result.rows.map(row => ({
      action_id: row.action_id,
      plan: JSON.parse(row.plan),
      confidence: row.confidence,
      risk_level: row.risk_level,
      saf: JSON.parse(row.saf),
      status: row.status,
      actor: row.actor,
      source: row.source,
      createdAt: row.created_at,
      decisionContext: row.decision_context ? JSON.parse(row.decision_context) : null
    }));
    
    // Update cache
    entries.forEach(entry => pending.set(entry.action_id, entry));
    
    return entries;
  } catch (e) {
    console.warn(`[approvals] Failed to list from Postgres: ${e.message}`);
    // Fallback to in-memory cache
    return [...pending.values()].filter((p) => p.status === "pending");
  }
}

/**
 * Approve a pending action: run it through SAF (with humanApproved=true) and execute.
 */
async function approveAction({ action_id, approver = "human:operator", io }) {
  const entry = await getPending(action_id);
  if (!entry) throw new Error(`unknown action_id: ${action_id}`);
  if (entry.status !== "pending") throw new Error(`action ${action_id} is already ${entry.status}`);

  const { safCheck } = require("./saf");
  const results = [];
  for (const step of entry.plan) {
    // Re-run SAF with humanApproved=true
    const saf = await safCheck(
      step.args?.command || step.name,
      step.args?.target || step.name,
      entry.risk_level,
      { username: approver.replace("human:", ""), role: "admin" },
      entry.confidence,
      true
    );
    if (!saf.passed) {
      results.push({ step, saf, executed: false, reason: "SAF blocked even after approval" });
      continue;
    }
    const result = await executeTool(step.name, step.args);
    results.push({ step, saf, executed: true, result });
  }

  entry.status = "approved";
  entry.executedAt = new Date();
  entry.results = results;
  pending.set(action_id, entry);

  // Update Postgres
  try {
    await query(
      `UPDATE pending_approvals SET status = $1, executed_at = $2, results = $3 WHERE action_id = $4`,
      ["approved", entry.executedAt, JSON.stringify(results), action_id]
    );
  } catch (e) {
    console.warn(`[approvals] Failed to update Postgres: ${e.message}`);
  }

  if (io) io.emit("action_update", { action_id, status: "approved", results });

  await audit({
    operation: "execute",
    actor: approver,
    target: JSON.stringify(entry.plan).slice(0, 500),
    target_type: "command",
    reasoning: `approved by ${approver}`,
    confidence: entry.confidence,
    safResult: entry.saf,
    result: "success",
  });

  return { action_id, status: "approved", results };
}

/**
 * Reject a pending action.
 */
async function rejectAction({ action_id, reason = "", approver = "human:operator", io }) {
  const entry = await getPending(action_id);
  if (!entry) throw new Error(`unknown action_id: ${action_id}`);
  entry.status = "rejected";
  entry.rejectedAt = new Date();
  entry.rejectReason = reason;
  pending.set(action_id, entry);

  // Update Postgres
  try {
    await query(
      `UPDATE pending_approvals SET status = $1, rejected_at = $2, reject_reason = $3 WHERE action_id = $4`,
      ["rejected", entry.rejectedAt, reason, action_id]
    );
  } catch (e) {
    console.warn(`[approvals] Failed to update Postgres: ${e.message}`);
  }

  if (io) io.emit("action_update", { action_id, status: "rejected", reason });

  await audit({
    operation: "block",
    actor: approver,
    target: JSON.stringify(entry.plan).slice(0, 500),
    target_type: "command",
    reasoning: `rejected: ${reason}`,
    confidence: entry.confidence,
    safResult: entry.saf,
    result: "blocked",
  });

  return { action_id, status: "rejected", reason };
}

// Initialize table on startup
async function initSchema() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS pending_approvals (
        action_id TEXT PRIMARY KEY,
        plan JSONB NOT NULL,
        confidence FLOAT NOT NULL,
        risk_level TEXT NOT NULL,
        saf JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        actor TEXT NOT NULL,
        source TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        decision_context JSONB,
        executed_at TIMESTAMPTZ,
        results JSONB,
        rejected_at TIMESTAMPTZ,
        reject_reason TEXT
      )
    `);
    console.log("[approvals] Schema initialized");
  } catch (e) {
    console.warn(`[approvals] Schema init failed: ${e.message}`);
  }
}

// Load pending approvals from Postgres on startup
async function loadPendingFromDb() {
  try {
    const result = await query(
      `SELECT action_id, plan, confidence, risk_level, saf, status, actor, source, created_at, decision_context,
              executed_at, results, rejected_at, reject_reason
       FROM pending_approvals WHERE status IN ('pending', 'approved', 'rejected') ORDER BY created_at DESC`
    );
    result.rows.forEach(row => {
      const entry = {
        action_id: row.action_id,
        plan: JSON.parse(row.plan),
        confidence: row.confidence,
        risk_level: row.risk_level,
        saf: JSON.parse(row.saf),
        status: row.status,
        actor: row.actor,
        source: row.source,
        createdAt: row.created_at,
        decisionContext: row.decision_context ? JSON.parse(row.decision_context) : null,
        executedAt: row.executed_at,
        results: row.results ? JSON.parse(row.results) : null,
        rejectedAt: row.rejected_at,
        rejectReason: row.reject_reason
      };
      pending.set(entry.action_id, entry);
    });
    console.log(`[approvals] Loaded ${result.rows.length} pending approvals from Postgres`);
  } catch (e) {
    console.warn(`[approvals] Failed to load from Postgres: ${e.message}`);
  }
}

module.exports = { createPendingAction, getPending, listPending, approveAction, rejectAction, initSchema, loadPendingFromDb };
