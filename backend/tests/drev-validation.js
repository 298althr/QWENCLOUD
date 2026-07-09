// backend/tests/drev-validation.js
// DREV (Pairwise Verification Engine) validation tests.
// Run: node tests/drev-validation.js

const {
  verify,
  buildScoreBasedMatrix,
  checkAHPConsistency,
  computePriorities,
  repairMatrix,
  rankCandidates,
  computeRobustness,
  detectRegime,
  regimeBacktest,
  shouldTerminate,
  AHP_CR_THRESHOLD,
  MARGINAL_IMPROVEMENT_THRESHOLD,
} = require("../src/decision/drev");

const results = [];
function test(name, fn) {
  results.push({ name, fn });
}

function assert(condition, msg) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// Test 1: DREV produces winner + reserve from 4 candidates
test("DREV produces winner + reserve from 4 candidates", async () => {
  const candidates = [
    { description: "Restart nginx", approach: "restart", impact: "medium", reversibility: "mostly", confidence: 0.8 },
    { description: "Scale horizontally", approach: "scale", impact: "high", reversibility: "fully", confidence: 0.7 },
    { description: "Rollback last deploy", approach: "rollback", impact: "high", reversibility: "fully", confidence: 0.6 },
    { description: "Kill top CPU process", approach: "isolate", impact: "low", reversibility: "partially", confidence: 0.5 },
  ];
  const result = await verify(candidates);
  assert(result.winner, "Should have a winner");
  assert(result.reserve, "Should have a reserve");
  assert(result.winner !== result.reserve, "Winner and reserve should be different");
});

// Test 2: AHP consistency check on consistent matrix
test("AHP consistency check on consistent matrix", () => {
  // Consistent 3×3 matrix
  const matrix = [
    [1, 3, 5],
    [1/3, 1, 2],
    [1/5, 1/2, 1],
  ];
  const result = checkAHPConsistency(matrix, 3);
  assert(result.cr <= AHP_CR_THRESHOLD, `CR should be ≤ ${AHP_CR_THRESHOLD}, got ${result.cr}`);
  assert(result.consistent, "Matrix should be consistent");
});

// Test 3: AHP detects inconsistent matrix
test("AHP detects inconsistent matrix", () => {
  // Highly inconsistent 3×3 matrix
  const matrix = [
    [1, 9, 1/9],
    [1/9, 1, 9],
    [9, 1/9, 1],
  ];
  const result = checkAHPConsistency(matrix, 3);
  assert(result.cr > AHP_CR_THRESHOLD, `CR should be > ${AHP_CR_THRESHOLD}, got ${result.cr}`);
  assert(!result.consistent, "Matrix should be inconsistent");
});

// Test 4: Matrix repair improves consistency
test("Matrix repair improves consistency", () => {
  const matrix = [
    [1, 9, 1/9],
    [1/9, 1, 9],
    [9, 1/9, 1],
  ];
  const original = checkAHPConsistency(matrix, 3);
  const repaired = repairMatrix(matrix, 3);
  const repairedResult = checkAHPConsistency(repaired, 3);
  assert(repairedResult.cr <= original.cr, `Repaired CR (${repairedResult.cr}) should be ≤ original (${original.cr})`);
});

// Test 5: Priorities sum to 1
test("Priorities sum to 1", () => {
  const matrix = [
    [1, 3, 5],
    [1/3, 1, 2],
    [1/5, 1/2, 1],
  ];
  const priorities = computePriorities(matrix, 3);
  const sum = priorities.reduce((a, b) => a + b, 0);
  assert(Math.abs(sum - 1) < 0.001, `Priorities should sum to 1, got ${sum}`);
});

// Test 6: Deterministic tie-breaking by reversibility
test("Deterministic tie-breaking by reversibility", () => {
  const candidates = [
    { description: "A", approach: "restart", reversibility: "barely", confidence: 0.8 },
    { description: "B", approach: "scale", reversibility: "fully", confidence: 0.8 },
  ];
  const priorities = [0.5, 0.5]; // Equal priorities
  const ranked = rankCandidates(candidates, priorities, []);
  assert(ranked[0].description === "B", "More reversible candidate should win tie-break");
});

