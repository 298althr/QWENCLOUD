// backend/src/rca/cpt.js
// Conditional Probability Tables for Bayesian causal inference.
// Each entry: P(signal | mutation) and P(signal | no mutation).
// Likelihood Ratio = P(signal|mutation) / P(signal|no_mutation).
//
// These are seed values from the RCA spec, refined over time by
// recordSOPResult / M6 learning loop.

const CPTS = {
  ImageUpdate: {
    CrashLoopBackOff:   { pSignalGivenMutation: 0.75, pSignalGivenNoMutation: 0.03 },
    ErrorSpike:         { pSignalGivenMutation: 0.55, pSignalGivenNoMutation: 0.05 },
    HeartbeatLoss:      { pSignalGivenMutation: 0.60, pSignalGivenNoMutation: 0.04 },
  },
  ConfigChange: {
    ErrorSpike:         { pSignalGivenMutation: 0.60, pSignalGivenNoMutation: 0.05 },
    LatencyShift:       { pSignalGivenMutation: 0.45, pSignalGivenNoMutation: 0.06 },
    HTTP_500:           { pSignalGivenMutation: 0.60, pSignalGivenNoMutation: 0.05 },
    MemoryPressure:     { pSignalGivenMutation: 0.50, pSignalGivenNoMutation: 0.08 },
  },
  CertRotation: {
    TLSHandshakeFail:   { pSignalGivenMutation: 0.85, pSignalGivenNoMutation: 0.02 },
    ConnectionReset:    { pSignalGivenMutation: 0.50, pSignalGivenNoMutation: 0.05 },
  },
  ScaleEvent: {
    ConnectionRefused:  { pSignalGivenMutation: 0.40, pSignalGivenNoMutation: 0.08 },
    LatencyShift:       { pSignalGivenMutation: 0.35, pSignalGivenNoMutation: 0.06 },
  },
  PolicyChange: {
    AccessDenied:       { pSignalGivenMutation: 0.70, pSignalGivenNoMutation: 0.04 },
    ConnectionRefused:  { pSignalGivenMutation: 0.45, pSignalGivenNoMutation: 0.07 },
  },
  DNSUpdate: {
    NameResolutionFail: { pSignalGivenMutation: 0.80, pSignalGivenNoMutation: 0.01 },
    ConnectionRefused:  { pSignalGivenMutation: 0.40, pSignalGivenNoMutation: 0.06 },
  },
  ResourceExhaustion: {
    MemoryPressure:     { pSignalGivenMutation: 0.85, pSignalGivenNoMutation: 0.10 },
    ErrorSpike:         { pSignalGivenMutation: 0.50, pSignalGivenNoMutation: 0.08 },
    HeartbeatLoss:      { pSignalGivenMutation: 0.55, pSignalGivenNoMutation: 0.05 },
  },
  DependencyFailure: {
    ErrorSpike:         { pSignalGivenMutation: 0.65, pSignalGivenNoMutation: 0.07 },
    LatencyShift:       { pSignalGivenMutation: 0.55, pSignalGivenNoMutation: 0.06 },
    HeartbeatLoss:      { pSignalGivenMutation: 0.60, pSignalGivenNoMutation: 0.04 },
    ConnectionRefused:  { pSignalGivenMutation: 0.70, pSignalGivenNoMutation: 0.05 },
  },
};

// Temporal half-life per resource class (in minutes)
const HALF_LIVES = {
  Container: 15,
  DNS: 360,
  DenyPolicy: 43200, // 30 days
  Certificate: 1440, // 24 hours
  ConfigMap: 60,
  Secret: 30,
  Service: 15,
  Default: 30,
};

// Hop attenuation factor per dependency hop
const HOP_ATTENUATION = 0.92;

// Confidence threshold for governance approval
const CONFIDENCE_THRESHOLD = 0.60;

/**
 * Look up the likelihood ratio for a (mutation, signal) pair.
 * Returns { lr, pSignalGivenMutation, pSignalGivenNoMutation }.
 */
function lookupLR(mutationType, signalType) {
  const cpt = CPTS[mutationType];
  if (!cpt) return { lr: 1.0, pSignalGivenMutation: 0.1, pSignalGivenNoMutation: 0.1 };

  const entry = cpt[signalType] || cpt[Object.keys(cpt)[0]];
  if (!entry) return { lr: 1.0, pSignalGivenMutation: 0.1, pSignalGivenNoMutation: 0.1 };

  const lr = entry.pSignalGivenMutation / entry.pSignalGivenNoMutation;
  return { lr, ...entry };
}

/**
 * Compute temporal decay factor.
 * @param {number} minutesSinceMutation
 * @param {string} resourceClass
 * @returns {number} 0..1
 */
function temporalDecay(minutesSinceMutation, resourceClass) {
  const halfLife = HALF_LIVES[resourceClass] || HALF_LIVES.Default;
  return Math.pow(0.5, minutesSinceMutation / halfLife);
}

/**
 * Compute hop attenuation factor.
 * @param {number} hopCount
 * @returns {number} 0..1
 */
function hopAttenuation(hopCount) {
  return Math.pow(HOP_ATTENUATION, hopCount);
}

/**
 * Compute posterior probability from prior and likelihood ratio.
 * Uses the odds form of Bayes' theorem:
 *   prior_odds = prior / (1 - prior)
 *   posterior_odds = prior_odds * LR
 *   posterior = posterior_odds / (1 + posterior_odds)
 */
function computePosterior(prior, lr) {
  const clampedPrior = Math.min(Math.max(prior, 1e-6), 1 - 1e-6);
  const priorOdds = clampedPrior / (1 - clampedPrior);
  const posteriorOdds = priorOdds * lr;
  return posteriorOdds / (1 + posteriorOdds);
}

module.exports = {
  CPTS,
  HALF_LIVES,
  HOP_ATTENUATION,
  CONFIDENCE_THRESHOLD,
  lookupLR,
  temporalDecay,
  hopAttenuation,
  computePosterior,
};
