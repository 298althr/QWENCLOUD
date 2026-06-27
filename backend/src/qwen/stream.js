// backend/src/qwen/stream.js
// Streaming helpers for Qwen Chat Completions.
// Aggregates `delta.content`, `delta.reasoning_content`, and `delta.tool_calls`
// argument deltas across chunks (per OpenAI streaming convention).
//
// Emits callbacks for each chunk so callers can forward to WebSocket clients.

const { qwen, MODELS } = require("./client");
const { TOOLS } = require("./skills");

/**
 * Stream a chat completion with optional tool definitions.
 *
 * @param {object} opts
 * @param {array}  opts.messages
 * @param {string} [opts.model]       default MODELS.MAX
 * @param {boolean} [opts.enableThinking]  default true
 * @param {number}  [opts.thinkingBudget]  default 2000
 * @param {boolean} [opts.parallelToolCalls]
 * @param {object}  [opts.toolChoice]      e.g. { type:"function", function:{ name:"saf_check" } }
 * @param {(evt:object)=>void} [opts.onChunk]  called per delta event
 * @returns {Promise<{content, reasoning, toolCalls}>}
 */
async function streamChat({
  messages,
  model = MODELS.MAX,
  enableThinking = true,
  thinkingBudget = 2000,
  parallelToolCalls = true,
  toolChoice = "auto",
  onChunk,
}) {
  const stream = await qwen.chat.completions.create({
    model,
    messages,
    tools: TOOLS,
    tool_choice: toolChoice,
    parallel_tool_calls: parallelToolCalls,
    enable_thinking: enableThinking,
    thinking_budget: thinkingBudget,
    preserve_thinking: true,
    stream: true,
  });

  let content = "";
  let reasoning = "";
  const toolCalls = {}; // index -> { id, name, arguments }

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;

    if (delta.reasoning_content) {
      reasoning += delta.reasoning_content;
      onChunk?.({ type: "reasoning", chunk: delta.reasoning_content });
    }
    if (delta.content) {
      content += delta.content;
      onChunk?.({ type: "content", chunk: delta.content });
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        if (!toolCalls[idx]) toolCalls[idx] = { id: tc.id, name: "", arguments: "" };
        if (tc.id) toolCalls[idx].id = tc.id;
        if (tc.function?.name) toolCalls[idx].name = tc.function.name;
        if (tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments;
        onChunk?.({ type: "tool_call", index: idx, chunk: tc });
      }
    }
  }

  const toolCallList = Object.keys(toolCalls)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => {
      const tc = toolCalls[k];
      let args = {};
      try {
        args = JSON.parse(tc.arguments || "{}");
      } catch {
        args = { _raw: tc.arguments };
      }
      return { id: tc.id, name: tc.name, args };
    });

  return { content, reasoning, toolCalls: toolCallList };
}

module.exports = { streamChat };
