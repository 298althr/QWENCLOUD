// backend/src/decision/crds.js
// Resource Contention and Ripple Reaction System (CRDS) — Phase 5 of track4-v4 plan.
//
// 1. Score each candidate: CPU disturbance, memory disturbance, disk I/O, network,
//    cascading failure probability, process dependency impact.
// 2. Weighted aggregation → RRS normalized to [-100, +100].
// 3. Cascade veto: magnitude ≤ −0.8 AND probability ≥ 0.7 AND weight ≥ 20 → vetoed.
// 4. Adaptive weights: EWMA (α=0.3) update after every executed action.
// 5. Temporal dynamics: continuous time windows (seconds).
// 6. Residual-resource uncertainty term.
// 7. Brier score guidance for probability inputs.

const { audit } = require("../utils/audit");

const EWMA_ALPHA = 0.3;
const CASCADE_VETO_MAGNITUDE = -0.8;
const CASCADE_VETO_PROBABILITY = 0.7;
const CASCADE_VETO_WEIGHT = 20;

// Initial dimension weights (will be adapted via EWMA)
const INITIAL_WEIGHTS = {
  cpu_disturbance: 0.20,
  memory_disturbance: 0.18,
  disk_io: 0.15,
  network: 0.12,
  cascading_failure: 0.20,
  process_dependency: 0.15,
};

// In-memory adaptive weights (persisted to DB in production)
let adaptiveWeights = { ...INITIAL_WEIGHTS };

// Calibration history for Brier score
const calibrationHistory = [];

/**
 * Score a candidate action's resource reaction.
 *
 * @param {string} action - The action to score (e.g. "restart nginx")
 * @param {object} serverState - Current server metrics { cpu, ram, disk, network, processes }
 * @param {object} [opts] - { io, socketId }
 * @returns {Promise<object>} { rrs, dimensions, vetoed, veto_reason, temporal_window, uncertainty, calibration }
 */
async function scoreReaction(action, serverState = {}, opts = {}) {
  const emit = (event, payload) => {
    if (!opts.io) return;
    if (opts.socketId) opts.io.to(opts.socketId).emit(event, payload);
    else opts.io.emit(event, payload);
  };

  emit("crds_start", { action, serverState });

  // 1. Compute dimension scores (each -1 to +1, negative = disturbance)
  const dimensions = computeDimensions(action, serverState);

  // 2. Apply adaptive weights
  const weightedSum = Object.keys(dimensions).reduce((sum, key) => {
    const w = adaptiveWeights[key] || 0;
    return sum + dimensions[key].value * w;
  }, 0);

  // 3. Residual-resource uncertainty
  const uncertainty = computeUncertainty(serverState, dimensions);

  // 4. Normalize to [-100, +100]
  const rrs = Math.round(Math.max(-100, Math.min(100, weightedSum * 100 + uncertainty * 10)));

  // 5. Cascade veto check
  const cascade = dimensions.cascading_failure;
  const vetoed = cascade.value <= CASCADE_VETO_MAGNITUDE &&
                 cascade.probability >= CASCADE_VETO_PROBABILITY &&
                 Math.abs(rrs) >= CASCADE_VETO_WEIGHT;
  const veto_reason = vetoed
    ? `Cascade veto: magnitude=${cascade.value}, probability=${cascade.probability}, rrs=${rrs}`
    : null;

  // 6. Temporal dynamics (continuous time in seconds)
  const temporalWindow = computeTemporalWindow(action, dimensions);

  // 7. Calibration tracking
  const calibration = getCalibrationSummary();

  // 8. Audit
  try {
    await audit({
      operation: "crds_score",
      actor: "agent",
      target: action,
      target_type: "reaction_score",
      reasoning: `RRS=${rrs}, vetoed=${vetoed}, uncertainty=${uncertainty}`,
      confidence: (rrs + 100) / 200,
      result: vetoed ? "vetoed" : "scored",
    });
  } catch (e) {
    console.warn("[CRDS] audit log failed:", e.message);
  }

  const result = {
    action,
    rrs,
    dimensions,
    weights: { ...adaptiveWeights },
    vetoed,
    veto_reason,
    temporal_window_seconds: temporalWindow,
    uncertainty,
    calibration,
  };

  emit("crds_complete", result);
  return result;
}

/**
 * Compute dimension scores for an action.
 * Each dimension has: value (-1 to +1), probability (0-1), description.
 */
