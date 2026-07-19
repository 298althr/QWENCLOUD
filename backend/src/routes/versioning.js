// backend/src/routes/versioning.js
// GET  /api/versioning/list     — list saved deployment versions
// POST /api/versioning/rollback — rollback to a specific version
// POST /api/versioning/save     — save current version (before manual changes)

const express = require("express");
const router = express.Router();
const { execSync } = require("child_process");
const { logAction } = require("../utils/actionHistory");

const APP_DIR = process.env.APP_DIR || "/opt/althr-autopilot";
const SCRIPT = `${APP_DIR}/scripts/versioning.sh`;

function runVersioning(args) {
  try {
    const output = execSync(`bash ${SCRIPT} ${args}`, {
      timeout: 120000,
      encoding: "utf8",
      cwd: APP_DIR,
    });
    return { ok: true, output: output.trim() };
  } catch (e) {
    return { ok: false, error: e.message, output: e.stdout || "" };
  }
}

router.get("/list", (req, res) => {
  const result = runVersioning("list");
  if (!result.ok) return res.status(500).json({ error: result.error });
  const versions = result.output
    .split("\n")
    .filter((l) => l.trim().startsWith("  ") && l.includes("("))
    .map((line) => {
      const match = line.trim().match(/^(\d+)\.\s+(\S+)\s+\(git:\s+(\S+)\)/);
      if (match) {
        return { index: parseInt(match[1]), id: match[2], gitHash: match[3] };
      }
      return null;
    })
    .filter(Boolean);
  res.json({ versions, raw: result.output });
});

router.post("/save", (req, res) => {
  const label = req.body?.label || "api-save";
  const result = runVersioning(`save ${label}`);
  if (!result.ok) return res.status(500).json({ error: result.error });
  logAction({ category: "versioning", action: "save", target: label, actor: req.user?.username || "api", result: "success" }).catch(() => {});
  res.json({ ok: true, output: result.output });
});

router.post("/rollback", (req, res) => {
  const target = req.body?.target || "last";
  const result = runVersioning(`rollback ${target}`);
  if (!result.ok) return res.status(500).json({ error: result.error });
  logAction({ category: "versioning", action: "rollback", target: String(target), actor: req.user?.username || "api", result: result.ok ? "success" : "failure" }).catch(() => {});
  res.json({ ok: true, output: result.output });
});

module.exports = router;