// Test 7: Tie-breaking by historical success when reversibility is equal
test("Tie-breaking by historical success", () => {
  const candidates = [
    { description: "A", approach: "restart", reversibility: "mostly", confidence: 0.8 },
    { description: "B", approach: "scale", reversibility: "mostly", confidence: 0.8 },
  ];
  const priorities = [0.5, 0.5];
  const historical = [
    { approach: "restart", outcome: "success" },
    { approach: "restart", outcome: "failure" },
    { approach: "scale", outcome: "success" },
    { approach: "scale", outcome: "success" },
  ];
  const ranked = rankCandidates(candidates, priorities, historical);
  assert(ranked[0].description === "B", "Candidate with higher historical success should win");
});

// Test 8: Score-based fallback matrix is valid
test("Score-based fallback matrix is valid", () => {
  const candidates = [
    { description: "A", approach: "restart", impact: "high", reversibility: "mostly", confidence: 0.9 },
    { description: "B", approach: "scale", impact: "low", reversibility: "fully", confidence: 0.5 },
  ];
  const matrix = buildScoreBasedMatrix(candidates);
  assert(matrix.length === 2, "Matrix should be 2×2");
  assert(matrix[0][0] === 1, "Diagonal should be 1");
  assert(matrix[1][1] === 1, "Diagonal should be 1");
  assert(Math.abs(matrix[0][1] * matrix[1][0] - 1) < 0.01, "Matrix should be reciprocal");
});

// Test 9: Robustness score computation
test("Robustness score computation", () => {
  const matrix = [
    [1, 3, 5],
    [1/3, 1, 2],
    [1/5, 1/2, 1],
  ];
  const priorities = computePriorities(matrix, 3);
  const robustness = computeRobustness(matrix, 3, priorities);
  assert(robustness >= 0 && robustness <= 1, `Robustness should be 0-1, got ${robustness}`);
});

// Test 10: Regime detection from server state
test("Regime detection from server state", () => {
  assert(detectRegime({ cpu: 50, ram: 50 }) === "normal", "Normal regime expected");
  assert(detectRegime({ cpu: 90, ram: 50 }) === "high-load", "High-load regime expected");
  assert(detectRegime({ cpu: 50, ram: 95 }) === "high-load", "High-load regime expected for RAM");
});

// Test 11: Regime-aware backtest weights matching regime 3x
test("Regime-aware backtest weights matching regime 3x", () => {
  const historical = [
    { approach: "restart", outcome: "success", regime: "high-load" },
    { approach: "restart", outcome: "failure", regime: "normal" },
    { approach: "scale", outcome: "success", regime: "normal" },
  ];
  const result = regimeBacktest([], "high-load", historical);
  assert(result.regime === "high-load", "Should report high-load regime");
  assert(result.regime_matches === 1, "Should find 1 matching regime outcome");
});

// Test 12: Termination bound
test("Termination bound triggers on small improvement", () => {
  assert(shouldTerminate(0.85, 0.851), "Should terminate when improvement < 0.01");
  assert(!shouldTerminate(0.85, 0.90), "Should not terminate when improvement >= 0.01");
});

// Test 13: SAF veto eliminates candidates
test("SAF veto eliminates candidates", async () => {
  const candidates = [
    { description: "Safe action", approach: "restart", impact: "low", reversibility: "fully", confidence: 0.8 },
    { description: "Dangerous action", approach: "isolate", impact: "high", reversibility: "irreversible", confidence: 0.9 },
  ];
  const safCheck = (c) => ({ passed: c.reversibility !== "irreversible" });
  const result = await verify(candidates, { safCheck });
  assert(result.winner.description === "Safe action", "SAF should veto dangerous candidate");
});

// Test 14: Single candidate returns degraded mode
test("Single candidate returns degraded mode", async () => {
  const result = await verify([{ description: "Only option", approach: "restart", confidence: 0.7 }]);
  assert(result.degraded === true, "Single candidate should be degraded");
  assert(result.winner.description === "Only option", "Should still return the single candidate as winner");
});

// Test 15: Tournament cost is logged
test("Tournament cost is logged", async () => {
  const candidates = [
    { description: "A", approach: "restart", impact: "medium", reversibility: "mostly", confidence: 0.8 },
    { description: "B", approach: "scale", impact: "high", reversibility: "fully", confidence: 0.7 },
    { description: "C", approach: "rollback", impact: "high", reversibility: "fully", confidence: 0.6 },
  ];
  const result = await verify(candidates);
  assert(result.cost_log, "Cost log should exist");
  assert(result.cost_log.comparisons === 3, `Expected 3 comparisons for 3 candidates, got ${result.cost_log.comparisons}`);
  assert(result.cost_log.time_ms >= 0, "Time should be non-negative");
});

// Run tests
async function run() {
  console.log("\n=== DREV Validation Tests ===\n");
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
