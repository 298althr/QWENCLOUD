// backend/src/qwen/confidence.js
// DQS — Decision Quality Scorer via structured output (json_object).

const { qwen, MODELS, selectModel } = require("./client");
const { guardedCreate, getMaxOutputTokens } = require("./guardrails");
const { CONFIDENCE_SCORER_PROMPT, LIGHTWEIGHT_CONFIDENCE_PROMPT } = require("./prompts");

const SYSTEM_PROMPT = CONFIDENCE_SCORER_PROMPT;

/**
 * @param {object} decision  { intent, plan, serverState }
 * @param {object} outcome   { result, success, toolResults }
 * @returns {object} parsed DQS scores
 */
async function calculateDQS(decision, outcome) {
  const res = await guardedCreate(qwen, {
    model: selectModel("confidence"),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Decision: ${JSON.stringify(decision)}\n\nOutcome: ${JSON.stringify(outcome)}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: getMaxOutputTokens("confidence"),
  }, { module: "confidence-dqs", taskType: "confidence" });
  const raw = res.choices[0].message.content;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`DQS returned non-JSON: ${raw}`);
  }
}

/**
 * Lightweight confidence scorer used by the Certainty Pipeline (Day 3) to gate
 * execution. Returns { confidence, risk_level, action, reasoning }.
 */
async function scoreConfidence(analysis) {
  const res = await guardedCreate(qwen, {
    model: selectModel("confidence"),
    messages: [
      {
        role: "system",
        content: LIGHTWEIGHT_CONFIDENCE_PROMPT,
      },
      { role: "user", content: `Analysis: ${analysis}` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: getMaxOutputTokens("confidence"),
  }, { module: "confidence-score", taskType: "confidence" });
  const raw = res.choices[0].message.content;
  try {
    return JSON.parse(raw);
  } catch (e) {
    // Try to recover from truncated JSON by extracting fields with regex.
    const confidenceMatch = raw.match(/"confidence"\s*:\s*([0-9.]+)/);
    const riskMatch = raw.match(/"risk_level"\s*:\s*"([^"]+)"/);
    const actionMatch = raw.match(/"action"\s*:\s*"([^"]*)"/);
    const reasoningMatch = raw.match(/"reasoning"\s*:\s*"([^"]*)"/);
    if (confidenceMatch || riskMatch || actionMatch) {
      console.warn("[confidence] Recovered from malformed JSON:", raw.slice(0, 200));
      return {
        confidence: confidenceMatch ? Number(confidenceMatch[1]) : 0.6,
        risk_level: riskMatch ? riskMatch[1] : "medium",
        action: actionMatch ? actionMatch[1] : "",
        reasoning: reasoningMatch
          ? reasoningMatch[1]
          : "Recovered from truncated model response",
      };
    }
    throw new Error(`Confidence scorer returned non-JSON: ${raw}`);
  }
}

module.exports = { calculateDQS, scoreConfidence };
