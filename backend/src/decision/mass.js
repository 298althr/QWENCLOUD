// backend/src/decision/mass.js
// Decision Mass calculation (DQS/DQL layer) for ALTHR Autopilot.
// Every decision is quantified by size, risk, complexity, and confidence modifier.
// The Decision Index (DI) determines authentication depth and monitoring intensity.

const DOMAIN_BASELINES = {
  default: {
    size: { financial: 0.3, operational: 0.4, stakeholder: 0.3 },
    risk: { uncertainty: 0.4, reversibility: 0.3, failure_impact: 0.3 },
    complexity: { dependencies: 0.4, execution: 0.4, time_sensitivity: 0.2 },
    confidence: { evidence: 0.4, model_agreement: 0.3, historical: 0.3 },
  },
  server_ops: {
    size: { financial: 0.2, operational: 0.5, stakeholder: 0.3 },
    risk: { uncertainty: 0.3, reversibility: 0.4, failure_impact: 0.3 },
    complexity: { dependencies: 0.5, execution: 0.3, time_sensitivity: 0.2 },
    confidence: { evidence: 0.5, model_agreement: 0.3, historical: 0.2 },
  },
  finance: {
    size: { financial: 0.6, operational: 0.2, stakeholder: 0.2 },
    risk: { uncertainty: 0.4, reversibility: 0.2, failure_impact: 0.4 },
    complexity: { dependencies: 0.3, execution: 0.3, time_sensitivity: 0.4 },
    confidence: { evidence: 0.4, model_agreement: 0.3, historical: 0.3 },
  },
};

const REVERSIBILITY_SCALE = {
  fully: 1.0,
  mostly: 0.75,
  partially: 0.5,
  barely: 0.25,
  irreversible: 0.0,
};

/**
 * Compute Decision Index (DI) for a candidate action.
 * @param {object} params
 * @param {object} params.size - { financial, operational, stakeholder } each 0-1
 * @param {object} params.risk - { uncertainty, failure_impact, reversibility } each 0-1 or a reversibility string
 * @param {object} params.complexity - { dependencies, execution, time_sensitivity } each 0-1
 * @param {object} params.confidence - { evidence, model_agreement, historical } each 0-1
 * @param {string} [params.domain="default"]
 * @returns {object} { size, risk, complexity, confidence_modifier, di, tier, auth_level }
 */
function calculateDecisionMass({ size, risk, complexity, confidence, domain = "default" }) {
  const baseline = DOMAIN_BASELINES[domain] || DOMAIN_BASELINES.default;

  const rev = typeof risk.reversibility === "string"
    ? REVERSIBILITY_SCALE[risk.reversibility] ?? 0.5
    : risk.reversibility;

  const sizeScore = weightedSum(size, baseline.size);
  const riskScore = weightedSum(
    { uncertainty: risk.uncertainty, reversibility: 1 - rev, failure_impact: risk.failure_impact },
    baseline.risk
  );
  const complexityScore = weightedSum(complexity, baseline.complexity);
  const confidenceScore = weightedSum(confidence, baseline.confidence);
  const confidenceModifier = 1 + (1 - confidenceScore); // lower confidence increases DI

  const di = sizeScore * riskScore * complexityScore * confidenceModifier;

  const { tier, auth_level } = classifyTier(di);

  return {
    size: round(sizeScore),
    risk: round(riskScore),
    complexity: round(complexityScore),
    confidence_modifier: round(confidenceModifier),
    di: round(di),
    tier,
    auth_level,
  };
}

function weightedSum(values, weights) {
  let sum = 0;
  let weightSum = 0;
  for (const key of Object.keys(weights)) {
    const v = values[key] ?? 0;
    const w = weights[key] ?? 0;
    sum += v * w;
    weightSum += w;
  }
  return weightSum === 0 ? 0 : sum / weightSum;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function classifyTier(di) {
  if (di < 0.2) return { tier: "small", auth_level: "automatic" };
  if (di < 0.5) return { tier: "medium", auth_level: "ai_plus_policy" };
  if (di < 1.0) return { tier: "large", auth_level: "ai_plus_second_model" };
  if (di < 2.0) return { tier: "critical", auth_level: "ai_plus_human" };
  return { tier: "mission_critical", auth_level: "multiple_validators" };
}

/**
 * Infer mass inputs from an ALTHR action plan and risk metadata.
 * @param {object} planStep
 * @param {number} confidence
 * @param {string} riskLevel
 * @param {string} [domain="server_ops"]
 */
function inferMassForAction(planStep, confidence, riskLevel, domain = "server_ops") {
  const tool = planStep?.name || "unknown";
  const command = planStep?.args?.command || "";

  const highImpactTools = ["execute_command", "docker_build", "git_clone", "write_file", "run_security_scan"];
  const irreversibleCommands = /rm -rf|drop|delete|kill|shutdown|reboot|mkfs/i;
  const dependencyTools = ["docker_build", "git_clone", "deploy"];

  const size = {
    financial: command.match(/\$|budget|cost|payment/i) ? 0.8 : 0.2,
    operational: highImpactTools.includes(tool) ? 0.8 : 0.3,
    stakeholder: command.match(/user|customer|production|live/i) ? 0.8 : 0.3,
  };

  const risk = {
    uncertainty: confidence < 0.7 ? 0.8 : confidence < 0.9 ? 0.5 : 0.2,
    failure_impact: riskLevel === "high" ? 0.9 : riskLevel === "medium" ? 0.5 : 0.2,
    reversibility: irreversibleCommands.test(command) ? "barely" : "mostly",
  };

  const complexity = {
    dependencies: dependencyTools.includes(tool) ? 0.8 : 0.3,
    execution: command.length > 50 ? 0.7 : 0.3,
    time_sensitivity: command.match(/urgent|now|immediate|timeout/i) ? 0.9 : 0.3,
  };

  const confidenceObj = {
    evidence: confidence,
    model_agreement: confidence,
    historical: confidence,
  };

  return calculateDecisionMass({ size, risk, complexity, confidence: confidenceObj, domain });
}

module.exports = {
  calculateDecisionMass,
  inferMassForAction,
  REVERSIBILITY_SCALE,
  DOMAIN_BASELINES,
};
