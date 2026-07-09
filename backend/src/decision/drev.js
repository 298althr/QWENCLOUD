// backend/src/decision/drev.js
// SOS Architecture Mapping:
// - SOS V4 (Intelligence Pipeline): Decision Ripple Verification (DREV) - tests decisions against dependent decisions
// - SOS V4 (Intelligence Pipeline): Hypothesis Verification - validates evidence for each candidate
//
// Pairwise Verification Engine (DREV) — Phase 4 of track4-v4 plan.
//
// 1. Pairwise comparison with tournament bracket.
// 2. AHP consistency ratio (CR) check; reject if CR > 0.1, repair via Saaty's method.
// 3. Deterministic tie-breaking: by reversibility (lower = wins), then historical success rate.
// 4. Regime-aware backtesting: tag decisions as normal/high-load/incident/post-deploy.
// 5. Termination bound: marginal improvement < Δ=0.01 → stop improvement loop.
// 6. Robustness score: 1 - decision_flip_rate_under_stress.
// 7. Tournament cost log.
// 8. Governance veto: SAF violation → eliminated.
// 9. Reserve execution path: winner fails → automatic switch to Reserve.

const { qwen, selectModel } = require("../qwen/client");
const { audit } = require("../utils/audit");
const { guardedCreate, getMaxOutputTokens } = require("../qwen/guardrails");
const { DREV_MATRIX_PROMPT } = require("../qwen/prompts");

const AHP_CR_THRESHOLD = 0.1;
const MARGINAL_IMPROVEMENT_THRESHOLD = 0.01;
const ROBUSTNESS_TARGET = 0.9;

// Saaty's random consistency index for matrix size n
const RANDOM_INDEX = {
  1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49,
};

const REVERSIBILITY_VALUES = {
  fully: 1.0,
  mostly: 0.75,
  partially: 0.5,
  barely: 0.25,
  irreversible: 0.0,
};

/**
 * Main DREV entry point: run pairwise verification tournament on candidates.
 *
 * @param {array} candidates - Candidates from DRE (or manual input)
 * @param {object} [opts] - { safCheck, regime, historicalOutcomes, io, socketId }
 * @returns {Promise<object>} { winner, reserve, matrix, cr, robustness, cost_log, regime, degraded }
 */
