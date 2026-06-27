// backend/src/qwen/confidence.js
// DQS — Decision Quality Scorer via structured output (json_object).

const { qwen, MODELS } = require("./client");

const SYSTEM_PROMPT = `You are the Decision Quality Scorer for ALTHR Autopilot.
Given a decision and its outcome, score the decision quality on five axes.
Return STRICT JSON:
{
  "info_quality": 0.0-1.0,       // Was sufficient information available?
  "model_quality": 0.0-1.0,      // Was the right model/approach used?
  "reasoning_quality": 0.0-1.0,  // Was the reasoning sound?
  "execution_quality": 0.0-1.0,  // Was execution clean?
  "learning_quality": 0.0-1.0,   // Was the outcome learned from?
  "confidence": 0.0-1.0,         // Overall confidence in the decision
  "risk_level": "low"|"medium"|"high",
  "action": "<the chosen action>",
  "reasoning": "<one-sentence rationale>"
}
Do not include markdown fences.`;

/**
 * @param {object} decision  { intent, plan, serverState }
 * @param {object} outcome   { result, success, toolResults }
 * @returns {object} parsed DQS scores
 */
async function calculateDQS(decision, outcome) {
  const res = await qwen.chat.completions.create({
    model: MODELS.PLUS,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Decision: ${JSON.stringify(decision)}\n\nOutcome: ${JSON.stringify(outcome)}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });
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
  const res = await qwen.chat.completions.create({
    model: MODELS.PLUS,
    messages: [
      {
        role: "system",
        content:
          'Return JSON: {"confidence": 0-1, "risk_level": "low"|"medium"|"high", "action": string, "reasoning": string}',
      },
      { role: "user", content: `Analysis: ${analysis}` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });
  return JSON.parse(res.choices[0].message.content);
}

module.exports = { calculateDQS, scoreConfidence };
