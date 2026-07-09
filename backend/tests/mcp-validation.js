// backend/tests/mcp-validation.js
// MCP (Model Context Protocol) + Custom Skills + Multi-model + HITL validation tests.
// Run: node tests/mcp-validation.js

const { MCP_TOOLS, listTools, handleToolCall, createMCPRouter } = require("../src/mcp/server");
const { TOOLS, TOOL_MAP } = require("../src/qwen/skills");
const { MODELS, selectModel } = require("../src/qwen/client");
const { createPendingAction, listPending, approveAction, rejectAction } = require("../src/pipeline/approvals");

const results = [];
function test(name, fn) {
  results.push({ name, fn });
}

function assert(condition, msg) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// Test 1: MCP server exposes tool discovery
test("MCP server exposes tool discovery", () => {
  const tools = listTools();
  assert(tools.length >= 7, `Expected ≥7 MCP tools, got ${tools.length}`);
  const names = tools.map((t) => t.name);
  assert(names.includes("research_incident"), "Should expose research_incident");
  assert(names.includes("verify_remediation"), "Should expose verify_remediation");
  assert(names.includes("score_reaction"), "Should expose score_reaction");
  assert(names.includes("get_server_health"), "Should expose get_server_health");
  assert(names.includes("query_memory"), "Should expose query_memory");
  assert(names.includes("store_memory"), "Should expose store_memory");
});

// Test 2: MCP tools have inputSchema
test("MCP tools have inputSchema", () => {
  for (const tool of MCP_TOOLS) {
    assert(tool.name, "Tool should have name");
    assert(tool.description, "Tool should have description");
    assert(tool.inputSchema, `Tool ${tool.name} should have inputSchema`);
    assert(tool.inputSchema.type === "object", `Tool ${tool.name} inputSchema should be object type`);
  }
});

// Test 3: Custom skills are registered in Qwen tools
test("Custom skills are registered in Qwen tools", () => {
  assert(TOOL_MAP["research_incident"], "research_incident should be in TOOL_MAP");
  assert(TOOL_MAP["verify_remediation"], "verify_remediation should be in TOOL_MAP");
  assert(TOOL_MAP["score_reaction"], "score_reaction should be in TOOL_MAP");
  const totalTools = TOOLS.length;
  assert(totalTools >= 15, `Expected ≥15 tools (12 original + 3 custom), got ${totalTools}`);
});

// Test 4: Custom skills have proper function-calling format
test("Custom skills have proper function-calling format", () => {
  for (const name of ["research_incident", "verify_remediation", "score_reaction"]) {
    const tool = TOOL_MAP[name];
    assert(tool.type === "function", `${name} should be type "function"`);
    assert(tool.function.name === name, `${name} should have matching function name`);
    assert(tool.function.parameters, `${name} should have parameters`);
  }
});

// Test 5: Multi-model routing selects correct models
test("Multi-model routing selects correct models", () => {
  assert(selectModel("simple") === MODELS.TURBO, "simple → turbo");
  assert(selectModel("intent") === MODELS.TURBO, "intent → turbo");
  assert(selectModel("dre") === MODELS.PLUS, "dre → plus");
  assert(selectModel("drev") === MODELS.PLUS, "drev → plus");
  assert(selectModel("complex") === MODELS.MAX, "complex → max");
  assert(selectModel("diagnosis") === MODELS.MAX, "diagnosis → max");
  assert(selectModel("embedding") === MODELS.EMBEDDING, "embedding → text-embedding-v4");
  assert(selectModel("unknown") === MODELS.PLUS, "unknown → plus (default)");
});

// Test 6: MODELS includes TURBO
test("MODELS includes TURBO", () => {
  assert(MODELS.TURBO === "qwen-turbo", `TURBO should be qwen-turbo, got ${MODELS.TURBO}`);
  assert(MODELS.PLUS === "qwen3.7-plus", `PLUS should be qwen3.7-plus, got ${MODELS.PLUS}`);
  assert(MODELS.MAX === "qwen3.7-max", `MAX should be qwen3.7-max, got ${MODELS.MAX}`);
});

