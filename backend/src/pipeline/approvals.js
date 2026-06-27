// backend/src/pipeline/approvals.js
// Approval / escalation system.
// Holds pending human-in-the-loop actions and resolves them on approve/reject.
// Emits WebSocket events via the io instance set on the app.

const { v4: uuidv4 } = require("uuid");
const { query } = require("../db/pool");
const { audit } = require("../utils/audit");
const { executeTool } = require("../qwen/toolExecutor");

// In-memory pending actions (Redis-backed persistence lands Day 4).
// Map<action_id, { action_id, plan, confidence, risk_level, saf, status, createdAt, resolve }>
const pending = new Map();

/**
 * Register a pending action awaiting human approval.
 * @returns {Promise<{action_id, status}>}
 */
async function createPendingAction({ plan, confidence, risk_level, saf, actor = "agent", source = "dashboard", io }) {
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
  };
  pending.set(action_id, entry);

  // Notify any connected dashboard/telegram clients
  if (io) {
    io.emit("approval_needed", {
      action_id,
      plan,
      confidence,
      risk_level,
      saf,
      source,
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

function getPending(action_id) {
  return pending.get(action_id);
}

function listPending() {
  return [...pending.values()].filter((p) => p.status === "pending");
}

/**
 * Approve a pending action: run it through SAF (with humanApproved=true) and execute.
 */
async function approveAction({ action_id, approver = "human:operator", io }) {
  const entry = pending.get(action_id);
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
  const entry = pending.get(action_id);
  if (!entry) throw new Error(`unknown action_id: ${action_id}`);
  entry.status = "rejected";
  entry.rejectedAt = new Date();
  entry.rejectReason = reason;
  pending.set(action_id, entry);

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

module.exports = { createPendingAction, getPending, listPending, approveAction, rejectAction };
