// backend/src/rca/calibration.js
// Calibration test runner for the RCA engine.
// Runs the 6 test scenarios from the RCA spec and validates results.

const rcaEngine = require("./rcaEngine");
const { buildTopology } = require("../utils/topology");
const { listAllContainers } = require("../utils/docker");

const TEST_SCENARIOS = [
  {
    id: "CLOUD-001",
    scenario: "Bad image tag causes CrashLoopBackOff",
    anomaly: {
      type: "container_crash",
      severity: "critical",
      message: "Container CrashLoopBackOff — exit code 137 (OOMKilled)",
      data: { service: "backend", containerId: null },
    },
    expectedRootCause: "ImageUpdate",
    minConfidence: 0.90,
  },
  {
    id: "CLOUD-002",
    scenario: "Cert rotation breaks TLS",
    anomaly: {
      type: "network_errors",
      severity: "critical",
      message: "TLS handshake failures detected on ingress",
      data: { service: "frontend" },
    },
    expectedRootCause: "CertRotation",
    minConfidence: 0.92,
  },
  {
    id: "CLOUD-003",
    scenario: "Config drift causes HTTP 500",
    anomaly: {
      type: "cpu_spike",
      severity: "warning",
      message: "HTTP 500 error rate spike — possible config drift",
      data: { service: "backend" },
    },
    expectedRootCause: "ConfigChange",
    minConfidence: 0.85,
  },
  {
    id: "CLOUD-004",
    scenario: "DNS misconfiguration causes resolution failure",
    anomaly: {
      type: "network_latency",
      severity: "critical",
      message: "DNS resolution failures — name resolution timeout",
      data: {},
    },
    expectedRootCause: "DNSUpdate",
    minConfidence: 0.88,
  },
  {
    id: "CLOUD-005",
    scenario: "Cascading failure from upstream service",
    anomaly: {
      type: "ram_pressure",
      severity: "critical",
      message: "Cascading failure — upstream service down causing memory pressure",
      data: { service: "backend" },
    },
    expectedRootCause: "DependencyFailure",
    minConfidence: 0.80,
  },
  {
    id: "CLOUD-006",
    scenario: "Cross-boundary: shared registry outage",
    anomaly: {
      type: "container_crash",
      severity: "critical",
      message: "Multiple pods crashing simultaneously — shared infrastructure failure",
      data: {},
    },
    expectedRootCause: "DependencyFailure",
    minConfidence: 0.75,
  },
];

/**
 * Run a single calibration test scenario.
 */
async function runTest(scenario, metrics, emitIo) {
  const result = await rcaEngine.analyze({
    anomaly: scenario.anomaly,
    metrics,
    emitIo,
  });

  const rootCause = result.causal_chain.find((c) => c.level === "root");
  const matchedType = rootCause?.mutationType === scenario.expectedRootCause;
  const metConfidence = result.confidence_score >= scenario.minConfidence;
  const chainComplete = result.causal_chain.length >= 2;

  return {
    test_id: scenario.id,
    scenario: scenario.scenario,
    expected_root_cause: scenario.expectedRootCause,
    actual_root_cause: rootCause?.mutationType || "unknown",
    actual_root_node: rootCause?.node || "unknown",
    expected_min_confidence: scenario.minConfidence,
    actual_confidence: result.confidence_score,
    matched_type: matchedType,
    met_confidence: metConfidence,
    chain_complete: chainComplete,
    passed: matchedType && metConfidence && chainComplete,
    blast_radius: result.blast_radius,
    analysis_time_ms: result.analysis_time_ms,
    governance_status: result.governance_status,
  };
}

/**
 * Run all calibration test scenarios.
 */
async function runAllTests({ metrics, emitIo } = {}) {
  const defaultMetrics = metrics || { cpu: 45, ram: 60, disk: 50 };
  const results = [];

  for (const scenario of TEST_SCENARIOS) {
    try {
      const testResult = await runTest(scenario, defaultMetrics, emitIo);
      results.push(testResult);
    } catch (e) {
      results.push({
        test_id: scenario.id,
        scenario: scenario.scenario,
        passed: false,
        error: e.message,
      });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const avgConfidence = results
    .filter((r) => r.actual_confidence !== undefined)
    .reduce((sum, r) => sum + r.actual_confidence, 0) / (results.filter((r) => r.actual_confidence !== undefined).length || 1);
  const avgTime = results
    .filter((r) => r.analysis_time_ms !== undefined)
    .reduce((sum, r) => sum + r.analysis_time_ms, 0) / (results.filter((r) => r.analysis_time_ms !== undefined).length || 1);

  return {
    summary: {
      total,
      passed,
      failed: total - passed,
      pass_rate: `${((passed / total) * 100).toFixed(1)}%`,
      avg_confidence: Number(avgConfidence.toFixed(4)),
      avg_analysis_time_ms: Math.round(avgTime),
      exact_match_rate: `${((results.filter((r) => r.matched_type).length / total) * 100).toFixed(1)}%`,
      false_positive_rate: `${((results.filter((r) => !r.matched_type).length / total) * 100).toFixed(1)}%`,
    },
    success_criteria: {
      exact_match_target: "70% on CLOUD-001 through CLOUD-004",
      confidence_target: 0.85,
      mttd_target_ms: 60000,
      false_positive_target: "< 5%",
      chain_completeness_target: "3+ nodes for 90% of incidents",
    },
    results,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  TEST_SCENARIOS,
  runTest,
  runAllTests,
};
