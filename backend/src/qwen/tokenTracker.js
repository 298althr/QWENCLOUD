// backend/src/qwen/tokenTracker.js
// Token usage tracker + cost calculator for all Qwen API calls.
// Tracks per-call, per-model, per-module usage with rolling windows.
// Provides cost estimates based on DashScope pricing (per 1K tokens).

// ── Pricing (USD per 1K tokens, approximate DashScope intl rates) ──
// Source: Alibaba Cloud DashScope pricing page (intl).
// Rates may vary; these are conservative estimates for budgeting.
const PRICING = {
  "qwen3.7-plus":   { input: 0.0004,  output: 0.0012,  thinking: 0.0004 },  // $0.40/$1.20 per 1M
  "qwen3.7-max":    { input: 0.0024,  output: 0.0096,  thinking: 0.0024 },  // $2.40/$9.60 per 1M
  "qwen3.6-flash":  { input: 0.0001,  output: 0.0003,  thinking: 0.0001 },  // $0.10/$0.30 per 1M
  "qwen-turbo":     { input: 0.00005, output: 0.00015, thinking: 0.00005 }, // $0.05/$0.15 per 1M
  "text-embedding-v4": { input: 0.00007, output: 0, thinking: 0 },          // $0.07 per 1M
};

// ── In-memory store ──
// Each entry: { timestamp, model, module, inputTokens, outputTokens, thinkingTokens, costUSD }
const calls = [];
const MAX_HISTORY = 10000; // keep last 10K calls in memory

// Rolling budget windows (resettable)
let dailyBudgetUSD = Number(process.env.QWEN_DAILY_BUDGET_USD || 5.0); // $5/day default
let monthlyBudgetUSD = Number(process.env.QWEN_MONTHLY_BUDGET_USD || 50.0); // $50/month default

// ── Core tracking function ──

/**
 * Record a single API call's token usage.
 * @param {object} entry
 * @param {string} entry.model - Qwen model name
 * @param {string} entry.module - Which module made the call (e.g. "certainty", "dre", "intent-parser")
 * @param {number} entry.inputTokens - Prompt tokens
 * @param {number} entry.outputTokens - Completion tokens
 * @param {number} [entry.thinkingTokens] - Reasoning tokens (if thinking mode)
 */
function record(entry) {
  const pricing = PRICING[entry.model] || PRICING["qwen3.7-plus"];
  const inTok = entry.inputTokens || 0;
  const outTok = entry.outputTokens || 0;
  const thinkTok = entry.thinkingTokens || 0;

  const cost =
    (inTok / 1000) * pricing.input +
    (outTok / 1000) * pricing.output +
    (thinkTok / 1000) * pricing.thinking;

  const record = {
    timestamp: Date.now(),
    model: entry.model,
    module: entry.module || "unknown",
    inputTokens: inTok,
    outputTokens: outTok,
    thinkingTokens: thinkTok,
    costUSD: Math.round(cost * 1000000) / 1000000, // micro-cent precision
  };

  calls.push(record);
  if (calls.length > MAX_HISTORY) calls.shift();

  return record;
}

// ── Estimation helpers (for pre-flight budget checks) ──

/**
 * Estimate token count from text length (rough: 1 token ≈ 4 chars).
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  if (!text) return 0;
  const str = typeof text === "string" ? text : JSON.stringify(text);
  return Math.ceil(str.length / 4);
}

/**
 * Estimate the cost of a planned API call before making it.
 * @param {string} model
 * @param {string|object} input - Input text or messages array
 * @param {number} expectedOutputTokens - Expected output length
 * @param {number} [expectedThinkingTokens] - Expected thinking tokens
 * @returns {number} estimated cost in USD
 */
function estimateCost(model, input, expectedOutputTokens, expectedThinkingTokens = 0) {
  const pricing = PRICING[model] || PRICING["qwen3.7-plus"];
  let inputTokens;

  if (Array.isArray(input)) {
    // messages array — sum all message contents
    inputTokens = input.reduce((sum, msg) => sum + estimateTokens(msg.content || ""), 0);
  } else {
    inputTokens = estimateTokens(input);
  }

  return Math.round(
    ((inputTokens / 1000) * pricing.input +
      (expectedOutputTokens / 1000) * pricing.output +
      (expectedThinkingTokens / 1000) * pricing.thinking) * 1000000
  ) / 1000000;
}

// ── Aggregation / reporting ──

