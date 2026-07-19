// backend/src/middleware/validate.js
// Zod-based input validation middleware factory.
// Usage: router.post("/analyze", validate({ body: analyzeSchema }), handler)

const { z } = require("zod");

function validate(schemas = {}) {
  return function (req, res, next) {
    try {
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            error: "Invalid request body",
            details: result.error.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
            })),
          });
        }
        req.body = result.data;
      }

      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
          return res.status(400).json({
            error: "Invalid query parameters",
            details: result.error.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
            })),
          });
        }
        req.query = result.data;
      }

      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
          return res.status(400).json({
            error: "Invalid path parameters",
            details: result.error.issues.map((i) => ({
              field: i.path.join("."),
              message: i.message,
            })),
          });
        }
        req.params = result.data;
      }

      next();
    } catch (e) {
      return res.status(500).json({ error: "Validation middleware error", detail: e.message });
    }
  };
}

// Common schemas for reuse
const schemas = {
  // RCA
  rcaAnalyze: z.object({
    anomaly: z.object({
      type: z.string().min(1).max(100),
      severity: z.enum(["info", "warning", "critical"]).optional(),
      message: z.string().min(1).max(500),
      data: z.record(z.any()).optional(),
    }),
    metrics: z.object({
      cpu: z.number().optional(),
      ram: z.number().optional(),
      disk: z.number().nullable().optional(),
    }).optional(),
  }),

  // Incident escalation
  incidentEscalate: z.object({
    reason: z.string().max(500).optional(),
  }),

  // Incident resolve
  incidentResolve: z.object({
    resolution: z.string().max(1000).optional(),
    root_cause: z.string().max(500).optional(),
  }),

  // Agent message
  agentMessage: z.object({
    message: z.string().min(1).max(5000),
  }),

  // Command execution
  commandExec: z.object({
    command: z.string().min(1).max(2000),
    args: z.record(z.any()).optional(),
  }),

  // File operations
  fileWrite: z.object({
    path: z.string().min(1).max(500),
    content: z.string().max(500000),
  }),

  fileRead: z.object({
    path: z.string().min(1).max(500),
  }),

  // Settings
  settingsUpdate: z.object({
    key: z.string().min(1).max(100),
    value: z.any(),
  }),

  // Kill switch
  killSwitch: z.object({
    action: z.enum(["trip", "reset"]),
    reason: z.string().max(500).optional(),
  }),

  // Remote SSH
  remoteHost: z.object({
    name: z.string().min(1).max(100),
    host: z.string().min(1).max(200),
    port: z.number().int().min(1).max(65535).optional(),
    username: z.string().min(1).max(100),
    privateKey: z.string().optional(),
  }),

  // Pagination
  pagination: z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
  }),

  // Memory query
  memoryQuery: z.object({
    q: z.string().min(1).max(1000),
    module: z.string().optional(),
    top_k: z.coerce.number().int().min(1).max(50).optional().default(5),
  }),
};

module.exports = { validate, schemas };
