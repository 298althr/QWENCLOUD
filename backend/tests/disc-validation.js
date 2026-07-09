// backend/tests/disc-validation.js
// DISC (Decision Information Scoring Chain) validation tests.
// Run: node tests/disc-validation.js

const disc = require("../src/decision/disc");

const results = [];
function test(name, fn) {
  results.push({ name, fn });
}
function assert(condition, msg) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// Test 1: Basic ranking
test("Basic ranking produces ranked list", async () => {
  const sources = [
    { id: "s1", name: "CPU metric", value: 0.9, timestamp: new Date().toISOString(), cost: 1 },
    { id: "s2", name: "RAM metric", value: 0.7, timestamp: new Date().toISOString(), cost: 1 },
    { id: "s3", name: "Disk metric", value: 0.5, timestamp: new Date().toISOString(), cost: 1 },
  ];
  const result = await disc.rank(sources);
  assert(result.ranked.length === 3, "Should rank all 3 sources");
  assert(result.ranked[0].rank_weight >= result.ranked[1].rank_weight, "First should have highest weight");
});

// Test 2: Redundant signals are demoted
test("Redundant signals are demoted", async () => {
  const sources = [
    { id: "s1", name: "CPU-1", value: 0.9, timestamp: new Date().toISOString(), cost: 1 },
    { id: "s2", name: "CPU-2", value: 0.89, timestamp: new Date().toISOString(), cost: 1 }, // highly correlated
    { id: "s3", name: "Disk", value: 0.3, timestamp: new Date().toISOString(), cost: 1 },
  ];
  const result = await disc.rank(sources);
  assert(result.redundant_pairs.length > 0, "Should detect redundant pair");
  const demoted = result.ranked.find((r) => r.demoted);
  assert(demoted, "At least one source should be demoted");
});

// Test 3: Stale signal decays
test("Stale signal decays", () => {
  const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48h ago
  const sources = [
    { id: "s1", name: "old", value: 0.9, timestamp: oldTime, cost: 1 },
    { id: "s2", name: "fresh", value: 0.9, timestamp: new Date().toISOString(), cost: 1 },
  ];
  const decayed = disc.applyDecay(sources);
  const oldSignal = decayed.find((d) => d.name === "old");
  const freshSignal = decayed.find((d) => d.name === "fresh");
  assert(oldSignal.decayed_weight < freshSignal.decayed_weight, "Old signal should have lower weight");
  assert(oldSignal.age_hours > 47, "Old signal age should be ~48h");
});

// Test 4: Rare-event stress weight boosts relevant sources
test("Rare-event stress weight boosts relevant sources", () => {
  const sources = [
    { id: "s1", name: "normal", value: 0.5, is_rare_event: false },
    { id: "s2", name: "rare", value: 0.5, is_rare_event: true },
  ];
  const stressed = disc.applyRareEventStress(sources, true);
  const rare = stressed.find((s) => s.name === "rare");
  const normal = stressed.find((s) => s.name === "normal");
  assert(rare.stress_weight === 1.5, "Rare event should get 1.5x boost");
  assert(normal.stress_weight === 1.0, "Normal event should stay at 1.0");
});

// Test 5: Cost-efficiency score computed
test("Cost-efficiency score computed", async () => {
  const sources = [
    { id: "s1", name: "cheap_valuable", value: 0.9, timestamp: new Date().toISOString(), cost: 1 },
    { id: "s2", name: "expensive_less_valuable", value: 0.3, timestamp: new Date().toISOString(), cost: 10 },
  ];
  const result = await disc.rank(sources);
  assert(result.cost_efficiency > 0, "Cost-efficiency should be positive");
  assert(result.cost_efficiency < 1, "CE should be < 1 with expensive low-value source");
});

// Test 6: Causal validation flags spurious correlation
test("Causal validation flags spurious correlation", async () => {
  const earlier = new Date(Date.now() - 60000).toISOString();
  const later = new Date().toISOString();
  const sources = [
    { id: "s1", name: "confound", value: 0.9, timestamp: earlier, cost: 1 },
    { id: "s2", name: "spurious", value: 0.89, timestamp: later, cost: 1 },
  ];
  const result = await disc.rank(sources);
  // The spurious source should be flagged via causal_flags
  assert(result.causal_flags.length > 0, "Should have causal flags");
  assert(result.causal_flags.some((f) => f.type === "confound"), "Should flag confound");
});

// Test 7: 4-layer DISC structure
test("4-layer DISC structure returned", async () => {
  const sources = [{ id: "s1", name: "test", value: 0.5, timestamp: new Date().toISOString(), cost: 1 }];
  const result = await disc.rank(sources);
  assert(result.layers.length === 4, "Should have 4 layers");
  assert(result.layers[0] === "source", "First layer should be 'source'");
  assert(result.layers[3] === "decision", "Last layer should be 'decision'");
});

// Test 8: Empty sources handled gracefully
test("Empty sources handled gracefully", async () => {
  const result = await disc.rank([]);
  assert(result.ranked.length === 0, "Should return empty ranked list");
  assert(result.cost_efficiency === 0, "CE should be 0 for empty input");
});

// Run tests
async function run() {
  console.log("\n=== DISC Validation Tests ===\n");
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
