// backend/tests/dre-validation.js
// DRE (Deep Research Engine) validation tests.
// Run: node tests/dre-validation.js

const { research, generateSubquestions, scoreSourceCredibility, detectContradictions, computeCoverage } = require("../src/decision/dre");

const results = [];
function test(name, fn) {
  results.push({ name, fn });
}

function assert(condition, msg) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// Test 1: DRE generates ≥2 candidates for ambiguous input (requires API key)
test("DRE generates ≥2 candidates for ambiguous input", async () => {
  if (!process.env.DASHSCOPE_API_KEY) {
    console.log("    (skipped — no DASHSCOPE_API_KEY)");
    return;
  }
  const result = await research("the API is slow", { cpu: 85, ram: 70, disk: 40 });
  assert(result.candidates.length >= 2, `Expected ≥2 candidates, got ${result.candidates.length}`);
  // Check structural diversity
  const approaches = new Set(result.candidates.map((c) => c.approach));
  assert(approaches.size >= 2, `Expected ≥2 different approaches, got ${[...approaches].join(", ")}`);
});

// Test 2: Candidates have required fields
test("Candidates have required fields", async () => {
  const result = await research("database connection timeout", { cpu: 50, ram: 60, disk: 70 });
  for (const c of result.candidates) {
    assert(c.description, "Missing description");
    assert(c.approach, "Missing approach");
    assert(c.impact, "Missing impact");
    assert(c.reversibility, "Missing reversibility");
    assert(typeof c.confidence === "number", "Missing or invalid confidence");
    assert(Array.isArray(c.dependencies), "Missing or invalid dependencies");
  }
});

// Test 3: Source credibility scoring
test("Source credibility scoring produces 4-dimension scores", () => {
  const evidence = [
    { source: "live_metrics", content: "CPU: 90%, RAM: 85%, Disk: 50%", similarity: 1.0 },
    { source: "memory:M6", content: "Previous CPU spike resolved by restarting nginx service which was leaking memory", similarity: 0.75 },
    { source: "memory:M7", content: "Policy: restart services before scaling", similarity: 0.4 },
  ];
  const candidates = [{ approach: "restart" }, { approach: "scale" }];
  const scored = scoreSourceCredibility(evidence, candidates);
  assert(scored.length === 3, `Expected 3 scored sources, got ${scored.length}`);
  for (const s of scored) {
    assert(s.credibility.methodological_quality >= 1 && s.credibility.methodological_quality <= 5, "methodological_quality out of range");
    assert(s.credibility.coherence >= 1 && s.credibility.coherence <= 5, "coherence out of range");
    assert(s.credibility.adequacy >= 1 && s.credibility.adequacy <= 5, "adequacy out of range");
    assert(s.credibility.relevance >= 1 && s.credibility.relevance <= 5, "relevance out of range");
    assert(typeof s.credibility.average === "number", "Missing average");
    assert(typeof s.credibility.flagged === "boolean", "Missing flagged");
  }
});

// Test 4: Low-credibility sources are flagged
test("Low-credibility sources are flagged", () => {
  const evidence = [
    { source: "hearsay", content: "x", similarity: 0.1 },
  ];
  const scored = scoreSourceCredibility(evidence, []);
  assert(scored[0].credibility.flagged === true, "Low-credibility source should be flagged");
});

// Test 5: Contradiction detection
test("Contradiction detection identifies conflicting evidence", () => {
  const sources = [
    { source: "s1", content: "CPU is high at 95%", credibility: { flagged: false } },
    { source: "s2", content: "CPU is low at 20%", credibility: { flagged: false } },
  ];
  const result = detectContradictions(sources, []);
  assert(result.contradictions.length > 0, "Should detect contradiction between high/low CPU");
  assert(result.contradiction_score > 0, "Contradiction score should be > 0");
});

// Test 6: No contradictions when sources agree
test("No contradictions when sources agree", () => {
  const sources = [
    { source: "s1", content: "CPU is high at 95%", credibility: { flagged: false } },
    { source: "s2", content: "CPU is high at 90%", credibility: { flagged: false } },
  ];
  const result = detectContradictions(sources, []);
  assert(result.contradictions.length === 0, "Should not detect contradictions");
  assert(result.contradiction_score === 0, "Contradiction score should be 0");
});

// Test 7: Coverage score computation
test("Coverage score computation", () => {
  const subquestions = ["q1", "q2", "q3", "q4", "q5"];
  const sources = [{ content: "root cause identified, evidence supports diagnosis, alternative explanations considered, impact analyzed, dependencies mapped" }];
  const candidates = [{ answers_subquestions: [1, 2, 3] }];
  const result = computeCoverage(subquestions, sources, candidates);
  assert(result.total === 5, `Expected total=5, got ${result.total}`);
  assert(result.answered >= 4, `Expected answered≥4, got ${result.answered}`);
  assert(result.coverage >= 0.8, `Expected coverage≥0.8, got ${result.coverage}`);
});

// Test 8: Subquestion generation adapts to server state
test("Subquestion generation adapts to server state", () => {
  const sq1 = generateSubquestions("API slow", { cpu: 90, ram: 50, disk: 50 });
  assert(sq1.some((q) => q.includes("CPU")), "Should include CPU subquestion when CPU is high");
  
  const sq2 = generateSubquestions("API slow", { cpu: 30, ram: 95, disk: 50 });
  assert(sq2.some((q) => q.includes("memory")), "Should include memory subquestion when RAM is high");
  
  const sq3 = generateSubquestions("API slow", { cpu: 30, ram: 50, disk: 95 });
  assert(sq3.some((q) => q.includes("disk")), "Should include disk subquestion when disk is high");
});

// Test 9: Budget cap is enforced
test("Budget cap is enforced", async () => {
  const result = await research("test symptom", {}, { maxApiCalls: 2 });
  assert(result.budget_used <= result.budget_max, `Budget used (${result.budget_used}) should not exceed max (${result.budget_max})`);
});

// Test 10: Graceful degradation on Qwen failure
test("Graceful degradation produces fallback candidates", async () => {
  // Force a failure by passing empty state and relying on Qwen being unavailable
  // This tests the degradation path
  const result = await research("test", {}, { maxApiCalls: 1 });
  assert(result.candidates.length >= 1, "Should always have at least 1 candidate even in degraded mode");
  if (result.degraded) {
    assert(result.candidates[0].degraded === true, "Degraded candidate should be marked");
  }
});

// Run tests
async function run() {
  console.log("\n=== DRE Validation Tests ===\n");
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
