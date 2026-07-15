const PUBLIC_ENDPOINTS = new Set([
  "/api/health",
  "/api/alibaba/health",
  "/api/alibaba/instance",
  "/api/deployments/webhook",
]);

function isPublic(path) {
  if (PUBLIC_ENDPOINTS.has(path)) return true;
  if (path === "/api") return true;
  return false;
}

function apiKeyAuth(req, res, next) {
  if (isPublic(req.path)) return next();

  const configuredKey = process.env.ALTHR_API_KEY;
  if (!configuredKey) return next();

  const providedKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (providedKey === configuredKey) {
    req.user = { username: "api", role: "admin" };
    return next();
  }

  return res.status(401).json({ error: "Invalid or missing API key. Set x-api-key header." });
}

module.exports = { apiKeyAuth };
