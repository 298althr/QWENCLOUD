// backend/src/qwen/guardrails.js
// AI Guardrails: rate limiting, budget enforcement, circuit breaker,
// prompt size limits, thinking budget governance, and response truncation.
//
// All Qwen API calls should go through `guardedCreate()` which wraps the
// OpenAI SDK's `chat.completions.create()` with pre-flight checks and
// post-call usage tracking.

const tokenTracker = require("./tokenTracker");
const { updateTokenUsage, selectModel, markModelExhausted } = require("./client");
const { getCachedResponse, cacheResponse, optimizePrompt, handleStructuredOutput } = require("./prompt-optimizer");

// ── Configuration ──
const CONFIG = {
  // Max calls per minute per module (prevents runaway loops)
  rateLimitPerMinute: Number(process.env.QWEN_RATE_LIMIT_PER_MIN || 30),

  // Max prompt input tokens (prevents bloated prompts) - tiered by task complexity
  maxInputTokens: Number(process.env.QWEN_MAX_INPUT_TOKENS || 1000),
  maxInputTokensFullContext: Number(process.env.QWEN_MAX_INPUT_TOKENS_FULL || 5000), // For complex tasks

  // Default thinking budget per call type (tokens)
  thinkingBudgets: {
    intent: 0,          // No thinking needed — structured output only
    confidence: 0,      // No thinking — just scoring
    status: 0,          // No thinking — quick checks
    simple: 0,
    moderate: 1000,     // DRE/DREV — moderate reasoning
    dre: 1000,
    drev: 1000,
    complex: 2000,      // Diagnosis/planning — deep reasoning
    diagnosis: 2000,
    planning: 2000,
    default: 1500,
  },

  // Max output tokens per call type - tiered by task complexity.
  // Keep budgets generous; the model stops when it's done, so a higher limit
  // just prevents truncation on complex explanations.
  maxOutputTokens: {
    intent: 200,
    confidence: 800,
    status: 200,
    simple: 500,
    moderate: 1200,
    dre: 1200,
    drev: 1200,
    complex: 2000,
    diagnosis: 2000,
    planning: 2000,
    ai_command_execution: 1500,
    default: 1200,
  },

  // Circuit breaker: trip after N consecutive failures
  circuitBreakerThreshold: Number(process.env.QWEN_CB_THRESHOLD || 5),
  circuitBreakerResetMs: Number(process.env.QWEN_CB_RESET_MS || 60000), // 1 min cooldown

  // Max retries on transient errors
  maxRetries: 2,
  retryDelayMs: 500,

  // Request timeout (ms) to prevent hanging on slow Qwen responses
  requestTimeoutMs: Number(process.env.QWEN_REQUEST_TIMEOUT_MS || 30000),
};

// ── Rate limiter (per-module sliding window) ──
const rateLimitWindows = new Map(); // module -> [timestamps]

function checkRateLimit(module) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const key = module || "default";

  if (!rateLimitWindows.has(key)) rateLimitWindows.set(key, []);
  const timestamps = rateLimitWindows.get(key);

  // Prune old entries
  const recent = timestamps.filter((t) => now - t < windowMs);
  rateLimitWindows.set(key, recent);

  if (recent.length >= CONFIG.rateLimitPerMinute) {
    return {
      allowed: false,
      reason: `Rate limit exceeded for "${key}": ${recent.length} calls/min (max ${CONFIG.rateLimitPerMinute})`,
    };
  }
  return { allowed: true, reason: "OK" };
}

function recordRateLimitCall(module) {
  const key = module || "default";
  if (!rateLimitWindows.has(key)) rateLimitWindows.set(key, []);
  rateLimitWindows.get(key).push(Date.now());
}

// ── Circuit breaker ──
let consecutiveFailures = 0;
let circuitTrippedAt = 0;

