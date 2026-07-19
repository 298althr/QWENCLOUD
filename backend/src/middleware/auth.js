const jwt = require("jsonwebtoken");

const PUBLIC_ENDPOINTS = new Set([
  "/api/health",
  "/api/alibaba/health",
  "/api/alibaba/instance",
  "/api/deployments/webhook",
  "/api/auth/login",
]);

const SESSION_TIMEOUT_MS = Number(process.env.SESSION_TIMEOUT_MS || 30 * 60 * 1000); // 30 min default

function isPublic(path) {
  if (PUBLIC_ENDPOINTS.has(path)) return true;
  if (path === "/api") return true;
  return false;
}

function apiKeyAuth(req, res, next) {
  if (isPublic(req.path)) return next();

  const configuredKey = process.env.ALTHR_API_KEY;
  if (!configuredKey) {
    req.user = { username: "dev", role: "admin", sessionStart: Date.now() };
    return next();
  }

  // Try API key first
  const providedKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (providedKey === configuredKey) {
    req.user = { username: "api", role: "admin", sessionStart: Date.now() };
    return next();
  }

  // Try JWT token
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || configuredKey);
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        return res.status(401).json({ error: "Session expired. Please re-authenticate." });
      }
      req.user = {
        username: decoded.username || "jwt-user",
        role: decoded.role || "admin",
        sessionStart: decoded.iat ? decoded.iat * 1000 : Date.now(),
      };
      return next();
    } catch (e) {
      // Token invalid, fall through to rejection
    }
  }

  return res.status(401).json({
    error: "Invalid or missing API key. Set x-api-key header or Authorization: Bearer <token>.",
  });
}

function createSessionToken(user, expiresInSec = SESSION_TIMEOUT_MS / 1000) {
  const secret = process.env.JWT_SECRET || process.env.ALTHR_API_KEY;
  if (!secret) throw new Error("JWT_SECRET or ALTHR_API_KEY must be configured");
  return jwt.sign(
    { username: user.username, role: user.role },
    secret,
    { expiresIn: Math.floor(expiresInSec) }
  );
}

function sessionTimeout(req, res, next) {
  if (!req.user || !req.user.sessionStart) return next();
  const elapsed = Date.now() - req.user.sessionStart;
  if (elapsed > SESSION_TIMEOUT_MS) {
    return res.status(401).json({
      error: "Session timeout",
      detail: `Session exceeded ${SESSION_TIMEOUT_MS / 1000}s limit`,
    });
  }
  next();
}

module.exports = { apiKeyAuth, createSessionToken, sessionTimeout, isPublic };
