// backend/src/mcp/server.js
// Model Context Protocol (MCP) server — exposes agent tools for dynamic discovery.
// Qwen can discover and invoke these tools via the MCP protocol.
//
// This is a lightweight MCP-compatible server that exposes:
// 1. Agent tools (health check, process list, etc.)
// 2. Decision intelligence tools (DRE research, DREV verify, CRDS reaction)
// 3. Memory tools (query, store)

const express = require("express");
const dre = require("../decision/dre");
const drev = require("../decision/drev");
const crds = require("../decision/crds");
const critique = require("../decision/critique");
const memory = require("../memory/store");
const { get_server_health } = require("../qwen/toolExecutor");

// MCP tool definitions — each tool has name, description, inputSchema
const MCP_TOOLS = [
  {
    name: "get_server_health",
    description: "Return current server health: CPU %, RAM %, disk %, uptime.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "research_incident",
    description: "Trigger DRE (Deep Research Engine) to research a symptom and generate ≥2 remediation candidates with source credibility, contradiction detection, and coverage scoring.",
    inputSchema: {
      type: "object",
      properties: {
        symptom: { type: "string", description: "Natural-language problem description" },
        serverState: { type: "object", description: "Current server metrics { cpu, ram, disk }" },
      },
      required: ["symptom"],
    },
  },
  {
    name: "verify_remediation",
    description: "Trigger DREV (Pairwise Verification Engine) to run a tournament bracket on candidates with AHP consistency check, robustness scoring, and reserve selection.",
    inputSchema: {
      type: "object",
      properties: {
        candidates: { type: "array", description: "Array of candidate objects from DRE" },
        regime: { type: "string", enum: ["normal", "high-load", "incident", "post-deploy"] },
        serverState: { type: "object" },
      },
      required: ["candidates"],
    },
  },
  {
    name: "score_reaction",
    description: "Trigger CRDS (Resource Contention and Ripple Reaction System) to score a candidate action's resource reaction impact with adaptive weights and cascade veto.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", description: "The action to score" },
        serverState: { type: "object", description: "Current server metrics" },
      },
      required: ["action"],
    },
  },
  {
    name: "query_memory",
    description: "Retrieve memories from a PML layer (M1-M7) with optional semantic search.",
    inputSchema: {
      type: "object",
      properties: {
        layer: { type: "string", enum: ["M1", "M2", "M3", "M4", "M5", "M6", "M7"] },
        query: { type: "string" },
        limit: { type: "integer", default: 10 },
      },
      required: ["layer"],
    },
  },
  {
    name: "store_memory",
    description: "Store a memory in a PML layer with optional metadata.",
    inputSchema: {
      type: "object",
      properties: {
        layer: { type: "string", enum: ["M1", "M2", "M3", "M4", "M5", "M6", "M7"] },
        content: { type: "string" },
        metadata: { type: "object" },
      },
      required: ["layer", "content"],
    },
  },
  {
    name: "get_decision_quality",
    description: "Get Claude Critique quality dashboard: quantity vs. quality split, feedback grades, DQ score.",
    inputSchema: { type: "object", properties: {} },
  },
];

/**
 * Handle an MCP tool invocation.
 * @param {string} toolName
 * @param {object} args
 * @returns {Promise<object>}
 */
async function handleToolCall(toolName, args = {}) {
  switch (toolName) {
    case "get_server_health":
      return await get_server_health();

    case "research_incident": {
      const result = await dre.research(args.symptom, args.serverState || {});
      return result;
    }

    case "verify_remediation": {
      const result = await drev.verify(args.candidates, {
        regime: args.regime,
        serverState: args.serverState,
      });
      return result;
    }

    case "score_reaction": {
      const result = await crds.scoreReaction(args.action, args.serverState || {});
      return result;
    }

    case "query_memory": {
      const result = await memory.query(args.layer, { query: args.query, limit: args.limit || 10 });
      return result;
    }

    case "store_memory": {
      const result = await memory.store(args.layer, args.content, args.metadata || {});
      return result;
    }

    case "get_decision_quality": {
      const [split, grades] = await Promise.all([
        critique.getQuantityQualitySplit(),
        critique.getRecentFeedbackGrades(20),
      ]);
      return { split, grades, dq_target: critique.DQ_TARGET };
    }

    default:
      throw new Error(`Unknown MCP tool: ${toolName}`);
  }
}

/**
 * Get the list of available MCP tools.
 * @returns {object[]}
 */
function listTools() {
  return MCP_TOOLS;
}

/**
 * Create an Express router for MCP endpoints.
 * POST /mcp/tools/list → returns tool definitions
 * POST /mcp/tools/call → invokes a tool
 */
function createMCPRouter() {
  const router = express.Router();

  // MCP tool discovery
  router.post("/tools/list", (req, res) => {
    res.json({ tools: MCP_TOOLS });
  });

  // MCP tool invocation
  router.post("/tools/call", async (req, res) => {
    const { name, arguments: args } = req.body;
    if (!name) {
      return res.status(400).json({ error: "tool name is required" });
    }
    try {
      const result = await handleToolCall(name, args || {});
      res.json({ result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET endpoint for tool list (convenience)
  router.get("/tools", (req, res) => {
    res.json({ tools: MCP_TOOLS });
  });

  return router;
}

module.exports = {
  MCP_TOOLS,
  listTools,
  handleToolCall,
  createMCPRouter,
};
