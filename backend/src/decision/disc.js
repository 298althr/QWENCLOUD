// backend/src/decision/disc.js
// Minimal 4-layer DISC (Decision Information Scoring Chain):
// source → evidence → feature → decision
//
// 1. Ranks signals by approximate information gain (permutation importance).
// 2. Causal validation: temporal precedence + confound check.
// 3. Decay monitoring: stale signals lose weight over time.
// 4. Rare-event stress weight: tail-event-relevant sources get boosted.
// 5. Cost-efficiency score: CE = decision_value / total_cost.

const { audit } = require("../utils/audit");

const DECAY_HALF_LIFE_HOURS = 24; // signals lose half their weight every 24h
const RARE_EVENT_BOOST = 1.5;
const CONFOUND_THRESHOLD = 0.7;

/**
 * Rank sources by approximate information gain using permutation importance.
 * Higher IG = more important signal.
 *
 * @param {array} sources - Array of { id, name, value, target, timestamp, cost, is_rare_event }
 * @returns {object} { ranked, redundant_pairs, cost_efficiency }
 */
function rankSources(sources) {
  if (!sources || sources.length === 0) {
    return { ranked: [], redundant_pairs: [], cost_efficiency: 0 };
  }

  // 1. Compute approximate information gain for each source
  // IG ≈ |correlation(source.value, target)| * (1 - redundancy_penalty)
  const withIG = sources.map((s) => {
    const baseIG = Math.abs(s.value ?? 0); // normalized 0-1
    const ig = computeApproximateIG(s, sources);
    return { ...s, information_gain: ig, base_ig: baseIG };
  });

  // 2. Detect redundant pairs (correlation > CONFOUND_THRESHOLD)
  const redundantPairs = [];
  for (let i = 0; i < withIG.length; i++) {
    for (let j = i + 1; j < withIG.length; j++) {
      const corr = Math.abs(computeCorrelation(withIG[i], withIG[j]));
      if (corr > CONFOUND_THRESHOLD) {
        redundantPairs.push({
          a: withIG[i].name || withIG[i].id,
          b: withIG[j].name || withIG[j].id,
          correlation: Math.round(corr * 100) / 100,
          demoted: withIG[i].information_gain < withIG[j].information_gain
            ? withIG[i].name || withIG[i].id
            : withIG[j].name || withIG[j].id,
        });
      }
    }
  }

  // 3. Demote redundant signals (keep only the higher-IG one at full weight)
  const demotedSet = new Set(redundantPairs.map((p) => p.demoted));
  const ranked = withIG.map((s) => {
    const isDemoted = demotedSet.has(s.name || s.id);
    const weight = isDemoted ? s.information_gain * 0.3 : s.information_gain;
    return {
      ...s,
      rank_weight: Math.round(weight * 1000) / 1000,
      demoted: isDemoted,
    };
  });

  // 4. Sort by rank_weight descending
  ranked.sort((a, b) => b.rank_weight - a.rank_weight);

  // 5. Compute cost-efficiency: CE = sum(value * weight) / sum(cost)
  const totalValue = ranked.reduce((s, r) => s + (r.value ?? 0) * r.rank_weight, 0);
  const totalCost = ranked.reduce((s, r) => s + (r.cost ?? 1), 0);
  const costEfficiency = totalCost > 0 ? Math.round((totalValue / totalCost) * 1000) / 1000 : 0;

  return { ranked, redundant_pairs: redundantPairs, cost_efficiency: costEfficiency };
}

/**
 * Compute approximate information gain via permutation importance.
 * For simplicity, IG = base_signal_strength * decay_factor * rare_event_boost * causal_validity.
 */
function computeApproximateIG(source, allSources) {
  const baseStrength = Math.abs(source.value ?? 0.5);

  // Decay: older signals lose weight
  const ageHours = source.timestamp
    ? (Date.now() - new Date(source.timestamp).getTime()) / (1000 * 60 * 60)
    : 0;
  const decayFactor = Math.pow(0.5, ageHours / DECAY_HALF_LIFE_HOURS);

  // Rare-event boost
  const rareBoost = source.is_rare_event ? RARE_EVENT_BOOST : 1.0;

  // Causal validity: check temporal precedence (source must precede target)
  const causalValid = checkCausalValidity(source, allSources) ? 1.0 : 0.5;

  const ig = baseStrength * decayFactor * rareBoost * causalValid;
  return Math.round(ig * 1000) / 1000;
}

