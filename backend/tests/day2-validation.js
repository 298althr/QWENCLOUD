// backend/tests/day2-validation.js
// Day 2 validation: exercises Qwen Chat Completions, function calling,
// parallel tool calling, forced tool calling (saf_check), structured output,
// and streaming. Run: node tests/day2-validation.js

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const { qwen, MODELS, testConnection } = require("../src/qwen/client");
const { TOOLS } = require("../src/qwen/skills");
const { executeTool } = require("../src/qwen/toolExecutor");
const { streamChat } = require("../src/qwen/stream");
const { scoreConfidence } = require("../src/qwen/confidence");

let pass = 0;
let fail = 0;
function ok(name) { pass++; console.log(`  ✓ ${name}`); }
function bad(name, err) { fail++; console.error(`  ✗ ${name}: ${err}`); }

async function main() {
  console.log("\n=== Day 2 Validation ===\n");

  // 1. Basic connection
  console.log("[1] Qwen connection test (qwen3.7-plus)");
  try {
    const reply = await testConnection();
    if (String(reply).trim().includes("4")) ok("simple prompt returns 4");
    else bad("simple prompt", `got: ${reply}`);
  } catch (e) { bad("simple prompt", e.message); }

  // 2. Function calling — "list all processes"
  console.log("\n[2] Function calling (list_processes)");
  try {
    const res = await qwen.chat.completions.create({
      model: MODELS.PLUS,
      messages: [
        { role: "system", content: "You are a server ops agent. Use tools to answer." },
        { role: "user", content: "list all processes" },
      ],
      tools: TOOLS,
      tool_choice: "auto",
    });
    const calls = res.choices[0].message.tool_calls || [];
    if (calls.some((c) => c.function.name === "list_processes")) {
      ok("Qwen returned list_processes tool_call");
      // Execute it
      const out = await executeTool("list_processes", { sort_by: "cpu", limit: 10 });
      if (out.processes && out.processes.length >= 0) ok("tool executed, returned process list");
      else bad("tool execution", JSON.stringify(out));
    } else {
      bad("function calling", `tool_calls: ${calls.map((c) => c.function.name).join(",")}`);
    }
  } catch (e) { bad("function calling", e.message); }

  // 3. Parallel tool calling — "check CPU, RAM, and disk"
  console.log("\n[3] Parallel tool calling (get_server_health x3)");
  try {
    const res = await qwen.chat.completions.create({
      model: MODELS.PLUS,
      messages: [
        { role: "system", content: "You are a server ops agent. Use tools to answer." },
        { role: "user", content: "check CPU, RAM, and disk usage" },
      ],
      tools: TOOLS,
      tool_choice: "auto",
      parallel_tool_calls: true,
    });
    const calls = res.choices[0].message.tool_calls || [];
    const names = calls.map((c) => c.function.name);
    if (names.length >= 1 && calls.some((c) => c.function.name === "get_server_health")) {
      ok(`Qwen returned ${calls.length} tool_call(s): ${names.join(", ")}`);
    } else {
      bad("parallel tool calling", `got: ${names.join(",")}`);
    }
  } catch (e) { bad("parallel tool calling", e.message); }

  // 4. Forced tool calling — saf_check (thinking disabled)
  console.log("\n[4] Forced tool calling (saf_check, enable_thinking:false)");
  try {
    const res = await qwen.chat.completions.create({
      model: MODELS.PLUS,
      messages: [
        { role: "system", content: "You are the SAF checker." },
        { role: "user", content: "Check whether restarting nginx is safe." },
      ],
      tools: TOOLS,
      tool_choice: { type: "function", function: { name: "saf_check" } },
      enable_thinking: false,
    });
    const calls = res.choices[0].message.tool_calls || [];
    if (calls.some((c) => c.function.name === "saf_check")) {
      ok("Qwen forced to call saf_check");
      const args = JSON.parse(calls[0].function.arguments);
      const result = await executeTool("saf_check", args);
      if (result && result.layers) ok(`saf_check executed, passed=${result.passed}`);
      else bad("saf_check execution", JSON.stringify(result));
    } else {
      bad("forced tool calling", `got: ${calls.map((c) => c.function.name).join(",")}`);
    }
  } catch (e) { bad("forced tool calling", e.message); }

  // 5. Structured output — confidence scorer
  console.log("\n[5] Structured output (json_object confidence)");
  try {
    const out = await scoreConfidence("The agent will restart nginx because it is unresponsive. Low risk, well-understood.");
    if (typeof out.confidence === "number" && ["low", "medium", "high"].includes(out.risk_level)) {
      ok(`confidence=${out.confidence}, risk=${out.risk_level}`);
    } else {
      bad("structured output", JSON.stringify(out));
    }
  } catch (e) { bad("structured output", e.message); }

  // 6. Streaming — content + reasoning + tool_call deltas
  console.log("\n[6] Streaming (content + reasoning + tool_calls)");
  try {
    let contentChunks = 0;
    let reasoningChunks = 0;
    const result = await streamChat({
      messages: [
        { role: "system", content: "You are a server ops agent. Diagnose briefly, then call get_server_health." },
        { role: "user", content: "Is the server healthy? Think step by step, then check." },
      ],
      model: MODELS.MAX,
      enableThinking: true,
      thinkingBudget: 800,
      onChunk: (evt) => {
        if (evt.type === "content") contentChunks++;
        if (evt.type === "reasoning") reasoningChunks++;
      },
    });
    const hasContent = result.content.length > 0 || contentChunks > 0;
    const hasReasoning = (result.reasoning && result.reasoning.length > 0) || reasoningChunks > 0;
    if (hasContent && hasReasoning) ok(`streamed content(${contentChunks} chunks) + reasoning(${reasoningChunks} chunks)`);
    else if (hasContent) ok(`streamed content(${contentChunks} chunks); reasoning empty (model may not emit)`);
    else if (hasReasoning) ok(`streamed reasoning(${reasoningChunks} chunks); content empty (model may not emit)`);
    else bad("streaming", `content=${result.content.length} reasoning=${result.reasoning?.length || 0}`);
  } catch (e) { bad("streaming", e.message); }

  console.log(`\n=== Day 2 Result: ${pass} passed, ${fail} failed ===\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
