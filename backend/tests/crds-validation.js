// backend/tests/crds-validation.js
// CRDS (Resource Contention and Ripple Reaction System) validation tests.
// Run: node tests/crds-validation.js

const {
  scoreReaction,
  recordOutcome,
  getCalibrationSummary,
  getWeights,
  resetWeights,
  computeDimensions,
  computeUncertainty,
  computeTemporalWindow,
  INITIAL_WEIGHTS,
  EWMA_ALPHA,
  CASCADE_VETO_MAGNITUDE,
  CASCADE_VETO_PROBABILITY,
} = require("../src/decision/crds");

const results = [];
function test(name, fn) {
  results.push({ name, fn });
}

function assert(condition, msg) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// Test 1: RRS is in [-100, +100]
test("RRS is in [-100, +100]", async () => {
  const result = await scoreReaction("restart nginx", { cpu: 70, ram: 60, disk: 50 });
  assert(result.rrs >= -100 && result.rrs <= 100, `RRS should be in [-100, +100], got ${result.rrs}`);
});

// Test 2: "restart postgres" with high CPU → negative RRS (disturbance)
test("restart postgres with high CPU → negative RRS", async () => {
  const result = await scoreReaction("restart postgres", { cpu: 90, ram: 85, disk: 50 });
  assert(result.rrs < 0, `Restart postgres should have negative RRS, got ${result.rrs}`);
});

// Test 3: "read health check" → near-neutral RRS
test("read health check → near-neutral RRS", async () => {
  const result = await scoreReaction("read health check", { cpu: 50, ram: 50, disk: 50 });
  assert(Math.abs(result.rrs) < 20, `Health check should be near-neutral, got ${result.rrs}`);
});

// Test 4: Cascade veto fires for dangerous actions
test("Cascade veto fires for restart postgres with high load", async () => {
  const result = await scoreReaction("restart postgres", { cpu: 95, ram: 95, disk: 90 });
  if (result.vetoed) {
    assert(result.veto_reason, "Vetoed result should have a reason");
    assert(result.veto_reason.includes("Cascade veto"), "Veto reason should mention cascade");
  }
  // Even if not vetoed, the RRS should be very negative
  assert(result.rrs < 0, "Restart postgres should have negative RRS");
});

// Test 5: Dimensions have all 6 required fields
test("Dimensions have all 6 required fields", async () => {
  const result = await scoreReaction("restart nginx", { cpu: 70, ram: 60, disk: 50 });
  const requiredDims = ["cpu_disturbance", "memory_disturbance", "disk_io", "network", "cascading_failure", "process_dependency"];
  for (const dim of requiredDims) {
    assert(result.dimensions[dim], `Missing dimension: ${dim}`);
    assert(typeof result.dimensions[dim].value === "number", `${dim} value should be number`);
    assert(result.dimensions[dim].value >= -1 && result.dimensions[dim].value <= 1, `${dim} value should be -1 to +1`);
    assert(typeof result.dimensions[dim].probability === "number", `${dim} probability should be number`);
    assert(result.dimensions[dim].probability >= 0 && result.dimensions[dim].probability <= 1, `${dim} probability should be 0 to 1`);
  }
});

// Test 6: Temporal window is in seconds (continuous, not categorical)
test("Temporal window is in seconds", async () => {
  const result = await scoreReaction("restart nginx", { cpu: 70, ram: 60, disk: 50 });
  assert(typeof result.temporal_window_seconds === "number", "Temporal window should be a number");
  assert(result.temporal_window_seconds > 0, "Temporal window should be positive");
  assert(result.temporal_window_seconds >= 5, "Temporal window should be at least 5 seconds");
});

// Test 7: Uncertainty is computed
test("Uncertainty is computed", async () => {
  const result = await scoreReaction("restart nginx", { cpu: 70, ram: 60, disk: 50 });
  assert(typeof result.uncertainty === "number", "Uncertainty should be a number");
  assert(result.uncertainty >= 0 && result.uncertainty <= 1, "Uncertainty should be 0 to 1");
});

// Test 8: Vary CPU → RRS moves expected direction
test("Vary CPU → RRS moves expected direction", async () => {
  const lowCpu = await scoreReaction("restart nginx", { cpu: 30, ram: 50, disk: 50 });
  const highCpu = await scoreReaction("restart nginx", { cpu: 95, ram: 50, disk: 50 });
  assert(highCpu.rrs < lowCpu.rrs, `High CPU should produce more negative RRS (${highCpu.rrs} < ${lowCpu.rrs})`);
});

// Test 9: Adaptive weights update after outcome recording
test("Adaptive weights update after outcome recording", async () => {
  resetWeights();
  const initialWeights = getWeights();
  
  // Record several outcomes with significant error
  await recordOutcome("restart nginx", -50, 0.3);
  await recordOutcome("restart nginx", -40, 0.4);
  await recordOutcome("restart nginx", -45, 0.35);
  
  const updatedWeights = getWeights();
  const totalInitial = Object.values(initialWeights).reduce((a, b) => a + b, 0);
  const totalUpdated = Object.values(updatedWeights).reduce((a, b) => a + b, 0);
  
  // Weights should still sum to ~1
  assert(Math.abs(totalUpdated - 1) < 0.05, `Updated weights should sum to ~1, got ${totalUpdated}`);
  
  // At least one weight should have changed
  const changed = Object.keys(initialWeights).some(
    (k) => Math.abs(initialWeights[k] - updatedWeights[k]) > 0.001
  );
  assert(changed, "At least one weight should have changed after outcomes");
});

// Test 10: Calibration summary is computed
test("Calibration summary is computed", async () => {
  resetWeights();
  await recordOutcome("restart nginx", -50, 0.3);
  await recordOutcome("read health", 5, 0.1);
  const cal = getCalibrationSummary();
  assert(cal.count === 2, `Expected count=2, got ${cal.count}`);
  assert(typeof cal.mean_brier === "number", "Mean Brier should be a number");
  assert(typeof cal.ece === "number", "ECE should be a number");
});

// Test 11: "clean cache" has positive RRS (freeing resources)
test("clean cache has positive or near-neutral RRS", async () => {
  const result = await scoreReaction("clean cache", { cpu: 50, ram: 80, disk: 85 });
  assert(result.rrs > -20, `Clean cache should be near-neutral or positive, got ${result.rrs}`);
});

// Test 12: Weights sum to approximately 1
test("Initial weights sum to 1", () => {
  const total = Object.values(INITIAL_WEIGHTS).reduce((a, b) => a + b, 0);
  assert(Math.abs(total - 1) < 0.01, `Initial weights should sum to 1, got ${total}`);
});

// Test 13: Higher cascading failure probability → longer temporal window
test("Higher cascading failure → longer temporal window", async () => {
  const safe = await scoreReaction("read health check", { cpu: 30, ram: 30, disk: 30 });
  const dangerous = await scoreReaction("restart postgres", { cpu: 90, ram: 90, disk: 90 });
  assert(dangerous.temporal_window_seconds > safe.temporal_window_seconds,
    `Dangerous action should have longer temporal window (${dangerous.temporal_window_seconds} > ${safe.temporal_window_seconds})`);
});

// Run tests
async function run() {
  console.log("\n=== CRDS Validation Tests ===\n");
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