function computeDimensions(action, serverState) {
  const actionLower = action.toLowerCase();
  const cpu = serverState.cpu ?? 50;
  const ram = serverState.ram ?? 50;
  const disk = serverState.disk ?? 50;

  // CPU disturbance: restart/kill causes CPU spike, read-only is neutral
  let cpuDist = 0;
  let cpuProb = 0.3;
  if (/restart|reboot|kill|stop/i.test(actionLower)) {
    cpuDist = -0.6;
    cpuProb = 0.7;
  } else if (/scale|deploy|build/i.test(actionLower)) {
    cpuDist = -0.4;
    cpuProb = 0.5;
  } else if (/read|check|status|health|list/i.test(actionLower)) {
    cpuDist = 0.1;
    cpuProb = 0.1;
  } else if (/update|upgrade|patch/i.test(actionLower)) {
    cpuDist = -0.3;
    cpuProb = 0.4;
  }
  // Higher current CPU = more disturbance from CPU-intensive actions
  if (cpu > 80 && cpuDist < 0) cpuDist *= 1.3;

  // Memory disturbance
  let memDist = 0;
  let memProb = 0.3;
  if (/restart|kill|stop/i.test(actionLower)) {
    memDist = -0.5;
    memProb = 0.6;
  } else if (/deploy|build|scale/i.test(actionLower)) {
    memDist = -0.4;
    memProb = 0.5;
  } else if (/read|check|status|health|list/i.test(actionLower)) {
    memDist = 0.05;
    memProb = 0.05;
  } else if (/clean|purge|flush|clear/i.test(actionLower)) {
    memDist = 0.3; // freeing memory is positive
    memProb = 0.2;
  }
  if (ram > 85 && memDist < 0) memDist *= 1.3;

  // Disk I/O disturbance
  let diskDist = 0;
  let diskProb = 0.2;
  if (/deploy|build|write|create/i.test(actionLower)) {
    diskDist = -0.3;
    diskProb = 0.4;
  } else if (/clean|purge|delete|remove/i.test(actionLower)) {
    diskDist = 0.2; // freeing disk space is positive
    diskProb = 0.3;
  } else if (/read|check|list/i.test(actionLower)) {
    diskDist = 0;
    diskProb = 0.1;
  }
  if (disk > 85 && diskDist < 0) diskDist *= 1.2;

  // Network disturbance
  let netDist = 0;
  let netProb = 0.2;
  if (/restart|stop|kill/i.test(actionLower)) {
    netDist = -0.4;
    netProb = 0.5;
  } else if (/deploy|scale/i.test(actionLower)) {
    netDist = -0.2;
    netProb = 0.3;
  } else if (/read|check|health/i.test(actionLower)) {
    netDist = 0;
    netProb = 0.05;
  }

  // Cascading failure probability
  let cascadeDist = 0;
  let cascadeProb = 0.2;
  if (/restart|reboot|kill -9|shutdown/i.test(actionLower)) {
    cascadeDist = -0.7;
    cascadeProb = 0.6;
    if (/postgres|redis|nginx|docker/i.test(actionLower)) {
      cascadeDist = -0.85;
      cascadeProb = 0.75;
    }
  } else if (/deploy|update|upgrade/i.test(actionLower)) {
    cascadeDist = -0.3;
    cascadeProb = 0.35;
  } else if (/read|check|status|health/i.test(actionLower)) {
    cascadeDist = 0.1;
    cascadeProb = 0.05;
  }

  // Process dependency impact
  let depDist = 0;
  let depProb = 0.2;
  if (/postgres|redis|mysql|mongodb/i.test(actionLower)) {
    depDist = -0.7;
    depProb = 0.7;
  } else if (/nginx|apache|docker/i.test(actionLower)) {
    depDist = -0.5;
    depProb = 0.5;
  } else if (/node|python|java/i.test(actionLower)) {
    depDist = -0.3;
    depProb = 0.3;
  } else if (/read|check|list/i.test(actionLower)) {
    depDist = 0;
    depProb = 0.05;
  }

  return {
    cpu_disturbance: { value: clamp(cpuDist), probability: cpuProb, description: "CPU load impact" },
    memory_disturbance: { value: clamp(memDist), probability: memProb, description: "Memory usage impact" },
    disk_io: { value: clamp(diskDist), probability: diskProb, description: "Disk I/O impact" },
    network: { value: clamp(netDist), probability: netProb, description: "Network connectivity impact" },
    cascading_failure: { value: clamp(cascadeDist), probability: cascadeProb, description: "Cascading failure risk" },
    process_dependency: { value: clamp(depDist), probability: depProb, description: "Process dependency impact" },
  };
}

function clamp(v) {
  return Math.max(-1, Math.min(1, Math.round(v * 100) / 100));
}

/**
 * Compute residual-resource uncertainty.
 * Higher when server state is unknown or highly loaded.
 */
function computeUncertainty(serverState, dimensions) {
  const knownMetrics = Object.values(serverState).filter((v) => v != null).length;
  const totalMetrics = 5; // cpu, ram, disk, network, processes
  const unknownRatio = 1 - (knownMetrics / totalMetrics);

  // Average probability across dimensions (higher prob = more predictable = less uncertainty)
  const avgProb = Object.values(dimensions).reduce((sum, d) => sum + d.probability, 0) / Object.keys(dimensions).length;

  // Uncertainty increases with unknown metrics and low probability
  return Math.round((unknownRatio * 0.5 + (1 - avgProb) * 0.5) * 100) / 100;
}

/**
 * Compute temporal window in seconds (continuous, not categorical).
 */
