// backend/src/middleware/errorHandler.js
// Global error handling middleware for Express.
// Must be registered AFTER all routes with app.use(errorHandler).

function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: "Not Found",
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
}

function errorHandler(err, req, res, next) {
  // Log the error for debugging
  console.error(`[error] ${req.method} ${req.path}:`, err.message);

  // Don't leak stack traces in production
  const isProd = process.env.NODE_ENV === "production";

  // Handle specific error types
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Invalid JSON payload",
      detail: "Request body must be valid JSON",
    });
  }

  if (err.code === "ECONNREFUSED") {
    return res.status(503).json({
      error: "Service Unavailable",
      detail: "A downstream service is not responding",
    });
  }

  if (err.code === "ENOTFOUND") {
    return res.status(502).json({
      error: "Bad Gateway",
      detail: "Unable to resolve upstream service",
    });
  }

  if (err.code === "ETIMEDOUT" || err.code === "ESOCKETTIMEDOUT") {
    return res.status(504).json({
      error: "Gateway Timeout",
      detail: "Upstream service took too long to respond",
    });
  }

  if (err.name === "ZodError") {
    return res.status(400).json({
      error: "Validation Error",
      details: err.issues?.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })) || [],
    });
  }

  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      error: "Unauthorized",
      detail: err.message,
    });
  }

  if (err.type === "StripeError") {
    return res.status(402).json({
      error: "Payment Required",
      detail: err.message,
    });
  }

  // Database errors
  if (err.code === "23505") {
    return res.status(409).json({
      error: "Conflict",
      detail: "Resource already exists",
    });
  }

  if (err.code === "23503") {
    return res.status(400).json({
      error: "Foreign Key Violation",
      detail: "Referenced resource does not exist",
    });
  }

  if (err.code === "23502") {
    return res.status(400).json({
      error: "Missing Required Field",
      detail: err.message,
    });
  }

  if (err.code === "42P01") {
    return res.status(500).json({
      error: "Database Schema Error",
      detail: "Table does not exist — database may need initialization",
    });
  }

  // Rate limit errors
  if (err.status === 429) {
    return res.status(429).json({
      error: "Rate Limit Exceeded",
      detail: err.message,
    });
  }

  // Default: 500 Internal Server Error
  const response = {
    error: "Internal Server Error",
    detail: isProd ? undefined : err.message,
    timestamp: new Date().toISOString(),
  };

  if (!isProd && err.stack) {
    response.stack = err.stack;
  }

  res.status(err.status || err.statusCode || 500).json(response);
}

// Async error wrapper — wraps async route handlers to catch rejected promises
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, notFoundHandler, asyncHandler };
