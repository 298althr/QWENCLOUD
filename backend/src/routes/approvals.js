// backend/src/routes/approvals.js
// GET  /api/approvals          — list pending actions
// POST /api/approvals/:id/approve
// POST /api/approvals/:id/reject

const express = require("express");
const router = express.Router();
const { listPending, approveAction, rejectAction } = require("../pipeline/approvals");

router.get("/", (req, res) => {
  res.json({ pending: listPending() });
});

router.post("/:id/approve", async (req, res) => {
  const io = req.app.get("io");
  const approver = req.user?.username ? `human:${req.user.username}` : "human:operator";
  try {
    const result = await approveAction({ action_id: req.params.id, approver, io });
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
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