function computeTemporalWindow(action, dimensions) {
  const actionLower = action.toLowerCase();
  let baseSeconds = 5; // default: 5 seconds for read-only

  if (/restart/i.test(actionLower)) baseSeconds = 30;
  else if (/reboot/i.test(actionLower)) baseSeconds = 120;
  else if (/deploy|build/i.test(actionLower)) baseSeconds = 180;
  else if (/scale/i.test(actionLower)) baseSeconds = 60;
  else if (/kill|stop/i.test(actionLower)) baseSeconds = 15;
  else if (/update|upgrade|patch/i.test(actionLower)) baseSeconds = 90;
  else if (/clean|purge|flush/i.test(actionLower)) baseSeconds = 10;

  // Adjust based on cascading failure probability (higher = longer window)
  const cascadeProb = dimensions.cascading_failure.probability;
  const adjusted = baseSeconds * (1 + cascadeProb * 0.5);

  return Math.round(adjusted);
}

/**
 * Record outcome and update adaptive weights using EWMA.
 *
 * @param {string} action - The action that was executed
 * @param {number} predictedRRS - The RRS predicted before execution
 * @param {number} actualHealthDelta - Change in system health after execution (-1 to +1)
 */
async function recordOutcome(action, predictedRRS, actualHealthDelta) {
  // Store in calibration history
  calibrationHistory.push({
    action,
    predicted_rrs: predictedRRS,
    actual_delta: actualHealthDelta,
    timestamp: Date.now(),
  });

  // Keep only last 100 entries
  if (calibrationHistory.length > 100) calibrationHistory.shift();

  // Compute Brier score for this prediction
  const predictedProb = (predictedRRS + 100) / 200; // normalize to 0-1
  const actualProb = (actualHealthDelta + 1) / 2; // normalize to 0-1
  const brier = Math.pow(predictedProb - actualProb, 2);

  // Update weights using EWMA
  // If predicted RRS was far from actual, increase weight of the dimension that was most wrong
  const error = Math.abs(predictedRRS / 100 - actualHealthDelta);
  if (error > 0.1) {
    // Find which dimension contributed most to the error
    const dimensions = computeDimensions(action, {});
    let maxErrorDim = null;
    let maxError = 0;
    for (const [key, dim] of Object.entries(dimensions)) {
      const dimError = Math.abs(dim.value - actualHealthDelta);
      if (dimError > maxError) {
        maxError = dimError;
        maxErrorDim = key;
      }
    }
    if (maxErrorDim) {
      // EWMA update: increase weight of the dimension that was most wrong
      const currentWeight = adaptiveWeights[maxErrorDim] || 0.1;
      const adjustment = error * 0.1;
      adaptiveWeights[maxErrorDim] = Math.max(0.05, Math.min(0.4,
        EWMA_ALPHA * (currentWeight + adjustment) + (1 - EWMA_ALPHA) * currentWeight
      ));
    }
  }

  // Normalize weights to sum to 1
  const total = Object.values(adaptiveWeights).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(adaptiveWeights)) {
    adaptiveWeights[key] = Math.round((adaptiveWeights[key] / total) * 1000) / 1000;
  }

  try {
    await audit({
      operation: "crds_outcome",
      actor: "agent",
      target: action,
      target_type: "calibration",
      reasoning: `predicted=${predictedRRS}, actual_delta=${actualHealthDelta}, brier=${brier}`,
      confidence: 1 - brier,
      result: "recorded",
    });
  } catch (e) {
    console.warn("[CRDS] audit log failed:", e.message);
  }

  return { brier, weights: { ...adaptiveWeights } };
}

/**
 * Get calibration summary from history.
 */
function getCalibrationSummary() {
  if (calibrationHistory.length === 0) {
    return { count: 0, mean_brier: 0, ece: 0 };
  }

  const briers = calibrationHistory.map((h) => {
    const predProb = (h.predicted_rrs + 100) / 200;
    const actualProb = (h.actual_delta + 1) / 2;
    return Math.pow(predProb - actualProb, 2);
  });

  const meanBrier = briers.reduce((a, b) => a + b, 0) / briers.length;

  // ECE with 5 bins
  const bins = [[], [], [], [], []];
  for (const h of calibrationHistory) {
    const predProb = (h.predicted_rrs + 100) / 200;
    const binIdx = Math.min(4, Math.floor(predProb * 5));
    bins[binIdx].push({ pred: predProb, actual: (h.actual_delta + 1) / 2 });
  }
  let ece = 0;
  const total = calibrationHistory.length;
  for (const bin of bins) {
    if (bin.length === 0) continue;
    const avgPred = bin.reduce((s, x) => s + x.pred, 0) / bin.length;
    const avgActual = bin.reduce((s, x) => s + x.actual, 0) / bin.length;
    ece += (bin.length / total) * Math.abs(avgPred - avgActual);
  }

  return {
    count: calibrationHistory.length,
    mean_brier: Math.round(meanBrier * 1000) / 1000,
    ece: Math.round(ece * 1000) / 1000,
  };
}

/**
 * Get current adaptive weights (for frontend display).
 */
function getWeights() {
  return { ...adaptiveWeights };
}

/**
 * Reset weights to initial values (for testing).
 */
function resetWeights() {
  adaptiveWeights = { ...INITIAL_WEIGHTS };
  calibrationHistory.length = 0;
}

module.exports = {
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
};
