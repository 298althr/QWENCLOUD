// backend/src/qwen/action-planner.js
// Intent -> multi-step action plan using qwen3.7-max with thinking mode + function calling.
// Returns the assistant message (which may contain tool_calls) plus the thinking trace.

const { qwen, MODELS } = require("./client");
const { TOOLS } = require("./skills");
const { executeTool } = require("./toolExecutor");
const { guardedCreate, getThinkingBudget } = require("./guardrails");
const { ACTION_PLANNER_PROMPT } = require("./prompts");

const SYSTEM_PROMPT = ACTION_PLANNER_PROMPT;

/**
 * @param {object} intent  Output of intent-parser.parseIntent
 * @param {object} serverState  Current server health snapshot
 * @param {object} opts  { parallelToolCalls: true }
 * @returns {{ message, reasoning, toolResults }}
 */
async function planAndAct(intent, serverState = {}, opts = {}) {
  const parallelToolCalls = opts.parallelToolCalls !== false;

  const res = await guardedCreate(qwen, {
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
    thinking_budget: getThinkingBudget("planning"),
    preserve_thinking: true,
    temperature: 0.3,
  }, { module: "action-planner", taskType: "planning" });

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
