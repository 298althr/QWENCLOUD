// backend/src/routes/auth.js
// Authentication endpoints — login, session refresh, session verify.

const express = require("express");
const router = express.Router();
const { createSessionToken, isPublic } = require("../middleware/auth");
const { reqIp } = require("../utils/audit");
const { audit } = require("../utils/audit");

// POST /api/auth/login — exchange API key for JWT session token
router.post("/login", (req, res) => {
  const configuredKey = process.env.ALTHR_API_KEY;
  if (!configuredKey) {
    // Dev mode — no key required, issue a session
    const token = createSessionToken({ username: "dev", role: "admin" });
    return res.json({
      token,
      expires_in: Number(process.env.SESSION_TIMEOUT_MS || 30 * 60 * 1000) / 1000,
      user: { username: "dev", role: "admin" },
    });
  }

  const providedKey = req.body?.api_key || req.headers["x-api-key"];
  if (!providedKey || providedKey !== configuredKey) {
    // Log failed login attempt
    audit({
      operation: "login",
      actor: "anonymous",
      target: "auth/login",
      target_type: "auth",
      reasoning: "Invalid API key",
      result: "failure",
      ipAddress: reqIp(req),
    }).catch(() => {});

    return res.status(401).json({ error: "Invalid API key" });
  }

  const username = req.body?.username || "api-user";
  const token = createSessionToken({ username, role: "admin" });

  // Log successful login
  audit({
    operation: "login",
    actor: `human:${username}`,
    target: "auth/login",
    target_type: "auth",
    reasoning: "API key validated, session token issued",
    result: "success",
    ipAddress: reqIp(req),
  }).catch(() => {});

  res.json({
    token,
    expires_in: Number(process.env.SESSION_TIMEOUT_MS || 30 * 60 * 1000) / 1000,
    user: { username, role: "admin" },
  });
});

// GET /api/auth/verify — verify current session
router.get("/verify", (req, res) => {
  if (req.user) {
    res.json({
      valid: true,
      user: { username: req.user.username, role: req.user.role },
      session_age_ms: Date.now() - (req.user.sessionStart || Date.now()),
    });
  } else {
    res.status(401).json({ valid: false, error: "No valid session" });
  }
});

// POST /api/auth/refresh — refresh session token
router.post("/refresh", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = createSessionToken({ username: req.user.username, role: req.user.role });
  res.json({
    token,
    expires_in: Number(process.env.SESSION_TIMEOUT_MS || 30 * 60 * 1000) / 1000,
  });
});

module.exports = router;