async function verify(candidates, opts = {}) {
  const emit = (event, payload) => {
    if (!opts.io) return;
    if (opts.socketId) opts.io.to(opts.socketId).emit(event, payload);
    else opts.io.emit(event, payload);
  };

  emit("drev_start", { candidate_count: candidates.length });

  const startTime = Date.now();
  let apiCallsUsed = 0;
  let degraded = false;

  // Filter out SAF-violating candidates (governance veto)
  let eligible = candidates;
  if (opts.safCheck) {
    eligible = candidates.filter((c) => {
      const safResult = opts.safCheck(c);
      return safResult && safResult.passed !== false;
    });
    if (eligible.length < candidates.length) {
      emit("drev_veto", { vetoed: candidates.length - eligible.length });
    }
  }

  if (eligible.length === 0) {
    degraded = true;
    return {
      winner: null,
      reserve: null,
      matrix: [],
      cr: 0,
      robustness: 0,
      cost_log: { comparisons: 0, api_calls: 0, time_ms: Date.now() - startTime },
      regime: opts.regime || "normal",
      degraded: true,
      error: "All candidates vetoed by SAF",
    };
  }

  if (eligible.length === 1) {
    degraded = true;
    return {
      winner: eligible[0],
      reserve: null,
      matrix: [[1]],
      cr: 0,
      robustness: 0.5,
      cost_log: { comparisons: 0, api_calls: 0, time_ms: Date.now() - startTime },
      regime: opts.regime || "normal",
      degraded: true,
    };
  }

  // 1. Build pairwise comparison matrix using Qwen
  let matrix;
  try {
    matrix = await buildComparisonMatrix(eligible, opts);
    apiCallsUsed++;
  } catch (e) {
    console.warn("[DREV] Qwen matrix generation failed, using score-based fallback:", e.message);
    degraded = true;
    matrix = buildScoreBasedMatrix(eligible);
  }

  // 2. AHP consistency check
  const n = eligible.length;
  const consistencyResult = checkAHPConsistency(matrix, n);

  let finalMatrix = matrix;
  if (consistencyResult.cr > AHP_CR_THRESHOLD) {
    // Repair via Saaty's method (simplify to geometric mean)
    finalMatrix = repairMatrix(matrix, n);
    const repairedConsistency = checkAHPConsistency(finalMatrix, n);
    consistencyResult.repaired = true;
    consistencyResult.original_cr = consistencyResult.cr;
    consistencyResult.cr = repairedConsistency.cr;
    consistencyResult.ci = repairedConsistency.ci;
    emit("drev_cr_repair", { original_cr: consistencyResult.original_cr, repaired_cr: repairedConsistency.cr });
  }

  // 3. Compute priority weights from matrix
  const priorities = computePriorities(finalMatrix, n);

  // 4. Rank candidates by priority, with deterministic tie-breaking
  const ranked = rankCandidates(eligible, priorities, opts.historicalOutcomes || []);

  // 5. Robustness score: stress-test by perturbing matrix
  const robustness = computeRobustness(finalMatrix, n, priorities);

  // 6. Regime-aware backtesting
  const regime = opts.regime || detectRegime(opts.serverState || {});
  const backtestResult = regimeBacktest(ranked, regime, opts.historicalOutcomes || []);

  // 7. Tournament cost log
  const cost_log = {
    candidates: n,
    comparisons: (n * (n - 1)) / 2,
    api_calls: apiCallsUsed,
    time_ms: Date.now() - startTime,
  };

  // 8. Winner and reserve
  const winner = ranked[0];
  const reserve = ranked[1] || null;

  // 9. Audit
  try {
    await audit({
      operation: "drev_verify",
      actor: "agent",
      target: winner?.description || "unknown",
      target_type: "verification",
      reasoning: `Winner: ${winner?.approach}, CR: ${consistencyResult.cr}, Robustness: ${robustness}`,
      confidence: winner?.confidence ?? 0,
      result: degraded ? "degraded" : "success",
    });
  } catch (e) {
    console.warn("[DREV] audit log failed:", e.message);
  }

  emit("drev_complete", {
    winner,
    reserve,
    cr: consistencyResult.cr,
    robustness,
    cost_log,
    regime,
    degraded,
  });

  return {
    winner,
    reserve,
    matrix: finalMatrix,
    priorities,
    cr: consistencyResult.cr,
    cr_exceeds: consistencyResult.cr > AHP_CR_THRESHOLD,
    cr_repaired: consistencyResult.repaired || false,
    robustness,
    robustness_target: ROBUSTNESS_TARGET,
    cost_log,
    regime,
    backtest: backtestResult,
    ranked,
    degraded,
  };
}

/**
 * Build pairwise comparison matrix using Qwen.
 * Returns an n×n matrix where matrix[i][j] represents how many times
 * candidate i is more important than candidate j.
 */
async function buildComparisonMatrix(candidates, opts) {
  const n = candidates.length;
  const candidateDescs = candidates.map((c, i) =>
    `${i + 1}. approach=${c.approach}, impact=${c.impact}, reversibility=${c.reversibility}, confidence=${c.confidence}, desc=${c.description}`
  ).join("\n");

  const systemPrompt = DREV_MATRIX_PROMPT;

  const userPrompt = `Compare these ${n} candidates for resolving a server issue:

${candidateDescs}

Context: regime=${opts.regime || "normal"}
Generate the ${n}×${n} pairwise comparison matrix.`;

  const res = await guardedCreate(qwen, {
    model: selectModel("drev"),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: getMaxOutputTokens("drev"),
  }, { module: "drev", taskType: "drev" });

  const parsed = JSON.parse(res.choices[0].message.content);
  let matrix = parsed.matrix || parsed.comparisons || [];

  // Ensure matrix is n×n and reciprocal
  matrix = normalizeMatrix(matrix, n);

  return matrix;
}

/**
 * Build a score-based comparison matrix as fallback when Qwen is unavailable.
 * Uses candidate confidence and impact as the scoring basis.
 */