// Test 7: MCP handleToolCall works for score_reaction
test("MCP handleToolCall works for score_reaction", async () => {
  const result = await handleToolCall("score_reaction", {
    action: "restart nginx",
    serverState: { cpu: 70, ram: 60, disk: 50 },
  });
  assert(result.rrs >= -100 && result.rrs <= 100, `RRS should be in range, got ${result.rrs}`);
  assert(result.dimensions, "Should have dimensions");
});

// Test 8: MCP handleToolCall rejects unknown tools
test("MCP handleToolCall rejects unknown tools", async () => {
  try {
    await handleToolCall("nonexistent_tool", {});
    assert(false, "Should throw for unknown tool");
  } catch (e) {
    assert(e.message.includes("Unknown MCP tool"), "Should mention unknown tool");
  }
});

// Test 9: MCP router is an Express router
test("MCP router is an Express router", () => {
  const router = createMCPRouter();
  assert(typeof router === "function", "Router should be a function (Express middleware)");
});

// Test 10: HITL approval includes DI context
test("HITL approval includes DI context", async () => {
  const events = [];
  const mockIo = { emit: (event, payload) => events.push({ event, payload }) };
  
  const pending = await createPendingAction({
    plan: [{ name: "test", args: {} }],
    confidence: 0.7,
    risk_level: "medium",
    saf: { passed: true },
    actor: "test",
    source: "test",
    io: mockIo,
    decisionContext: {
      decision_mass: { tier: "medium", di: 1.5 },
      dre: { candidates: [{ description: "A" }, { description: "B" }], coverage: { coverage: 0.9 }, contradiction_score: 0.05 },
      drev: { winner: { approach: "restart" }, reserve: { approach: "scale" }, cr: 0.05, robustness: 0.92 },
      crds: { rrs: -30, vetoed: false },
      degradations: [],
      explainability: { dre: { drivers: [] }, drev: { drivers: [] }, crds: { drivers: [] } },
    },
  });
  
  assert(pending.action_id, "Should return action_id");
  assert(pending.status === "pending", "Should be pending");
  
  const approvalEvent = events.find((e) => e.event === "approval_needed");
  assert(approvalEvent, "Should emit approval_needed event");
  assert(approvalEvent.payload.di_tier === "medium", "Should include DI tier");
  assert(approvalEvent.payload.di_score === 1.5, "Should include DI score");
  assert(approvalEvent.payload.rrs === -30, "Should include RRS");
  assert(approvalEvent.payload.drev_winner === "restart", "Should include DREV winner");
  assert(approvalEvent.payload.drev_reserve === "scale", "Should include DREV reserve");
  assert(approvalEvent.payload.drev_cr === 0.05, "Should include DREV CR");
  assert(approvalEvent.payload.drev_robustness === 0.92, "Should include DREV robustness");
  assert(approvalEvent.payload.dre_candidates === 2, "Should include DRE candidate count");
  assert(approvalEvent.payload.dre_coverage === 0.9, "Should include DRE coverage");
  assert(approvalEvent.payload.explainability, "Should include explainability");
});

// Test 11: HITL listPending shows pending actions
test("HITL listPending shows pending actions", async () => {
  const mockIo = { emit: () => {} };
  await createPendingAction({
    plan: [{ name: "test2", args: {} }],
    confidence: 0.6,
    risk_level: "low",
    saf: { passed: true },
    source: "test",
    io: mockIo,
  });
  const list = listPending();
  assert(list.length > 0, "Should have pending actions");
});

// Test 12: HITL rejectAction works
test("HITL rejectAction works", async () => {
  const mockIo = { emit: () => {} };
  const pending = await createPendingAction({
    plan: [{ name: "test3", args: {} }],
    confidence: 0.5,
    risk_level: "medium",
    saf: { passed: true },
    source: "test",
    io: mockIo,
  });
  const result = await rejectAction({ action_id: pending.action_id, reason: "test rejection" });
  assert(result.status === "rejected", "Should be rejected");
});

// Run tests
async function run() {
  console.log("\n=== MCP + Custom Skills + HITL Validation Tests ===\n");
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of results) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (e) {
      console.log(`  ❌ ${name}: ${e.message}`);
      failed++;
    }
  }
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
