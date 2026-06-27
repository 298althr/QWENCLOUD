// backend/src/routes/learning.js
// GET /api/learning/lessons — learned patterns from M6

const express = require("express");
const router = express.Router();
const { getLessons } = require("../memory/learning");

router.get("/lessons", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const lessons = await getLessons({ limit });
    res.json({ lessons, count: lessons.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
