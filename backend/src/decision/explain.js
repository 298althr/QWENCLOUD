// backend/src/decision/explain.js
// Explainability Layer — Phase 6 of track4-v4 plan.
// Every score output includes decomposable `reasoning` field.

/**
 * Generate explainability breakdown for a decision output.
 *
 * @param {object} params
 * @param {array} params.drivers - [{ factor, weight, value, contribution }]
 * @param {string} [params.would_change] - What input change would flip the result
 * @param {string[]} [params.missing_evidence] - What data is absent
 * @param {number} [params.confidence] - Calibrated confidence
 * @param {object} [params.calibration] - { ece, n_predictions }
 * @returns {object} Explainability breakdown
 */
function explain({ drivers, would_change, missing_evidence, confidence, calibration }) {
  return {
    drivers: (drivers || []).map((d) => ({
      factor: d.factor,
      weight: Math.round((d.weight || 0) * 1000) / 1000,
      value: Math.round((d.value || 0) * 1000) / 1000,
      contribution: Math.round((d.contribution || 0) * 1000) / 1000,
    })),
    would_change: would_change || null,
    missing_evidence: missing_evidence || [],
    confidence: confidence != null ? Math.round(confidence * 1000) / 1000 : null,
    calibration: calibration || null,
  };
}

/**
 * Generate explainability for a DRE research result.
 */
function explainDRE(dreResult) {
  const drivers = [];
  for (const source of (dreResult.sources || [])) {
    if (source.credibility) {
      drivers.push({
        factor: `source:${source.source}`,
        weight: source.credibility.relevance / 5,
        value: source.similarity || 0.5,
        contribution: (source.credibility.relevance / 5) * (source.similarity || 0.5),
      });
    }
  }
  return explain({
    drivers,
    would_change: dreResult.contradiction_score > 0.1
      ? "If contradictory evidence were resolved, confidence would increase by ~15%"
      : "If more evidence sources were available, coverage would improve",
    missing_evidence: dreResult.coverage && dreResult.coverage.coverage < 0.9
      ? [`Coverage is ${dreResult.coverage.coverage} — ${dreResult.coverage.total - dreResult.coverage.answered} subquestions unanswered`]
      : [],
    confidence: dreResult.candidates?.[0]?.confidence,
    calibration: null,
  });
}

/**
 * Generate explainability for a DREV verification result.
 */
function explainDREV(drevResult) {
  const drivers = [];
  for (const candidate of (drevResult.ranked || [])) {
    drivers.push({
      factor: `approach:${candidate.approach}`,
      weight: candidate.priority,
      value: candidate.confidence || 0.5,
      contribution: candidate.priority * (candidate.confidence || 0.5),
    });
  }
  return explain({
    drivers,
    would_change: drevResult.cr > 0.1
      ? "If comparison matrix were repaired, winner might change"
      : `If ${drevResult.reserve?.approach || "reserve"} had ${((drevResult.winner?.priority || 0) - (drevResult.reserve?.priority || 0) + 0.01).toFixed(3)} more priority, it would win`,
    missing_evidence: drevResult.robustness < 0.9
      ? [`Robustness is ${drevResult.robustness} — winner changes under stress perturbation`]
      : [],
    confidence: drevResult.winner?.confidence,
    calibration: { ece: null, n_predictions: drevResult.cost_log?.comparisons || 0 },
  });
}

/**
 * Generate explainability for a CRDS reaction score.
 */
function explainCRDS(crdsResult) {
  const drivers = [];
  for (const [key, dim] of Object.entries(crdsResult.dimensions || {})) {
    drivers.push({
      factor: key,
      weight: crdsResult.weights?.[key] || 0,
      value: dim.value,
      contribution: dim.value * (crdsResult.weights?.[key] || 0),
    });
  }
  return explain({
    drivers,
    would_change: `If cascading_failure probability were < 0.3, RRS would shift from ${crdsResult.rrs} to ~${Math.round(crdsResult.rrs * 0.7)}`,
    missing_evidence: crdsResult.uncertainty > 0.3
      ? [`Uncertainty is ${crdsResult.uncertainty} — some server metrics unavailable`]
      : [],
    confidence: (crdsResult.rrs + 100) / 200,
    calibration: crdsResult.calibration,
  });
}

module.exports = {
  explain,
  explainDRE,
  explainDREV,
  explainCRDS,
};
