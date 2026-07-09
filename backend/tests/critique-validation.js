// backend/tests/critique-validation.js
// Claude Critique validation tests.
// Run: node tests/critique-validation.js

const {
  gradeFeedback,
  computeFeedbackDelta,
  computeDQ,
  detectInflation,
  runAuditChecklist,
  DQ_TARGET,
} = require("../src/decision/critique");

const results = [];
function test(name, fn) {
  results.push({ name, fn });
}

function assert(condition, msg) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// Test 1: Feedback grading produces average of 5 dimensions
test("Feedback grading produces average of 5 dimensions", () => {
  const grade = gradeFeedback({
    accuracy: 4, timeliness: 3, actionability: 5, completeness: 4, novelty: 2,
  });
  assert(grade === 3.6, `Expected 3.6, got ${grade}`);
});

// Test 2: Feedback grading rejects out-of-range values
test("Feedback grading rejects out-of-range values", () => {
  try {
    gradeFeedback({ accuracy: 6, timeliness: 3, actionability: 5, completeness: 4, novelty: 2 });
    assert(false, "Should reject accuracy > 5");
  } catch (e) {
    assert(e.message.includes("accuracy"), "Should mention accuracy");
  }
});

// Test 3: Feedback delta is in -1 to +1 range
test("Feedback delta is in -1 to +1 range", () => {
  const delta = computeFeedbackDelta({
    accuracy: 5, timeliness: 5, actionability: 5, completeness: 5, novelty: 5,
  });
  assert(delta === 1, `All 5s should give delta=1, got ${delta}`);

  const deltaLow = computeFeedbackDelta({
    accuracy: 1, timeliness: 1, actionability: 1, completeness: 1, novelty: 1,
  });
  assert(deltaLow === -1, `All 1s should give delta=-1, got ${deltaLow}`);

  const deltaMid = computeFeedbackDelta({
    accuracy: 3, timeliness: 3, actionability: 3, completeness: 3, novelty: 3,
  });
  assert(deltaMid === 0, `All 3s should give delta=0, got ${deltaMid}`);
});

// Test 4: DQ score is product of 4 components
test("DQ score is product of 4 components", () => {
  const dq = computeDQ({
    evidence_completeness: 0.9,
    confidence_calibration: 0.8,
    stakeholder_alignment: 0.7,
    reversibility: 0.6,
  });
  assert(dq === 0.302, `Expected 0.302, got ${dq}`);
});

// Test 5: DQ score with defaults
test("DQ score with missing components uses 0.5 default", () => {
  const dq = computeDQ({});
  assert(dq === 0.063, `Expected 0.063 (0.5^4), got ${dq}`);
});

// Test 6: Inflation detection — count rising, quality falling
test("Inflation detection — count rising, quality falling", () => {
  const history = [
    { period: 1, count: 5, avg_dq: 0.9 },
    { period: 2, count: 8, avg_dq: 0.8 },
    { period: 3, count: 12, avg_dq: 0.7 },
    { period: 4, count: 15, avg_dq: 0.6 },
  ];
  const result = detectInflation(history);
  assert(result.inflated === true, "Should detect inflation");
  assert(result.alert !== null, "Should have alert message");
});

// Test 7: No inflation when quality is stable
test("No inflation when quality is stable", () => {
  const history = [
    { period: 1, count: 5, avg_dq: 0.8 },
    { period: 2, count: 8, avg_dq: 0.8 },
    { period: 3, count: 12, avg_dq: 0.8 },
    { period: 4, count: 15, avg_dq: 0.8 },
  ];
  const result = detectInflation(history);
  assert(result.inflated === false, "Should not detect inflation when quality is stable");
});

// Test 8: No inflation when count is stable
test("No inflation when count is stable", () => {
  const history = [
    { period: 1, count: 10, avg_dq: 0.9 },
    { period: 2, count: 10, avg_dq: 0.8 },
    { period: 3, count: 10, avg_dq: 0.7 },
    { period: 4, count: 10, avg_dq: 0.6 },
  ];
  const result = detectInflation(history);
  assert(result.inflated === false, "Should not detect inflation when count is stable");
});

// Test 9: Insufficient history for inflation detection
test("Insufficient history for inflation detection", () => {
  const result = detectInflation([{ period: 1, count: 5, avg_dq: 0.9 }]);
  assert(result.inflated === false, "Should not detect inflation with insufficient data");
});

// Test 10: Audit checklist passes for valid decisions
test("Audit checklist passes for valid decisions", () => {
  const decisions = [
    {
      node: "nginx",
      magnitude: 0.5,
      confidence: 0.8,
      outcome: "success",
      feedback: { accuracy: 4, timeliness: 3, actionability: 5, completeness: 4, novelty: 3 },
      feedback_delta: 0.2,
      dq_score: 0.85,
    },
  ];
  const result = runAuditChecklist(decisions);
  assert(result.all_passed, "All checks should pass for valid decisions");
});

// Test 11: Audit checklist fails for missing feedback
test("Audit checklist fails for missing feedback", () => {
  const decisions = [
    {
      node: "nginx",
      magnitude: 0.5,
      confidence: 0.8,
      outcome: "success",
      feedback: null,
      feedback_delta: null,
    },
  ];
  const result = runAuditChecklist(decisions);
  assert(!result.all_passed, "Should fail for missing feedback");
  assert(result.failed.length > 0, "Should have failed checks");
});

// Test 12: Audit checklist fails for low DQ on critical decision
test("Audit checklist fails for low DQ on critical decision", () => {
  const decisions = [
    {
      node: "postgres",
      magnitude: 1.5, // critical
      confidence: 0.8,
      outcome: "success",
      feedback: { accuracy: 4, timeliness: 3, actionability: 5, completeness: 4, novelty: 3 },
      feedback_delta: 0.2,
      dq_score: 0.5, // below target
    },
  ];
  const result = runAuditChecklist(decisions);
  assert(!result.all_passed, "Should fail for low DQ on critical decision");
});

// Run tests
async function run() {
  console.log("\n=== Claude Critique Validation Tests ===\n");
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
