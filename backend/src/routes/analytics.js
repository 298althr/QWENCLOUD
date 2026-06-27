// backend/src/routes/analytics.js
// GET /api/analytics/dq-trend — DQ score trend over time

const express = require("express");
const router = express.Router();
const { getDQTrend } = require("../memory/learning");

router.get("/dq-trend", async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const scores = await getDQTrend({ days });
    res.json({ scores });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