function checkCircuitBreaker() {
  if (consecutiveFailures >= CONFIG.circuitBreakerThreshold) {
    const elapsed = Date.now() - circuitTrippedAt;
    if (elapsed < CONFIG.circuitBreakerResetMs) {
      return {
        allowed: false,
        reason: `Circuit breaker tripped: ${consecutiveFailures} consecutive failures. Reset in ${Math.ceil((CONFIG.circuitBreakerResetMs - elapsed) / 1000)}s`,
      };
    }
    // Reset after cooldown
    consecutiveFailures = 0;
    circuitTrippedAt = 0;
  }
  return { allowed: true, reason: "OK" };
}

function recordSuccess() {
  consecutiveFailures = 0;
  circuitTrippedAt = 0;
}

function recordFailure() {
  consecutiveFailures++;
  if (consecutiveFailures >= CONFIG.circuitBreakerThreshold && circuitTrippedAt === 0) {
    circuitTrippedAt = Date.now();
    console.error(`[guardrails] Circuit breaker tripped after ${consecutiveFailures} failures. Cooldown: ${CONFIG.circuitBreakerResetMs}ms`);
  }
}

// ── Prompt validation ──

/**
 * Validate and sanitize messages before sending to Qwen.
 * - Trims overly long prompts
 * - Estimates token count and rejects if over limit
 * - Strips potential prompt injection patterns
 */
function validatePrompt(messages, moduleName, maxTokensOverride) {
  const issues = [];

  // Estimate total input tokens
  let totalChars = 0;
  for (const msg of messages) {
    if (msg.content) {
      totalChars += typeof msg.content === "string" ? msg.content.length : JSON.stringify(msg.content).length;
    }
  }
  const estimatedTokens = tokenTracker.estimateTokens("x".repeat(totalChars));

  const maxTokens = maxTokensOverride || CONFIG.maxInputTokens;
  if (estimatedTokens > maxTokens) {
    issues.push({
      severity: "error",
      message: `Prompt too large: ~${estimatedTokens} tokens (max ${maxTokens}). Module: ${moduleName}`,
    });
  }

  // Basic prompt injection detection
  const injectionPatterns = [
    /ignore (all )?previous instructions/i,
    /you are now (a|an) \w+ (?!server)/i,
    /disregard (the )?system prompt/i,
    /forget (everything|all) (you |that you )?know/i,
  ];

  for (const msg of messages) {
    if (msg.role === "user" && typeof msg.content === "string") {
      for (const pattern of injectionPatterns) {
        if (pattern.test(msg.content)) {
          issues.push({
            severity: "warning",
            message: `Possible prompt injection detected in user input. Pattern: ${pattern.source}`,
          });
        }
      }
    }
  }

  return { issues, estimatedTokens };
}

// ── Thinking budget governance ──

/**
 * Get the appropriate thinking budget for a task type.
 * @param {string} taskType - "intent", "confidence", "diagnosis", etc.
 * @returns {number} thinking budget in tokens
 */
function getThinkingBudget(taskType) {
  return CONFIG.thinkingBudgets[taskType] ?? CONFIG.thinkingBudgets.default;
}

/**
 * Get the appropriate max output tokens for a task type.
 */
function getMaxOutputTokens(taskType) {
  return CONFIG.maxOutputTokens[taskType] ?? CONFIG.maxOutputTokens.default;
}

// ── Sleep helper ──
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main guarded create function ──

/**
 * Wraps qwen.chat.completions.create() with all guardrails.
 *
 * @param {object} openaiClient - The OpenAI SDK client (qwen)
 * @param {object} params - Standard chat.completions.create params
 * @param {object} opts - Guardrail options
 * @param {string} opts.module - Name of the calling module (for tracking)
 * @param {string} [opts.taskType] - Task type for thinking budget / output limits
 * @param {boolean} [opts.stream] - Whether this is a streaming call
 * @returns {Promise<object>} The API response (same as openai SDK)
 * @throws {Error} If guardrails block the call or all retries fail
 */
