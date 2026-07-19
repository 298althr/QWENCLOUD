// backend/src/middleware/rateLimit.js
// Sliding-window rate limiter for REST API endpoints.
// No external dependency — uses in-memory Map with per-IP tracking.

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000);
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX || 100);
const BURST_MAX = Number(process.env.RATE_LIMIT_BURST || 20);

const buckets = new Map();

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function rateLimit(opts = {}) {
  const windowMs = opts.windowMs || WINDOW_MS;
  const max = opts.max || MAX_REQUESTS;
  const burst = opts.burst || BURST_MAX;

  return function (req, res, next) {
    const ip = getClientIp(req);
    const now = Date.now();
    const key = `${ip}:${req.path}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [], lastRequest: now };
      buckets.set(key, bucket);
    }

    // Prune entries outside the window
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

    // Check burst limit (requests in last 2 seconds)
    const recentBurst = bucket.timestamps.filter((t) => now - t < 2000).length;
    if (recentBurst >= burst) {
      res.setHeader("Retry-After", "2");
      return res.status(429).json({
        error: "Rate limit exceeded: too many requests in burst window",
        retry_after_ms: 2000,
      });
    }

    // Check window limit
    if (bucket.timestamps.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - bucket.timestamps[0])) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: `Rate limit exceeded: ${max} requests per ${windowMs / 1000}s window`,
        retry_after_ms: retryAfter * 1000,
      });
    }

    bucket.timestamps.push(now);
    bucket.lastRequest = now;

    // Periodic cleanup of stale buckets (every 1000 requests)
    if (buckets.size > 10000) {
      for (const [k, v] of buckets) {
        if (now - v.lastRequest > windowMs * 2) buckets.delete(k);
      }
    }

    next();
  };
}

module.exports = { rateLimit, getClientIp };