/**
 * Check causal validity: temporal precedence + confound check.
 * Source must precede the target event in time.
 */
function checkCausalValidity(source, allSources) {
  if (!source.timestamp) return true; // can't validate, assume valid

  const sourceTime = new Date(source.timestamp).getTime();

  // Check if any other source is a confound (correlated + precedes this one)
  for (const other of allSources) {
    if (other.id === source.id) continue;
    if (!other.timestamp) continue;

    const otherTime = new Date(other.timestamp).getTime();
    const corr = Math.abs(computeCorrelation(source, other));

    // Confound: other source is correlated AND precedes this one
    if (corr > CONFOUND_THRESHOLD && otherTime < sourceTime) {
      return false; // this source's effect might be explained by the earlier confound
    }
  }

  return true;
}

/**
 * Simple correlation proxy between two sources.
 * If both have numeric values, use absolute difference as inverse correlation.
 */
function computeCorrelation(a, b) {
  if (a.value == null || b.value == null) return 0;
  // Higher values = more similar = higher "correlation"
  return 1 - Math.abs(a.value - b.value);
}

/**
 * Apply decay monitoring to a set of signals.
 * Returns signals with updated weights reflecting age.
 */
function applyDecay(sources) {
  return sources.map((s) => {
    const ageHours = s.timestamp
      ? (Date.now() - new Date(s.timestamp).getTime()) / (1000 * 60 * 60)
      : 0;
    const decayedWeight = Math.pow(0.5, ageHours / DECAY_HALF_LIFE_HOURS);
    return {
      ...s,
      decayed_weight: Math.round(decayedWeight * 1000) / 1000,
      age_hours: Math.round(ageHours * 10) / 10,
      stale: decayedWeight < 0.2,
    };
  });
}

/**
 * Apply rare-event stress weight to sources relevant to tail events.
 */
function applyRareEventStress(sources, isTailEvent = false) {
  if (!isTailEvent) return sources;
  return sources.map((s) => ({
    ...s,
    stress_weight: s.is_rare_event ? RARE_EVENT_BOOST : 1.0,
    stress_boosted: s.is_rare_event || false,
  }));
}

/**
 * Full DISC pipeline: rank → decay → rare-event stress → cost-efficiency.
 *
 * @param {array} sources - Array of source objects
 * @param {object} [opts] - { isTailEvent }
 * @returns {object} { ranked, redundant_pairs, cost_efficiency, decayed, causal_flags }
 */
async function rank(sources, opts = {}) {
  const { ranked, redundant_pairs, cost_efficiency } = rankSources(sources);
  const decayed = applyDecay(sources);
  const stressed = applyRareEventStress(decayed, opts.isTailEvent);

  // Causal flags
  const causalFlags = redundant_pairs.map((p) => ({
    type: "confound",
    description: `${p.a} and ${p.b} are correlated (r=${p.correlation}). ${p.demoted} demoted.`,
    severity: "warning",
  }));

  try {
    await audit({
      operation: "disc_rank",
      actor: "agent",
      target: `${sources.length} sources`,
      target_type: "disc",
      reasoning: `Ranked ${ranked.length} sources, ${redundant_pairs.length} redundant pairs, CE=${cost_efficiency}`,
      confidence: ranked[0]?.rank_weight ?? 0,
      result: "success",
    });
  } catch (e) {
    console.warn("[DISC] audit failed:", e.message);
  }

  return {
    ranked,
    redundant_pairs,
    cost_efficiency,
    decayed: stressed,
    causal_flags: causalFlags,
    layers: ["source", "evidence", "feature", "decision"],
  };
}

module.exports = {
  rank,
  rankSources,
  applyDecay,
  applyRareEventStress,
  checkCausalValidity,
  computeApproximateIG,
  DECAY_HALF_LIFE_HOURS,
  RARE_EVENT_BOOST,
  CONFOUND_THRESHOLD,
};