async function guardedCreate(openaiClient, params, opts = {}) {
  const moduleName = opts.module || "unknown";
  const taskType = opts.taskType || "default";

  // 1. Check cache for identical prompts
  const userMessage = params.messages?.find(m => m.role === 'user')?.content || '';
  const systemMessage = params.messages?.find(m => m.role === 'system')?.content || '';
  const cachedResponse = getCachedResponse(systemMessage, userMessage, taskType);
  
  if (cachedResponse) {
    console.log(`[guardrails] Cache hit for ${taskType} - saving tokens`);
    return cachedResponse;
  }

  // 2. Optimize prompt for token efficiency (skip for tasks requiring full context
  // or structured JSON schema compliance).
  const tasksRequiringFullContext = ['ai-command-execution', 'complex', 'diagnosis', 'planning', 'confidence', 'dre', 'drev', 'intent'];
  const modulesRequiringFullContext = ['ai-command-execution', 'confidence-dqs', 'confidence-score', 'dre', 'drev'];
  const useOptimization = !tasksRequiringFullContext.includes(taskType) && !modulesRequiringFullContext.includes(moduleName);
  
  let messagesToUse = params.messages;
  if (useOptimization) {
    const optimized = optimizePrompt(taskType, { userMessage });
    messagesToUse = [
      { role: 'system', content: optimized.prompt },
      { role: 'user', content: optimized.compressedContext || userMessage }
    ];
  }

  // 3. Circuit breaker check
  const cbCheck = checkCircuitBreaker();
  if (!cbCheck.allowed) {
    throw new Error(`[guardrails] ${cbCheck.reason}`);
  }

  // 4. Rate limit check
  const rlCheck = checkRateLimit(moduleName);
  if (!rlCheck.allowed) {
    throw new Error(`[guardrails] ${rlCheck.reason}`);
  }

  // 5. Prompt validation with optimized or original messages
  // Use higher token limit for full-context tasks
  const maxTokens = useOptimization ? CONFIG.maxInputTokens : CONFIG.maxInputTokensFullContext;
  const { issues, estimatedTokens } = validatePrompt(messagesToUse, moduleName, maxTokens);
  const blockingIssues = issues.filter((i) => i.severity === "error");
  if (blockingIssues.length > 0) {
    throw new Error(`[guardrails] ${blockingIssues[0].message}`);
  }
  // Log warnings but don't block
  issues.filter((i) => i.severity === "warning").forEach((i) => {
    console.warn(`[guardrails] ${i.message}`);
  });

  // 6. Budget pre-flight check with optimized tokens
  const expectedOutput = getMaxOutputTokens(taskType);
  const expectedThinking = getThinkingBudget(taskType);
  const estimatedCost = tokenTracker.estimateCost(
    params.model,
    messagesToUse,
    expectedOutput,
    expectedThinking
  );
  const budgetCheck = tokenTracker.checkBudget(estimatedCost);
  if (!budgetCheck.allowed) {
    throw new Error(`[guardrails] ${budgetCheck.reason}`);
  }

  // 7. Enforce thinking budget, max tokens, and timeout
  const guardedParams = {
    ...params,
    messages: messagesToUse,
    max_tokens: params.max_tokens || expectedOutput,
    timeout: params.timeout || CONFIG.requestTimeoutMs,
  };

  // Only set thinking_budget if enable_thinking is true
  if (guardedParams.enable_thinking && !guardedParams.thinking_budget) {
    guardedParams.thinking_budget = expectedThinking;
  }

  // 8. Execute with retry + 403 model-rotation fallback
  recordRateLimitCall(moduleName);

  let lastError;
  const triedModels = new Set([guardedParams.model]);
  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    try {
      const response = await openaiClient.chat.completions.create(guardedParams);

      // 9. Track usage from response
      if (response && response.usage) {
        const inputTokens = response.usage.prompt_tokens || 0;
        const outputTokens = response.usage.completion_tokens || 0;
        const thinkingTokens = response.usage.reasoning_tokens || 0;
        
        tokenTracker.record({
          model: params.model,
          module: moduleName,
          inputTokens,
          outputTokens,
          thinkingTokens,
        });
        
        // Update model-specific token usage for rotation
        updateTokenUsage(params.model, inputTokens, outputTokens + thinkingTokens);
        
        // Cache the response for future use
        cacheResponse(systemMessage, userMessage, taskType, response);
        
        console.log(`[guardrails] Token efficiency: ${inputTokens} in, ${outputTokens} out ${useOptimization ? '(optimized)' : '(full-context)'}`);
      } else if (!opts.stream) {
        // Non-streaming response without usage — estimate
        const outputText = response?.choices?.[0]?.message?.content || "";
        const outputTokens = tokenTracker.estimateTokens(outputText);
        
        tokenTracker.record({
          model: params.model,
          module: moduleName,
          inputTokens: estimatedTokens,
          outputTokens,
          thinkingTokens: 0,
        });
        
        // Update model-specific token usage for rotation
        updateTokenUsage(params.model, estimatedTokens, outputTokens);
        
        // Cache the response
        cacheResponse(systemMessage, userMessage, taskType, response);
      }

      recordSuccess();
      return response;

    } catch (err) {
      lastError = err;

      // 401 = auth issue -> fail fast.
      if (err.status === 401 || err.message?.includes("[guardrails]")) {
        recordFailure();
        throw err;
      }

      // 403 = free quota exhausted for this model. Mark it depleted and try the
      // next model in the rotation tier instead of giving up.
      if (err.status === 403 && err.message?.includes("free quota")) {
        markModelExhausted(guardedParams.model);
        const nextModel = selectModel(taskType);
        if (nextModel && !triedModels.has(nextModel)) {
          console.warn(`[guardrails] ${guardedParams.model} quota exhausted. Rotating to ${nextModel} for task ${taskType}`);
          triedModels.add(nextModel);
          guardedParams.model = nextModel;
          // Reset attempt counter because we're trying a different model, not retrying the same one.
          attempt = -1;
          continue;
        }
        // No untried models left in this tier -> fail.
        recordFailure();
        throw err;
      }

      if (attempt < CONFIG.maxRetries) {
        await sleep(CONFIG.retryDelayMs * (attempt + 1));
      }
    }
  }

  recordFailure();
  throw new Error(`[guardrails] All ${CONFIG.maxRetries + 1} attempts failed for "${moduleName}": ${lastError?.message}`);
}

