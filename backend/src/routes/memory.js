// backend/src/routes/memory.js
// PML Memory API routes.
//   GET  /api/memory/:layer       — retrieve recent memories from a layer
//   POST /api/memory/store        — store a memory in a layer
//   GET  /api/memory/search       — semantic search across M6/M7

const express = require("express");
const router = express.Router();
const memory = require("../memory/store");

const VALID_LAYERS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7"];

// GET /api/memory/search?query=CPU+problems&layers=M6,M7&limit=10
router.get("/search", async (req, res) => {
  const q = req.query.query;
  if (!q) return res.status(400).json({ error: "query parameter is required" });
  const layers = (req.query.layers || "M6,M7")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((l) => VALID_LAYERS.includes(l));
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  try {
    const result = await memory.semanticSearch(q, layers, limit);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/memory/store
// Body: { layer, content, metadata }
router.post("/store", async (req, res) => {
  const { layer, content, metadata = {} } = req.body || {};
  if (!VALID_LAYERS.includes(layer)) return res.status(400).json({ error: "invalid layer (M1-M7)" });
  if (!content) return res.status(400).json({ error: "content is required" });
  try {
    const row = await memory.store(layer, content, metadata);
    res.json({ ok: true, layer, id: row.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/memory/:layer?limit=20&offset=0&query=...
router.get("/:layer", async (req, res) => {
  const { layer } = req.params;
  if (!VALID_LAYERS.includes(layer)) return res.status(400).json({ error: "invalid layer (M1-M7)" });
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;
  const q = req.query.query;
  try {
    const result = await memory.query(layer, { query: q, limit, offset });
    res.json({ layer, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
