// backend/src/routes/incidents.js
// REST endpoints for incident lifecycle management.

const express = require("express");
const router = express.Router();
const { listActiveIncidents, escalateIncident, resolveIncident } = require("../monitors/incidentResponse");
const { queryAudit, reqIp } = require("../utils/audit");
const { z } = require("zod");
const { validate, schemas } = require("../middleware/validate");

router.get("/active", (req, res) => {
  res.json({ incidents: listActiveIncidents(), timestamp: new Date().toISOString() });
});

router.post("/:incidentId/escalate", validate({ params: z.object({ incidentId: z.string().min(1).max(100) }), body: schemas.incidentEscalate }), async (req, res) => {
  try {
    const { incidentId } = req.params;
    const { reason = "manual escalation from dashboard" } = req.body || {};
    const io = req.app.get("io");
    const incident = await escalateIncident(incidentId, reason, io);
    res.json({ success: true, incident });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post("/:incidentId/resolve", validate({ params: z.object({ incidentId: z.string().min(1).max(100) }), body: schemas.incidentResolve }), async (req, res) => {
  try {
    const { incidentId } = req.params;
    const io = req.app.get("io");
    const incident = await resolveIncident(incidentId, req.body || {}, io);
    res.json({ success: true, incident });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get("/history", async (req, res) => {
  try {
    const rows = await queryAudit({ operation: "escalate", target_type: "incident", limit: 50 });
    res.json({ incidents: rows, timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: e.message, timestamp: new Date().toISOString() });
  }
});

module.exports = router;