/**
 * Wraps a streaming chat.completions.create() with guardrails.
 * Returns the stream directly (caller must track usage from final chunk).
 *
 * @param {object} openaiClient
 * @param {object} params
 * @param {object} opts - { module, taskType }
 * @returns {Promise<AsyncIterable>} The stream
 */
async function guardedStream(openaiClient, params, opts = {}) {
  const moduleName = opts.module || "unknown";
  const taskType = opts.taskType || "default";

  // Same pre-flight checks as guardedCreate
  const cbCheck = checkCircuitBreaker();
  if (!cbCheck.allowed) throw new Error(`[guardrails] ${cbCheck.reason}`);

  const rlCheck = checkRateLimit(moduleName);
  if (!rlCheck.allowed) throw new Error(`[guardrails] ${rlCheck.reason}`);

  // Streaming calls are used for deep reasoning (diagnosis/planning/certainty),
  // which legitimately need more context than the compact default budget.
  const streamFullContextTasks = ['diagnosis', 'planning', 'complex'];
  const streamMaxTokens = streamFullContextTasks.includes(taskType)
    ? CONFIG.maxInputTokensFullContext
    : CONFIG.maxInputTokens;
  const { issues, estimatedTokens } = validatePrompt(params.messages || [], moduleName, streamMaxTokens);
  const blockingIssues = issues.filter((i) => i.severity === "error");
  if (blockingIssues.length > 0) throw new Error(`[guardrails] ${blockingIssues[0].message}`);
  issues.filter((i) => i.severity === "warning").forEach((i) => console.warn(`[guardrails] ${i.message}`));

  const expectedOutput = getMaxOutputTokens(taskType);
  const expectedThinking = getThinkingBudget(taskType);
  const estimatedCost = tokenTracker.estimateCost(params.model, params.messages, expectedOutput, expectedThinking);
  const budgetCheck = tokenTracker.checkBudget(estimatedCost);
  if (!budgetCheck.allowed) throw new Error(`[guardrails] ${budgetCheck.reason}`);

  const guardedParams = {
    ...params,
    max_tokens: params.max_tokens || expectedOutput,
    stream: true,
    timeout: params.timeout || CONFIG.requestTimeoutMs,
  };
  if (guardedParams.enable_thinking && !guardedParams.thinking_budget) {
    guardedParams.thinking_budget = expectedThinking;
  }

  recordRateLimitCall(moduleName);

  // For streams, we wrap to capture usage from the final chunk
  // OpenAI streaming sends a final chunk with usage if stream_options.include_usage is set
  guardedParams.stream_options = { include_usage: true };

  // Try the selected model; on 403, rotate to next model in tier.
  let stream;
  const triedModels = new Set([guardedParams.model]);
  while (true) {
    try {
      stream = await openaiClient.chat.completions.create(guardedParams);
      break;
    } catch (err) {
      if (err.status === 401 || err.message?.includes("[guardrails]")) throw err;
      if (err.status === 403 && err.message?.includes("free quota")) {
        markModelExhausted(guardedParams.model);
        const nextModel = selectModel(taskType);
        if (nextModel && !triedModels.has(nextModel)) {
          console.warn(`[guardrails] ${guardedParams.model} quota exhausted. Rotating to ${nextModel} for streaming task ${taskType}`);
          triedModels.add(nextModel);
          guardedParams.model = nextModel;
          continue;
        }
      }
      throw err;
    }
  }

  // Return a wrapped async generator that captures usage from the last chunk
  async function* wrappedStream() {
    let lastUsage = null;
    let totalContent = "";
    let totalReasoning = "";

    for await (const chunk of stream) {
      // Check for usage in the final chunk
      if (chunk.usage) {
        lastUsage = chunk.usage;
      }
      // Accumulate content for fallback estimation
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.content) totalContent += delta.content;
      if (delta?.reasoning_content) totalReasoning += delta.reasoning_content;

      yield chunk;
    }

    // Record usage after stream completes
    if (lastUsage) {
      tokenTracker.record({
        model: params.model,
        module: moduleName,
        inputTokens: lastUsage.prompt_tokens || estimatedTokens,
        outputTokens: lastUsage.completion_tokens || tokenTracker.estimateTokens(totalContent),
        thinkingTokens: lastUsage.reasoning_tokens || tokenTracker.estimateTokens(totalReasoning),
      });
    } else {
      // Fallback: estimate from accumulated text
      tokenTracker.record({
        model: params.model,
        module: moduleName,
        inputTokens: estimatedTokens,
        outputTokens: tokenTracker.estimateTokens(totalContent),
        thinkingTokens: tokenTracker.estimateTokens(totalReasoning),
      });
    }

    recordSuccess();
  }

  return wrappedStream();
}

