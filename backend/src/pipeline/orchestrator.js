// backend/src/pipeline/orchestrator.js
// End-to-end orchestration: NL message -> intent -> certainty pipeline ->
// SAF -> execute (or hold for approval). Streams reasoning via WebSocket.

const { parseIntent } = require("../qwen/intent-parser");
const { runCertaintyPipeline } = require("./certainty");
const { safCheck } = require("./saf");
const { executeTool } = require("../qwen/toolExecutor");
const { createPendingAction } = require("./approvals");
const { audit } = require("../utils/audit");
const memory = require("../memory/store");

/**
 * @param {object} args
 * @param {string} args.message
 * @param {object} [args.serverState]
 * @param {object} [args.user]  { username, role }
 * @param {object} [args.io]    Socket.io server for streaming
 * @param {string} [args.source] "dashboard" | "telegram"
 * @param {string} [args.socketId]  to direct stream events to a single client
 * @returns {Promise<object>} { action_id, intent, plan, confidence, risk_level, authorization, reasoning, results }
 */
async function handleAgentMessage({ message, serverState = {}, user = { username: "agent", role: "admin" }, io, source = "dashboard", socketId }) {
  const emit = (event, payload) => {
    if (!io) return;
    if (socketId) io.to(socketId).emit(event, payload);
    else io.emit(event, payload);
  };

  // 1. Parse intent
  const intent = await parseIntent(message);
  emit("action_update", { stage: "intent", intent });

  // 2. Certainty pipeline (stages 1-7), streaming reasoning
  const pipeline = await runCertaintyPipeline({
    userMessage: message,
    serverState,
    onChunk: (evt) => emit(evt.type === "reasoning" ? "reasoning_stream" : "response_stream", { chunk: evt.chunk }),
  });

  // 3. Build a plan from the pipeline action + intent entities
  const plan = buildPlan(intent, pipeline);

  // 4. SAF check on the proposed action.
  // Use the primary plan step's tool name (or its command arg) as the SAF
  // "action" so L4 policy enforcement checks the real operation, not NL text.
  const primaryStep = plan[0] || { name: pipeline.action || message, args: {} };
  const safAction =
    primaryStep.name === "execute_command" && primaryStep.args?.command
      ? primaryStep.args.command
      : primaryStep.name;
  const target = intent.entities?.target || intent.summary || message;
  const saf = await safCheck(
    safAction,
    target,
    pipeline.risk_level,
    user,
    pipeline.confidence,
    false
  );
  emit("saf_result", { saf, action: safAction });

  // 5. Authorization routing
  let authorization;
  let results = [];
  let action_id = null;

  if (!saf.passed) {
    // SAF blocked — do not execute, even if pipeline authorized
    authorization = "blocked_saf";
    await audit({
      operation: "block",
      actor: user.username ? `human:${user.username}` : "agent",
      target: pipeline.action || message,
      target_type: "command",
      reasoning: `SAF blocked: ${JSON.stringify(saf.layers)}`,
      confidence: pipeline.confidence,
      safResult: saf,
      result: "blocked",
    });
    await memory.store("M6", `SAF blocked action: ${pipeline.action}`, {
      error_type: "saf_block",
      pattern_hash: require("crypto").createHash("md5").update(pipeline.action || message).digest("hex"),
    });
  } else if (pipeline.authorization_type === "auto") {
    authorization = "auto_executed";
    for (const step of plan) {
      const result = await executeTool(step.name, step.args);
      results.push({ step, result });
    }
    await audit({
      operation: "execute",
      actor: "agent",
      target: pipeline.action || message,
      target_type: "command",
      reasoning: pipeline.reasoning,
      confidence: pipeline.confidence,
      safResult: saf,
      result: "success",
    });
  } else if (pipeline.authorization_type === "human_approval_required") {
    authorization = "human_approval_required";
    const pending = await createPendingAction({
      plan,
      confidence: pipeline.confidence,
      risk_level: pipeline.risk_level,
      saf,
      actor: user.username ? `human:${user.username}` : "agent",
      source,
      io,
    });
    action_id = pending.action_id;
  } else {
    authorization = "blocked_escalate";
    await audit({
      operation: "block",
      actor: "agent",
      target: pipeline.action || message,
      target_type: "command",
      reasoning: `low confidence (${pipeline.confidence}) — escalated`,
      confidence: pipeline.confidence,
      safResult: saf,
      result: "blocked",
    });
  }

  emit("action_update", {
    stage: "complete",
    action_id,
    intent,
    confidence: pipeline.confidence,
    risk_level: pipeline.risk_level,
    authorization,
    results,
  });

  return {
    action_id,
    intent,
    plan,
    confidence: pipeline.confidence,
    risk_level: pipeline.risk_level,
    authorization,
    reasoning: pipeline.reasoning,
    saf,
    results,
  };
}

// Build a simple tool-call plan from intent + pipeline action.
// (The richer Qwen-driven plan via action-planner.js is used by the
// /api/agent-rich route; this keeps the synchronous path deterministic.)
function buildPlan(intent, pipeline) {
  const ents = intent.entities || {};
  const plan = [];
  switch (intent.intent) {
    case "monitor":
      if (/cpu|ram|disk|health/i.test(intent.summary || "")) plan.push({ name: "get_server_health", args: {} });
      if (ents.target && /port/i.test(ents.target)) plan.push({ name: "check_ports", args: {} });
      if (ents.target && /process/i.test(ents.target)) plan.push({ name: "list_processes", args: { sort_by: "cpu", limit: 20 } });
      if (!plan.length) plan.push({ name: "get_server_health", args: {} });
      break;
    case "command":
      if (ents.command) plan.push({ name: "execute_command", args: { command: ents.command } });
      break;
    case "file":
      if (ents.path) plan.push({ name: ents.command === "write" ? "write_file" : "read_file", args: { path: ents.path, content: ents.content } });
      break;
    case "security":
      plan.push({ name: "run_security_scan", args: { tool: ents.tool || "rkhunter" } });
      break;
    case "deploy":
      if (ents.repo_url) plan.push({ name: "git_clone", args: { repo_url: ents.repo_url, dest: ents.dest || "/tmp/deploy" } });
      break;
    default:
      // Fall back to a health check so the agent always does something observable
      plan.push({ name: "get_server_health", args: {} });
  }
  return plan;
}

module.exports = { handleAgentMessage };
