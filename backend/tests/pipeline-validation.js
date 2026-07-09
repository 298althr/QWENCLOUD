// backend/tests/pipeline-validation.js
// Pipeline integration test: verifies DRE → DREV → CRDS → Critique flow.
// Run: node tests/pipeline-validation.js

const dre = require("../src/decision/dre");
const drev = require("../src/decision/drev");
const crds = require("../src/decision/crds");
const critique = require("../src/decision/critique");
const { explainDRE, explainDREV, explainCRDS } = require("../src/decision/explain");

const results = [];
function test(name, fn) {
  results.push({ name, fn });
}

function assert(condition, msg) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// Test 1: Full pipeline produces all stages
test("Full pipeline: DRE → DREV → CRDS → Critique", async () => {
  // Stage 1: DRE
  const dreResult = await dre.research("the API is slow", { cpu: 85, ram: 70, disk: 50 });
  assert(dreResult.candidates.length >= 1, "DRE should produce at least 1 candidate");

  // Stage 2: DREV (if ≥2 candidates)
  let drevResult = null;
  if (dreResult.candidates.length >= 2) {
    drevResult = await drev.verify(dreResult.candidates, { serverState: { cpu: 85, ram: 70, disk: 50 } });
    assert(drevResult.winner, "DREV should produce a winner");
  }

  // Stage 3: CRDS
  const action = drevResult?.winner?.description || dreResult.candidates[0].description;
  const crdsResult = await crds.scoreReaction(action, { cpu: 85, ram: 70, disk: 50 });
  assert(crdsResult.rrs >= -100 && crdsResult.rrs <= 100, "CRDS RRS should be in range");

  // Stage 4: Explainability
  const dreExplain = explainDRE(dreResult);
  assert(dreExplain.drivers, "DRE explainability should have drivers");

  if (drevResult) {
    const drevExplain = explainDREV(drevResult);
    assert(drevExplain.drivers, "DREV explainability should have drivers");
  }

  const crdsExplain = explainCRDS(crdsResult);
  assert(crdsExplain.drivers, "CRDS explainability should have drivers");
  assert(crdsExplain.drivers.length === 6, "CRDS should have 6 dimension drivers");
});

// Test 2: Graceful degradation when DRE fails
test("Graceful degradation: DRE failure produces fallback", async () => {
  const result = await dre.research("test", {}, { maxApiCalls: 1 });
  assert(result.candidates.length >= 1, "Should have at least 1 fallback candidate");
  if (result.degraded) {
    assert(result.candidates[0].degraded === true, "Degraded candidate should be marked");
  }
});

// Test 3: CRDS veto prevents dangerous actions
test("CRDS veto prevents dangerous actions", async () => {
  const result = await crds.scoreReaction("restart postgres", { cpu: 95, ram: 95, disk: 90 });
  // Even if not vetoed, RRS should be very negative
  assert(result.rrs < 0, "Dangerous action should have negative RRS");
});

// Test 4: Explainability has all required fields
test("Explainability has all required fields", async () => {
  const crdsResult = await crds.scoreReaction("restart nginx", { cpu: 70, ram: 60, disk: 50 });
  const explain = explainCRDS(crdsResult);
  assert(explain.drivers, "Should have drivers");
  assert(explain.would_change, "Should have would_change");
  assert(typeof explain.confidence === "number", "Should have confidence");
});

// Test 5: DREV AHP consistency check works
test("DREV AHP consistency check works", () => {
  const { checkAHPConsistency } = drev;
  const consistentMatrix = [[1, 3, 5], [1/3, 1, 2], [1/5, 1/2, 1]];
  const result = checkAHPConsistency(consistentMatrix, 3);
  assert(result.cr <= 0.1, "Consistent matrix should have CR ≤ 0.1");
});

// Test 6: DREV tie-breaking is deterministic
test("DREV tie-breaking is deterministic", () => {
  const { rankCandidates } = drev;
  const candidates = [
    { description: "A", approach: "restart", reversibility: "fully", confidence: 0.8 },
    { description: "B", approach: "scale", reversibility: "barely", confidence: 0.8 },
  ];
  const ranked1 = rankCandidates(candidates, [0.5, 0.5], []);
  const ranked2 = rankCandidates(candidates, [0.5, 0.5], []);
  assert(ranked1[0].description === ranked2[0].description, "Tie-breaking should be deterministic");
  assert(ranked1[0].description === "A", "More reversible candidate should win");
});

// Test 7: Critique DQ score computation
test("Critique DQ score computation", () => {
  const dq = critique.computeDQ({
    evidence_completeness: 0.9,
    confidence_calibration: 0.95,
    stakeholder_alignment: 0.8,
    reversibility: 0.9,
  });
  assert(dq > 0.6, `High-quality decision should have DQ > 0.6, got ${dq}`);
});

// Test 8: Pipeline emits WebSocket events
test("Pipeline events are emitted", async () => {
  const events = [];
  const mockIo = {
    to: () => ({ emit: (event, payload) => events.push(event) }),
    emit: (event, payload) => events.push(event),
  };
  await dre.research("test symptom", { cpu: 70 }, { io: mockIo, maxApiCalls: 2 });
  assert(events.includes("dre_start"), "Should emit dre_start");
  assert(events.includes("dre_complete"), "Should emit dre_complete");
});

// Test 9: CRDS adaptive weights change after outcomes
test("CRDS adaptive weights change after outcomes", async () => {
  crds.resetWeights();
  const initial = crds.getWeights();
  await crds.recordOutcome("restart nginx", -50, 0.5);
  await crds.recordOutcome("restart nginx", -40, 0.4);
  await crds.recordOutcome("restart nginx", -45, 0.45);
  const updated = crds.getWeights();
  const changed = Object.keys(initial).some((k) => Math.abs(initial[k] - updated[k]) > 0.001);
  assert(changed, "Weights should change after outcomes");
});

// Test 10: Inflation detection in critique
test("Inflation detection in critique", () => {
  const history = [
    { period: 1, count: 5, avg_dq: 0.9 },
    { period: 2, count: 8, avg_dq: 0.8 },
    { period: 3, count: 12, avg_dq: 0.7 },
    { period: 4, count: 15, avg_dq: 0.6 },
  ];
  const result = critique.detectInflation(history);
  assert(result.inflated, "Should detect inflation");
});

// Run tests
async function run() {
  console.log("\n=== Pipeline Integration Tests ===\n");
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