// ── Status / health ──

function getStatus() {
  return {
    circuitBreaker: {
      tripped: consecutiveFailures >= CONFIG.circuitBreakerThreshold,
      consecutiveFailures,
      resetMs: CONFIG.circuitBreakerResetMs,
    },
    rateLimits: Object.fromEntries(
      Array.from(rateLimitWindows.entries()).map(([k, v]) => [
        k,
        { callsInLastMinute: v.filter((t) => Date.now() - t < 60000).length, limit: CONFIG.rateLimitPerMinute }
      ])
    ),
    config: {
      maxInputTokens: CONFIG.maxInputTokens,
      rateLimitPerMinute: CONFIG.rateLimitPerMinute,
      thinkingBudgets: CONFIG.thinkingBudgets,
      maxOutputTokens: CONFIG.maxOutputTokens,
    },
  };
}

function reset() {
  consecutiveFailures = 0;
  circuitTrippedAt = 0;
  rateLimitWindows.clear();
  tokenTracker.reset();
}

module.exports = {
  guardedCreate,
  guardedStream,
  validatePrompt,
  getThinkingBudget,
  getMaxOutputTokens,
  checkRateLimit,
  checkCircuitBreaker,
  recordRateLimitCall,
  recordSuccess,
  recordFailure,
  getStatus,
  reset,
  CONFIG,
};
