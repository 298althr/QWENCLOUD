// backend/src/routes/approvals.js
// GET  /api/approvals          — list pending actions
// POST /api/approvals/:id/approve
// POST /api/approvals/:id/reject

const express = require("express");
const router = express.Router();
const { listPending, approveAction, rejectAction } = require("../pipeline/approvals");
const { query } = require("../db/pool");
const { logAction } = require("../utils/actionHistory");

router.get("/", async (req, res) => {
  try {
    const pending = await listPending();
    res.json({ pending });
  } catch (e) {
    res.json({ pending: [] });
  }
});

router.get("/history", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  try {
    const result = await query(
      `SELECT action_id, plan, confidence, risk_level, status, actor, source, created_at,
              executed_at, results, rejected_at, reject_reason, decision_context
       FROM pending_approvals
       WHERE status IN ('approved', 'rejected')
       ORDER BY COALESCE(executed_at, rejected_at, created_at) DESC
       LIMIT $1`,
      [limit]
    );
    const history = result.rows.map((row) => ({
      action_id: row.action_id,
      plan: typeof row.plan === "string" ? JSON.parse(row.plan) : row.plan,
      confidence: row.confidence,
      risk_level: row.risk_level,
      status: row.status,
      actor: row.actor,
      source: row.source,
      createdAt: row.created_at,
      executedAt: row.executed_at,
      rejectedAt: row.rejected_at,
      rejectReason: row.reject_reason,
      decisionContext: row.decision_context
        ? typeof row.decision_context === "string"
          ? JSON.parse(row.decision_context)
          : row.decision_context
        : null,
    }));
    res.json({ history });
  } catch (e) {
    res.json({ history: [] });
  }
});

router.post("/:id/approve", async (req, res) => {
  const io = req.app.get("io");
  const approver = req.user?.username ? `human:${req.user.username}` : "human:operator";
  try {
    const result = await approveAction({ action_id: req.params.id, approver, io });
    logAction({ category: "approval", action: "approve", target: req.params.id, actor: approver, result: "success", detail: result }).catch(() => {});
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/:id/reject", async (req, res) => {
  const io = req.app.get("io");
  const approver = req.user?.username ? `human:${req.user.username}` : "human:operator";
  try {
    const result = await rejectAction({
      action_id: req.params.id,
      reason: req.body?.reason || "",
      approver,
      io,
    });
    logAction({ category: "approval", action: "reject", target: req.params.id, actor: approver, result: "success", detail: { reason: req.body?.reason } }).catch(() => {});
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
