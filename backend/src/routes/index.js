// backend/src/routes/index.js
// Aggregator for all API route modules. Add new routers here as built.
const express = require("express");
const router = express.Router();

router.get("/", (req, res) => res.json({ name: "ALTHR Autopilot API", version: "0.1.0" }));

// Mount routers (added in subsequent days)
// router.use("/agent", require("./agent"));
// router.use("/command", require("./command"));
// router.use("/processes", require("./processes"));
// router.use("/ports", require("./ports"));
// router.use("/health/server", require("./server-health"));
// router.use("/docker", require("./docker"));
// router.use("/deployments", require("./deployments"));
// router.use("/file", require("./file"));
// router.use("/audit", require("./audit"));
// router.use("/security", require("./security"));
// router.use("/memory", require("./memory"));
// router.use("/analytics", require("./analytics"));
// router.use("/learning", require("./learning"));
// router.use("/auth", require("./auth"));
// router.use("/approvals", require("./approvals"));

module.exports = router;