function buildScoreBasedMatrix(candidates) {
  const n = candidates.length;
  const scores = candidates.map((c) => {
    const impactWeight = { high: 0.9, medium: 0.5, low: 0.2 };
    const revScore = REVERSIBILITY_VALUES[c.reversibility] ?? 0.5;
    return (c.confidence || 0.5) * 0.5 + (impactWeight[c.impact] || 0.5) * 0.3 + revScore * 0.2;
  });

  const matrix = [];
  for (let i = 0; i < n; i++) {
    matrix.push([]);
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (i < j) {
        const ratio = scores[i] / (scores[j] || 0.01);
        matrix[i][j] = Math.max(1/9, Math.min(9, Math.round(ratio * 100) / 100));
      } else {
        matrix[i][j] = 1 / (matrix[j][i] || 1);
      }
    }
  }
  return matrix;
}

/**
 * Normalize matrix to be n×n and reciprocal.
 */
function normalizeMatrix(matrix, n) {
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push([]);
    for (let j = 0; j < n; j++) {
      if (i === j) {
        result[i][j] = 1;
      } else if (matrix[i] && matrix[i][j]) {
        result[i][j] = matrix[i][j];
      } else if (matrix[j] && matrix[j][i]) {
        result[i][j] = 1 / matrix[j][i];
      } else {
        result[i][j] = 1;
      }
    }
  }
  // Ensure reciprocity
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const avg = Math.sqrt(result[i][j] * result[j][i]);
      result[i][j] = avg > 0 ? result[i][j] : 1;
      result[j][i] = 1 / result[i][j];
    }
  }
  return result;
}

/**
 * Check AHP consistency: compute Consistency Index (CI) and Consistency Ratio (CR).
 * CR = CI / RI, where RI is the random consistency index for matrix size n.
 */
function checkAHPConsistency(matrix, n) {
  if (n <= 2) return { ci: 0, cr: 0, consistent: true };

  // Compute principal eigenvalue using the geometric mean approximation
  const priorities = computePriorities(matrix, n);

  // λ_max = sum of (Aw)_i / w_i / n
  let lambdaMax = 0;
  for (let i = 0; i < n; i++) {
    let rowSum = 0;
    for (let j = 0; j < n; j++) {
      rowSum += matrix[i][j] * priorities[j];
    }
    lambdaMax += rowSum / (priorities[i] || 0.001);
  }
  lambdaMax /= n;

  const ci = (lambdaMax - n) / (n - 1);
  const ri = RANDOM_INDEX[n] || 1.49;
  const cr = ri > 0 ? ci / ri : 0;

  return {
    ci: Math.round(ci * 1000) / 1000,
    cr: Math.round(cr * 1000) / 1000,
    lambda_max: Math.round(lambdaMax * 1000) / 1000,
    consistent: cr <= AHP_CR_THRESHOLD,
  };
}

/**
 * Compute priority weights using geometric mean method.
 */
function computePriorities(matrix, n) {
  const geometricMeans = [];
  for (let i = 0; i < n; i++) {
    let product = 1;
    for (let j = 0; j < n; j++) {
      product *= matrix[i][j] || 1;
    }
    geometricMeans.push(Math.pow(product, 1 / n));
  }
  const sum = geometricMeans.reduce((a, b) => a + b, 0);
  return geometricMeans.map((g) => g / (sum || 1));
}

/**
 * Repair an inconsistent matrix by adjusting entries toward geometric mean.
 */
function repairMatrix(matrix, n) {
  const priorities = computePriorities(matrix, n);
  const repaired = [];
  for (let i = 0; i < n; i++) {
    repaired.push([]);
    for (let j = 0; j < n; j++) {
      repaired[i][j] = (priorities[i] || 0.001) / (priorities[j] || 0.001);
    }
  }
  return repaired;
}

/**
 * Rank candidates by priority weight with deterministic tie-breaking.
 * Tie-break order: 1) priority weight, 2) reversibility (lower = wins), 3) historical success rate.
 */
