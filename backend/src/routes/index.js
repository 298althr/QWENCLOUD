// backend/src/routes/index.js
// Aggregator for all API route modules.

const express = require("express");
const router = express.Router();

router.get("/", (req, res) => res.json({ name: "ALTHR Autopilot API", version: "0.1.0" }));

// Day 3 routes
router.use("/agent", require("./agent"));
router.use("/approvals", require("./approvals"));
router.use("/audit", require("./audit"));
router.use("/health/server", require("./server-health"));

// Day 4 routes
router.use("/memory", require("./memory"));

// Day 5 routes
router.use("/analytics", require("./analytics"));
router.use("/learning", require("./learning"));

// Day 6 routes
router.use("/processes", require("./processes"));
router.use("/ports", require("./ports"));
router.use("/docker", require("./docker"));

// Day 7 routes
router.use("/command", require("./command"));
router.use("/file", require("./file"));
router.use("/deployments", require("./deploy"));
router.use("/security", require("./security"));

// Day 6+ routes (added as built)
// router.use("/processes", require("./processes"));
// router.use("/ports", require("./ports"));
// router.use("/docker", require("./docker"));
// router.use("/deployments", require("./deployments"));
// router.use("/file", require("./file"));
// router.use("/security", require("./security"));
// router.use("/memory", require("./memory"));
// router.use("/analytics", require("./analytics"));
// router.use("/learning", require("./learning"));
// router.use("/auth", require("./auth"));

module.exports = router;
