// backend/src/pipeline/certainty.js
// Certainty-Driven Decision Pipeline — 7 stages.
// Stages 1-5: Qwen thinking mode reasons through the problem.
// Stage 6:    Confidence scoring via structured output.
// Stage 7:    Execution authorization (auto / human approval / block+escalate).

const { qwen, MODELS } = require("../qwen/client");
const { scoreConfidence } = require("../qwen/confidence");

const STAGES = [
  "problem_definition",
  "context_identification",
  "constraint_mapping",
  "intent_clarification",
  "expert_validation",
  "confidence_scoring",
  "execution_authorization",
];

const AUTO_EXECUTE_THRESHOLD = Number(process.env.AUTO_EXECUTE_THRESHOLD || 0.85);

const THINKING_SYSTEM_PROMPT = `You are the Certainty-Driven Decision Pipeline for ALTHR Autopilot.
Analyze the user request through these stages:
1. Problem Definition: What is being asked?
2. Context Identification: What server state is relevant?
3. Constraint Mapping: What limits apply (SAF whitelist, timeouts, permissions)?
4. Intent Clarification: What does the user actually want?
5. Expert Validation: Does the proposed action make sense?

Return your reasoning for each stage, then a concise proposed action.`;

/**
 * Run the 7-stage certainty pipeline.
 * @param {object} args
 * @param {string} args.userMessage
 * @param {object} args.serverState
 * @param {object} [args.qwenClient]  inject for tests
 * @param {(evt:object)=>void} [args.onChunk]  streaming callback (reasoning/content)
 * @returns {Promise<object>} { stages, confidence, risk_level, action, reasoning, authorized, authorization_type }
 */
async function runCertaintyPipeline({ userMessage, serverState, onChunk }) {
  const pipelineResult = {
    stages: {},
    confidence: 0,
    risk_level: "high",
    action: null,
    reasoning: null,
    authorized: false,
    authorization_type: "blocked_escalate",
  };

  // Stages 1-5: thinking mode reasoning (streamed if onChunk provided)
  let thinkingResponse;
  if (onChunk) {
    const stream = await qwen.chat.completions.create({
      model: MODELS.MAX,
      messages: [
        { role: "system", content: THINKING_SYSTEM_PROMPT + `\n\nCurrent server state: ${JSON.stringify(serverState)}` },
        { role: "user", content: userMessage },
      ],
      enable_thinking: true,
      thinking_budget: 1500,
      preserve_thinking: true,
      stream: true,
    });
    let content = "";
    let reasoning = "";
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.reasoning_content) { reasoning += delta.reasoning_content; onChunk({ type: "reasoning", chunk: delta.reasoning_content }); }
      if (delta.content) { content += delta.content; onChunk({ type: "content", chunk: delta.content }); }
    }
    thinkingResponse = { reasoning, content };
  } else {
    const res = await qwen.chat.completions.create({
      model: MODELS.MAX,
      messages: [
        { role: "system", content: THINKING_SYSTEM_PROMPT + `\n\nCurrent server state: ${JSON.stringify(serverState)}` },
        { role: "user", content: userMessage },
      ],
      enable_thinking: true,
      thinking_budget: 1500,
      preserve_thinking: true,
    });
    thinkingResponse = {
      reasoning: res.choices[0].message.reasoning_content,
      content: res.choices[0].message.content,
    };
  }

  pipelineResult.stages.thinking = thinkingResponse.reasoning;
  pipelineResult.stages.answer = thinkingResponse.content;
  pipelineResult.reasoning = thinkingResponse.reasoning;

  // Stage 6: confidence scoring via structured output
  const plan = await scoreConfidence(thinkingResponse.content || userMessage);
  pipelineResult.confidence = Number(plan.confidence);
  pipelineResult.risk_level = plan.risk_level;
  pipelineResult.action = plan.action;
  pipelineResult.stages.confidence = plan;

  // Stage 7: execution authorization
  const lowRisk = plan.risk_level === "low";
  if (pipelineResult.confidence >= AUTO_EXECUTE_THRESHOLD && lowRisk) {
    pipelineResult.authorized = true;
    pipelineResult.authorization_type = "auto";
  } else if (pipelineResult.confidence >= 0.5) {
    pipelineResult.authorized = false;
    pipelineResult.authorization_type = "human_approval_required";
  } else {
    pipelineResult.authorized = false;
    pipelineResult.authorization_type = "blocked_escalate";
  }
  pipelineResult.stages.authorization = {
    type: pipelineResult.authorization_type,
    threshold: AUTO_EXECUTE_THRESHOLD,
  };

  return pipelineResult;
}

module.exports = { runCertaintyPipeline, STAGES, AUTO_EXECUTE_THRESHOLD };