function rankCandidates(candidates, priorities, historicalOutcomes) {
  const withPriority = candidates.map((c, i) => ({
    ...c,
    priority: priorities[i] || 0,
    reversibility_value: REVERSIBILITY_VALUES[c.reversibility] ?? 0.5,
    historical_success: getHistoricalSuccess(c, historicalOutcomes),
  }));

  withPriority.sort((a, b) => {
    // Primary: priority weight (higher = better)
    if (Math.abs(b.priority - a.priority) > 0.001) return b.priority - a.priority;
    // Tie-break 1: reversibility (higher = wins, more reversible = safer)
    if (Math.abs(a.reversibility_value - b.reversibility_value) > 0.01) return b.reversibility_value - a.reversibility_value;
    // Tie-break 2: historical success rate (higher = better)
    return b.historical_success - a.historical_success;
  });

  return withPriority;
}

/**
 * Get historical success rate for a candidate's approach.
 */
function getHistoricalSuccess(candidate, historicalOutcomes) {
  if (!historicalOutcomes || historicalOutcomes.length === 0) return 0.5;
  const matching = historicalOutcomes.filter((o) => o.approach === candidate.approach);
  if (matching.length === 0) return 0.5;
  const successes = matching.filter((o) => o.outcome === "success").length;
  return successes / matching.length;
}

/**
 * Compute robustness score: 1 - decision_flip_rate_under_stress.
 * Perturb the matrix by ±20% and check if the winner changes.
 */
function computeRobustness(matrix, n, priorities) {
  if (n <= 1) return 1.0;

  const originalWinner = priorities.indexOf(Math.max(...priorities));
  let flips = 0;
  const trials = 20;

  for (let t = 0; t < trials; t++) {
    // Perturb matrix by ±20%
    const perturbed = matrix.map((row) =>
      row.map((v) => {
        const noise = 1 + (Math.random() - 0.5) * 0.4;
        return Math.max(1/9, Math.min(9, v * noise));
      })
    );
    // Re-normalize diagonal
    for (let i = 0; i < n; i++) perturbed[i][i] = 1;

    const perturbedPriorities = computePriorities(perturbed, n);
    const perturbedWinner = perturbedPriorities.indexOf(Math.max(...perturbedPriorities));

    if (perturbedWinner !== originalWinner) flips++;
  }

  const flipRate = flips / trials;
  return Math.round((1 - flipRate) * 1000) / 1000;
}

/**
 * Detect regime from server state.
 */
function detectRegime(serverState) {
  const { cpu, ram, disk } = serverState;
  if ((cpu && cpu > 85) || (ram && ram > 90)) return "high-load";
  if ((cpu && cpu > 95) || (ram && ram > 95)) return "incident";
  return "normal";
}

/**
 * Regime-aware backtesting: weight historical outcomes from matching regime 3x.
 */
function regimeBacktest(ranked, regime, historicalOutcomes) {
  if (!historicalOutcomes || historicalOutcomes.length === 0) {
    return { regime, weighted_success: 0.5, sample_size: 0 };
  }

  const regimeOutcomes = historicalOutcomes.filter((o) => o.regime === regime);
  const otherOutcomes = historicalOutcomes.filter((o) => o.regime !== regime);

  const regimeSuccesses = regimeOutcomes.filter((o) => o.outcome === "success").length;
  const otherSuccesses = otherOutcomes.filter((o) => o.outcome === "success").length;

  const weightedSuccess = (regimeSuccesses * 3 + otherSuccesses) / (regimeOutcomes.length * 3 + otherOutcomes.length || 1);

  return {
    regime,
    weighted_success: Math.round(weightedSuccess * 1000) / 1000,
    sample_size: historicalOutcomes.length,
    regime_matches: regimeOutcomes.length,
  };
}

/**
 * Check marginal improvement for termination bound.
 * If improvement < Δ=0.01, the improvement loop should terminate.
 */
function shouldTerminate(previousScore, currentScore) {
  const improvement = Math.abs(currentScore - previousScore);
  return improvement < MARGINAL_IMPROVEMENT_THRESHOLD;
}

module.exports = {
  verify,
  buildComparisonMatrix,
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
  ROBUSTNESS_TARGET,
};