function _windowSince(msAgo) {
  const cutoff = Date.now() - msAgo;
  return calls.filter((c) => c.timestamp >= cutoff);
}

/**
 * Get usage summary for a time window.
 * @param {string} window - "hour" | "day" | "week" | "month" | "all"
 * @returns {object} summary
 */
function getSummary(window = "day") {
  const windowMs = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    all: Infinity,
  }[window] || 24 * 60 * 60 * 1000;

  const scoped = windowMs === Infinity ? calls : _windowSince(windowMs);

  const byModel = {};
  const byModule = {};
  let totalInput = 0, totalOutput = 0, totalThinking = 0, totalCost = 0;

  for (const c of scoped) {
    totalInput += c.inputTokens;
    totalOutput += c.outputTokens;
    totalThinking += c.thinkingTokens;
    totalCost += c.costUSD;

    if (!byModel[c.model]) {
      byModel[c.model] = { calls: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, costUSD: 0 };
    }
    byModel[c.model].calls++;
    byModel[c.model].inputTokens += c.inputTokens;
    byModel[c.model].outputTokens += c.outputTokens;
    byModel[c.model].thinkingTokens += c.thinkingTokens;
    byModel[c.model].costUSD += c.costUSD;

    if (!byModule[c.module]) {
      byModule[c.module] = { calls: 0, inputTokens: 0, outputTokens: 0, thinkingTokens: 0, costUSD: 0 };
    }
    byModule[c.module].calls++;
    byModule[c.module].inputTokens += c.inputTokens;
    byModule[c.module].outputTokens += c.outputTokens;
    byModule[c.module].thinkingTokens += c.thinkingTokens;
    byModule[c.module].costUSD += c.costUSD;
  }

  // Round costs
  for (const m of Object.keys(byModel)) byModel[m].costUSD = Math.round(byModel[m].costUSD * 1000000) / 1000000;
  for (const m of Object.keys(byModule)) byModule[m].costUSD = Math.round(byModule[m].costUSD * 1000000) / 1000000;

  return {
    window,
    callCount: scoped.length,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalThinkingTokens: totalThinking,
    totalCostUSD: Math.round(totalCost * 1000000) / 1000000,
    byModel,
    byModule,
    budgets: {
      daily: dailyBudgetUSD,
      monthly: monthlyBudgetUSD,
      dailyUsed: _windowSince(24 * 60 * 60 * 1000).reduce((s, c) => s + c.costUSD, 0),
      monthlyUsed: _windowSince(30 * 24 * 60 * 60 * 1000).reduce((s, c) => s + c.costUSD, 0),
    },
    pricing: PRICING,
  };
}

/**
 * Get recent calls (for audit / debugging).
 * @param {number} limit
 * @returns {array}
 */
function getRecentCalls(limit = 50) {
  return calls.slice(-limit).reverse();
}

/**
 * Check if a planned call would exceed budget.
 * @param {number} estimatedCostUSD
 * @returns {{ allowed: boolean, reason: string }}
 */
function checkBudget(estimatedCostUSD) {
  const dailyUsed = _windowSince(24 * 60 * 60 * 1000).reduce((s, c) => s + c.costUSD, 0);
  const monthlyUsed = _windowSince(30 * 24 * 60 * 60 * 1000).reduce((s, c) => s + c.costUSD, 0);

  if (dailyUsed + estimatedCostUSD > dailyBudgetUSD) {
    return {
      allowed: false,
      reason: `Daily budget exceeded: $${dailyUsed.toFixed(4)} used + $${estimatedCostUSD.toFixed(4)} > $${dailyBudgetUSD} budget`,
    };
  }
  if (monthlyUsed + estimatedCostUSD > monthlyBudgetUSD) {
    return {
      allowed: false,
      reason: `Monthly budget exceeded: $${monthlyUsed.toFixed(4)} used + $${estimatedCostUSD.toFixed(4)} > $${monthlyBudgetUSD} budget`,
    };
  }
  return { allowed: true, reason: "OK" };
}

/**
 * Update budget limits at runtime.
 */
function setBudgets({ daily, monthly }) {
  if (daily != null) dailyBudgetUSD = Number(daily);
  if (monthly != null) monthlyBudgetUSD = Number(monthly);
}

/**
 * Reset all tracking data (for testing).
 */
function reset() {
  calls.length = 0;
}

module.exports = {
  record,
  estimateTokens,
  estimateCost,
  getSummary,
  getRecentCalls,
  checkBudget,
  setBudgets,
  reset,
  PRICING,
};
