// backend/src/qwen/action-planner.js
// Intent -> multi-step action plan using qwen3.7-max with thinking mode + function calling.
// Returns the assistant message (which may contain tool_calls) plus the thinking trace.

const { qwen, MODELS } = require("./client");
const { TOOLS } = require("./skills");
const { executeTool } = require("./toolExecutor");

const SYSTEM_PROMPT = `You are the action planner for ALTHR Autopilot, an AI server operations agent running on Qwen Cloud.
Given a parsed intent and the current server state, produce a multi-step action plan by calling the provided tools.
Rules:
- Prefer read-only tools first (get_server_health, list_processes, check_ports, read_file) before mutating ones.
- Every mutating or service-affecting action MUST be preceded by a saf_check tool call.
- Use parallel_tool_calls when independent checks can run together (e.g. check CPU, RAM, and disk at once).
- If the user's request is ambiguous, choose the safest reasonable interpretation and note the assumption.
- After tools return, summarise the outcome for the operator in 1-3 sentences.`;

/**
 * @param {object} intent  Output of intent-parser.parseIntent
 * @param {object} serverState  Current server health snapshot
 * @param {object} opts  { parallelToolCalls: true }
 * @returns {{ message, reasoning, toolResults }}
 */
async function planAndAct(intent, serverState = {}, opts = {}) {
  const parallelToolCalls = opts.parallelToolCalls !== false;

  const res = await qwen.chat.completions.create({
    model: MODELS.MAX,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Intent: ${JSON.stringify(intent)}\n\nCurrent server state: ${JSON.stringify(serverState)}`,
      },
    ],
    tools: TOOLS,
    tool_choice: "auto",
    parallel_tool_calls: parallelToolCalls,
    enable_thinking: true,
    thinking_budget: 2000,
    preserve_thinking: true,
    temperature: 0.3,
  });

  const msg = res.choices[0].message;
  const reasoning = msg.reasoning_content || null;
  const toolResults = [];

  // Execute any tool calls the model made
  if (Array.isArray(msg.tool_calls) && msg.tool_calls.length) {
    for (const call of msg.tool_calls) {
      const name = call.function.name;
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }
      const result = await executeTool(name, args);
      toolResults.push({ id: call.id, name, args, result });
    }
  }

  return { message: msg.content, reasoning, toolResults, raw: msg };
}

module.exports = { planAndAct };
