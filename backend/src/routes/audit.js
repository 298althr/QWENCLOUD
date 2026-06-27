// backend/src/routes/audit.js
// GET /api/audit — query the immutable audit log

const express = require("express");
const router = express.Router();
const { queryAudit } = require("../utils/audit");

router.get("/", async (req, res) => {
  try {
    const rows = await queryAudit({
      type: req.query.type,
      limit: Math.min(Number(req.query.limit) || 50, 500),
      from: req.query.from,
      to: req.query.to,
    });
    res.json({ entries: rows, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
