// backend/src/pipeline/orchestrator.js
// End-to-end orchestration: NL message -> intent -> certainty pipeline ->
// SAF -> execute (or hold for approval). Streams reasoning via WebSocket.

const { parseIntent } = require("../qwen/intent-parser");
const { runCertaintyPipeline } = require("./certainty");
const { safCheck } = require("./saf");
const { executeTool } = require("../qwen/toolExecutor");
const { createPendingAction } = require("./approvals");
const { audit } = require("../utils/audit");
const memory = require("../memory/store");
const { buildContextForMessage, storeConversationTurn } = require("../memory/context");
const { tryAnswer } = require("../memory/contextEngine");
const { inferMassForAction } = require("../decision/mass");
const { recordPrediction, recordOutcome } = require("../decision/calibration");
const dre = require("../decision/dre");
const drev = require("../decision/drev");
const crds = require("../decision/crds");
const critique = require("../decision/critique");
const { explainDRE, explainDREV, explainCRDS } = require("../decision/explain");
const { generateCounterHypotheses, evaluateHypothesisCompetition } = require("../decision/counterHypothesis");
const usms = require("../kernel/usms");
const ueb = require("../kernel/ueb");
const ksr = require("../kernel/ksr");
const digitalTwinManager = require("../simulation/digitalTwin");
const simulationBroker = require("../simulation/simulationBroker");
const walkForwardValidator = require("../simulation/walkForwardValidator");
const workflowEngine = require("../execution/workflowEngine");
const trustCalibrationEngine = require("../execution/trustCalibration");
const optimizationEngine = require("../execution/optimizationEngine");
const CommandExecutor = require("../commands/command-executor");
const { qwen, MODELS, selectModel } = require("../qwen/client");
const { guardedCreate, getMaxOutputTokens } = require("../qwen/guardrails");
const { FUNCTION_CALLING_PROMPT } = require("../qwen/prompts");
const { addTerminalLog } = require("../utils/terminalLog");

/**
 * @param {object} args
 * @param {string} args.message
 * @param {object} [args.serverState]
 * @param {object} [args.user]  { username, role }
 * @param {object} [args.io]    Socket.io server for streaming
 * @param {string} [args.source] "dashboard" | "telegram"
 * @param {string} [args.socketId]  to direct stream events to a single client
 * @returns {Promise<object>} { action_id, intent, plan, confidence, risk_level, authorization, reasoning, results }
 */
async function handleAgentMessage({ message, serverState = {}, user = { username: "agent", role: "admin" }, io, source = "dashboard", socketId }) {
  const emit = (event, payload) => {
    if (!io) return;
    if (socketId) io.to(socketId).emit(event, payload);
    else io.emit(event, payload);
  };

  const action_id = generateActionId();

  const problemObject = await usms.createObject('problem', {
    message,
    user,
    source,
    timestamp: new Date().toISOString()
  });

  await ueb.publish('problem_received', {
    object_id: problemObject.object_id,
    message,
    user: user.username
  }, { source: 'orchestrator' });

  await usms.transitionState(problemObject.object_id, usms.STATE_LIFECYCLE.INITIALIZED);
  await usms.transitionState(problemObject.object_id, usms.STATE_LIFECYCLE.READY);

  try {
    await ksr.register({
      name: 'orchestrator',
      version: '2.0',
      interface: { handleAgentMessage: true },
      permissions: ['execute', 'read', 'write'],
      dependencies: ['qwen', 'memory', 'saf']
    });
  } catch (e) {
    console.warn('[orchestrator] KSR registration failed:', e.message);
  }

  let twin = null;
  try {
    twin = await digitalTwinManager.getTwin('default');
    if (!twin) {
      twin = await digitalTwinManager.createDigitalTwin('default', 'server');
    }

    await digitalTwinManager.syncWithReality(twin.twin_id);
  } catch (e) {
    console.warn('[orchestrator] Digital twin sync failed:', e.message);
    twin = null;
  }

  // 1. Parse intent
  const intent = await parseIntent(message);
  emit("action_update", { stage: "intent", intent });

  await ueb.publish('intent_parsed', {
    object_id: problemObject.object_id,
    intent,
    confidence: intent.confidence || 0.5
  }, { source: 'orchestrator' });

  // 1a. Fast-path: if this is a common informational question, answer from the
  // local Context Generator Engine instead of burning API tokens on Qwen.
  const cheapAnswer = tryAnswer(message, serverState);
  const isOperationalDeploy = intent.intent === "deploy" && (intent.entities?.repo_url || /github\.com/i.test(message));
  if (cheapAnswer && cheapAnswer.score >= 0.85 && ["monitor", "capacity_planning", "memory", "other", "deploy"].includes(intent.intent) && !isOperationalDeploy) {
    emit("response_stream", { chunk: cheapAnswer.answer });
    emit("action_update", { stage: "context_engine", intent, score: cheapAnswer.score, source: cheapAnswer.source, complete: true });
    await storeConversationTurn({ user: user.username, message, response: cheapAnswer.answer, intent, action_id }).catch(() => {});
    return {
      action_id,
      intent,
      plan: [],
      confidence: cheapAnswer.score,
      risk_level: "low",
      authorization: "not_required",
      reasoning: cheapAnswer.answer,
      results: null,
      context_engine: cheapAnswer,
    };
  }

  // If the parser detected missing key facts, ask clarifying questions instead of
  // running the full operational pipeline.
  if (intent.needs_clarification && Array.isArray(intent.clarifying_questions) && intent.clarifying_questions.length > 0) {
    const clarificationText = intent.clarifying_questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
    const responseText = `I need a little more context to answer accurately:\n\n${clarificationText}`;
    emit("response_stream", { chunk: responseText });
    emit("action_update", { stage: "clarification", questions: intent.clarifying_questions, complete: true });
    await storeConversationTurn({ user: user.username, message, response: responseText, intent, action_id }).catch(() => {});
    return {
      action_id,
      intent,
      plan: [],
      confidence: intent.confidence || 0.5,
      risk_level: "low",
      authorization: "not_required",
      reasoning: clarificationText,
      results: null,
    };
  }

  // 1b. Load persistent context (last 20 turns + semantic memory + context log).
  const context = await buildContextForMessage(message);
  if (context) {
    emit("action_update", { stage: "context_loaded", turns: 20, semantic: 10, logLines: 20 });
  }

  // 2. Certainty pipeline (stages 1-7), streaming reasoning
  const pipeline = await runCertaintyPipeline({
    userMessage: message,
    serverState,
    context,
    onChunk: (evt) => emit(evt.type === "reasoning" ? "reasoning_stream" : "response_stream", { chunk: evt.chunk }),
  });

  // 3. Build a plan from the pipeline action + intent entities
  const plan = buildPlan(intent, pipeline);

  // For capacity-planning questions, the reasoning is the answer. No tools needed.
  if (intent.intent === "capacity_planning") {
    const answer = pipeline.stages.answer || pipeline.reasoning || "I need more details to estimate capacity.";
    emit("response_stream", { chunk: answer });
    emit("action_update", { stage: "complete", complete: true, intent, authorization: "not_required" });
    await storeConversationTurn({ user: user.username, message, response: answer, intent, action_id }).catch(() => {});
    return {
      action_id,
      intent,
      plan,
      confidence: pipeline.confidence,
      risk_level: "low",
      authorization: "not_required",
      reasoning: answer,
      results: null,
    };
  }

  // 4. SAF check on the proposed action.
  // Use the primary plan step's tool name (or its command arg) as the SAF
  // "action" so L4 policy enforcement checks the real operation, not NL text.
  const primaryStep = plan[0] || { name: pipeline.action || message, args: {} };
  const safAction =
    primaryStep.name === "execute_command" && primaryStep.args?.command
      ? primaryStep.args.command
      : primaryStep.name;
  const target = intent.entities?.target || intent.summary || message;
  const saf = await safCheck(
    safAction,
    target,
    pipeline.risk_level,
    user,
    pipeline.confidence,
    false
  );
  emit("saf_result", { saf, action: safAction });

  // 5. Decision mass calculation (DQS layer)
  const decisionMass = inferMassForAction(primaryStep, pipeline.confidence, pipeline.risk_level, "server_ops");
  emit("decision_mass", { mass: decisionMass });

  // 5a. DRE — Deep Research Engine (graceful degradation)
  let dreResult = null;
  let dreExplain = null;
  const degradations = [];
  try {
    dreResult = await dre.research(message, serverState, { io, socketId, maxApiCalls: 5 });
    dreExplain = explainDRE(dreResult);
    emit("dre_result", { result: dreResult, explainability: dreExplain });
    if (dreResult.degraded) degradations.push("DRE: single-candidate fallback");
  } catch (e) {
    console.warn("[orchestrator] DRE failed:", e.message);
    degradations.push(`DRE: ${e.message}`);
    emit("dre_error", { error: e.message });
  }

  let counterHypothesesResult = null;
  if (dreResult && dreResult.candidates.length > 0) {
    try {
      counterHypothesesResult = await generateCounterHypotheses(dreResult.candidates, { serverState, message });
      emit("counter_hypotheses_result", { result: counterHypothesesResult });
    } catch (e) {
      console.warn("[orchestrator] Counter-hypotheses failed:", e.message);
    }
  } else {
    console.warn("[orchestrator] Skipping counter-hypotheses: no DRE candidates");
  }

  // 5b. DREV — Pairwise Verification (graceful degradation)
  let drevResult = null;
  let drevExplain = null;
  if (dreResult && dreResult.candidates.length >= 2) {
    try {
      drevResult = await drev.verify(dreResult.candidates, { io, socketId, serverState });
      drevExplain = explainDREV(drevResult);
      emit("drev_result", { result: drevResult, explainability: drevExplain });
      if (drevResult.degraded) degradations.push("DREV: score-based fallback");
    } catch (e) {
      console.warn("[orchestrator] DREV failed:", e.message);
      degradations.push(`DREV: ${e.message}`);
      emit("drev_error", { error: e.message });
    }
  }

  // 5c. CRDS — Resource Reaction Scoring (graceful degradation)
  let crdsResult = null;
  let crdsExplain = null;
  const crdsAction = drevResult?.winner?.description || primaryStep.args?.command || primaryStep.name || message;
  try {
    crdsResult = await crds.scoreReaction(crdsAction, serverState, { io, socketId });
    crdsExplain = explainCRDS(crdsResult);
    emit("crds_result", { result: crdsResult, explainability: crdsExplain });
  } catch (e) {
    console.warn("[orchestrator] CRDS failed:", e.message);
    degradations.push(`CRDS: ${e.message}`);
    emit("crds_error", { error: e.message });
  }

  // 5d. Emit degradation indicators if any
  if (degradations.length > 0) {
    emit("degradation_indicator", { degradations, count: degradations.length });
  }

  // 6. Authorization routing (with CRDS veto awareness)
  let authorization;
  let results = [];

  if (crdsResult?.vetoed) {
    // CRDS cascade veto — block execution
    authorization = "blocked_crds_veto";
    await audit({
      operation: "block",
      actor: user.username ? `human:${user.username}` : "agent",
      target: pipeline.action || message,
      target_type: "command",
      reasoning: `CRDS cascade veto: ${crdsResult.veto_reason}`,
      confidence: pipeline.confidence,
      safResult: saf,
      result: "blocked",
    });
    await storeDecisionMemory(action_id, message, plan, pipeline, decisionMass, "blocked");
  } else if (!saf.passed) {
    // SAF blocked — do not execute, even if pipeline authorized
    authorization = "blocked_saf";
    await audit({
      operation: "block",
      actor: user.username ? `human:${user.username}` : "agent",
      target: pipeline.action || message,
      target_type: "command",
      reasoning: `SAF blocked: ${JSON.stringify(saf.layers)}`,
      confidence: pipeline.confidence,
      safResult: saf,
      result: "blocked",
    });
    await memory.store("M6", `SAF blocked action: ${pipeline.action}`, {
      error_type: "saf_block",
      pattern_hash: require("crypto").createHash("md5").update(pipeline.action || message).digest("hex"),
    });
    await storeDecisionMemory(action_id, message, plan, pipeline, decisionMass, "blocked");
  } else if (pipeline.authorization_type === "auto") {
    authorization = "auto_executed";

    await usms.transitionState(problemObject.object_id, usms.STATE_LIFECYCLE.EXECUTING);

    const predictionId = `pred_${action_id}_${Date.now()}`;
    const prediction = {
      action: primaryStep.name,
      args: primaryStep.args,
      confidence: pipeline.confidence,
      risk_level: pipeline.risk_level
    };

    await walkForwardValidator.recordPrediction(predictionId, prediction, {
      system_state: serverState,
      decision_mass: decisionMass
    });

    try {
      if (twin && twin.twin_id) {
        const simulationResult = await simulationBroker.runSimulation(twin.twin_id, {
          action: primaryStep.name,
          args: primaryStep.args
        });

        emit("simulation_result", { result: simulationResult });

        if (simulationResult.results && simulationResult.results.risk_level === 'high') {
          authorization = "blocked_simulation_risk";
          await storeDecisionMemory(action_id, message, plan, pipeline, decisionMass, "blocked");
        }
      }
    } catch (e) {
      console.warn("[orchestrator] Simulation failed:", e.message);
    }

    if (authorization === "auto_executed") {
      const workflowDefinition = {
        name: `workflow_${action_id}`,
        description: `Execute action: ${primaryStep.name}`,
        tasks: plan.map(step => ({
          name: step.name,
          inputs: step.args,
          execution_mode: 'sequential'
        }))
      };

      const workflow = await workflowEngine.createWorkflow(workflowDefinition);
      const execution = await workflowEngine.executeWorkflow(workflow.workflow_id, {
        serverState,
        user
      });

      for (const taskResult of execution.results) {
        results.push({ step: taskResult, result: taskResult.result });

        // Log each AI-executed command to persistent terminal
        const cmdName = taskResult.name || taskResult.taskName || "unknown";
        const cmdResult = taskResult.result || {};
        const cmdOutput = cmdResult.stdout || cmdResult.stderr || cmdResult.output || JSON.stringify(cmdResult).slice(0, 500);
        const cmdExit = cmdResult.exit_code ?? cmdResult.exitCode ?? (cmdResult.success === false ? -1 : 0);
        addTerminalLog({
          command: `[AI] ${cmdName}`,
          output: typeof cmdOutput === "string" ? cmdOutput : JSON.stringify(cmdOutput),
          exitCode: cmdExit,
          source: "ai",
          io,
        }).catch(() => {});
      }

      if (execution.status === 'completed') {
        await walkForwardValidator.recordOutcome(predictionId, {
          success: true,
          execution_time: execution.completed_at ? new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime() : 0
        }, serverState);
      }

      const trustScore = await trustCalibrationEngine.calculateTrustScore('orchestrator', {
        confidence: pipeline.confidence,
        evidence_count: dreResult?.candidates?.length || 0
      });

      emit("trust_score", { score: trustScore });

      const performanceAnalysis = await optimizationEngine.analyzePerformance(action_id, {
        time_cost_ms: execution.completed_at ? new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime() : 0,
        result: execution.status
      });

      if (performanceAnalysis.bottlenecks.length > 0) {
        const optimizations = await optimizationEngine.generateOptimizations(performanceAnalysis, {
          action_type: primaryStep.name
        });
        emit("optimization_recommendations", { optimizations });
      }

      await audit({
        operation: "execute",
        actor: "agent",
        target: pipeline.action || message,
        target_type: "command",
        reasoning: pipeline.reasoning,
        confidence: pipeline.confidence,
        safResult: saf,
        result: "success",
      });
      await storeDecisionMemory(action_id, message, plan, pipeline, decisionMass, "success");

      await usms.transitionState(problemObject.object_id, usms.STATE_LIFECYCLE.COMPLETED);
    }
  } else if (pipeline.authorization_type === "human_approval_required") {
    authorization = "human_approval_required";
    const pending = await createPendingAction({
      plan,
      confidence: pipeline.confidence,
      risk_level: pipeline.risk_level,
      saf,
      actor: user.username ? `human:${user.username}` : "agent",
      source,
      io,
      decisionContext: {
        decision_mass: decisionMass,
        dre: dreResult,
        drev: drevResult,
        crds: crdsResult,
        degradations,
        explainability: { dre: dreExplain, drev: drevExplain, crds: crdsExplain },
      },
    });
    action_id = pending.action_id;
    await storeDecisionMemory(action_id, message, plan, pipeline, decisionMass, "pending");
  } else {
    authorization = "blocked_escalate";
    await audit({
      operation: "block",
      actor: "agent",
      target: pipeline.action || message,
      target_type: "command",
      reasoning: `low confidence (${pipeline.confidence}) — escalated`,
      confidence: pipeline.confidence,
      safResult: saf,
      result: "blocked",
    });
    await storeDecisionMemory(action_id, message, plan, pipeline, decisionMass, "escalated");
  }

  // Record prediction for calibration (after storeDecisionMemory ensures m4_execution row exists).
  try {
    await recordPrediction(action_id, pipeline.confidence, "success");
  } catch (e) {
    console.warn("[orchestrator] recordPrediction failed:", e.message);
  }

  // 6b. Emit a final, user-facing response summary for the dashboard/AI Assistant.
  const finalSummary = buildFinalSummary(message, intent, authorization, results);
  if (finalSummary) {
    emit("response_stream", { chunk: finalSummary });
  }

  // 6c. Persist the conversation turn so the AI remembers this exchange.
  await storeConversationTurn({
    user: user.username,
    message,
    response: finalSummary || pipeline.reasoning || pipeline.stages.answer || "",
    intent,
    action_id,
  }).catch(() => {});

  // 7. Claude Critique — store decision tuple for quality tracking
  if (authorization === "auto_executed" || authorization === "human_approval_required") {
    try {
      await critique.storeDecisionTuple({
        action_id,
        node: primaryStep.name || pipeline.action || "unknown",
        magnitude: decisionMass.di,
        confidence: pipeline.confidence,
        latency: crdsResult?.temporal_window_seconds || 0,
        outcome: authorization === "auto_executed" ? "success" : "pending",
        dqComponents: {
          evidence_completeness: dreResult?.coverage?.coverage || 0.5,
          confidence_calibration: 0.5, // Updated after outcome
          stakeholder_alignment: 0.7,
          reversibility: decisionMass.tier === "small" ? 0.9 : decisionMass.tier === "medium" ? 0.7 : 0.4,
        },
      });
    } catch (e) {
      console.warn("[orchestrator] critique store failed:", e.message);
    }
  }

  emit("action_update", {
    stage: "complete",
    action_id,
    intent,
    confidence: pipeline.confidence,
    risk_level: pipeline.risk_level,
    authorization,
    decision_mass: decisionMass,
    dre: dreResult ? { candidates: dreResult.candidates.length, coverage: dreResult.coverage?.coverage, degraded: dreResult.degraded } : null,
    drev: drevResult ? { winner: drevResult.winner?.approach, cr: drevResult.cr, robustness: drevResult.robustness, degraded: drevResult.degraded } : null,
    crds: crdsResult ? { rrs: crdsResult.rrs, vetoed: crdsResult.vetoed, temporal_window: crdsResult.temporal_window_seconds } : null,
    counter_hypotheses: counterHypothesesResult ? { count: counterHypothesesResult.length } : null,
    degradations,
    results,
  });

  await ueb.publish('action_completed', {
    action_id,
    authorization,
    confidence: pipeline.confidence,
    timestamp: new Date().toISOString()
  }, { source: 'orchestrator' });

  return {
    action_id,
    intent,
    plan,
    confidence: pipeline.confidence,
    risk_level: pipeline.risk_level,
    authorization,
    reasoning: finalSummary || pipeline.reasoning,
    saf,
    decision_mass: decisionMass,
    dre: dreResult,
    drev: drevResult,
    crds: crdsResult,
    counter_hypotheses: counterHypothesesResult,
    explainability: {
      dre: dreExplain,
      drev: drevExplain,
      crds: crdsExplain,
    },
    degradations,
    results,
    problem_object_id: problemObject.object_id,
    twin_id: twin ? twin.twin_id : null,
  };
}

// Build a simple tool-call plan from intent + pipeline action.
// (The richer Qwen-driven plan via action-planner.js is used by the
// /api/agent-rich route; this keeps the synchronous path deterministic.)
function buildPlan(intent, pipeline) {
  const ents = intent.entities || {};
  const plan = [];
  switch (intent.intent) {
    case "monitor":
      if (/cpu|ram|disk|health/i.test(intent.summary || "")) plan.push({ name: "get_server_health", args: {} });
      if (ents.target && /port/i.test(ents.target)) plan.push({ name: "check_ports", args: {} });
      if (ents.target && /process/i.test(ents.target)) plan.push({ name: "list_processes", args: { sort_by: "cpu", limit: 20 } });
      if (!plan.length) plan.push({ name: "get_server_health", args: {} });
      break;
    case "command":
      if (ents.command) plan.push({ name: "execute_command", args: { command: ents.command } });
      break;
    case "file":
      if (ents.path) plan.push({ name: ents.command === "write" ? "write_file" : "read_file", args: { path: ents.path, content: ents.content } });
      break;
    case "security":
      plan.push({ name: "run_security_scan", args: { tool: ents.tool || "rkhunter" } });
      break;
    case "deploy":
      if (ents.repo_url) plan.push({ name: "git_clone", args: { repo_url: ents.repo_url, dest: ents.dest || "/tmp/deploy" } });
      break;
    case "capacity_planning":
      // No tool action needed; the reasoning itself is the deliverable.
      plan.push({ name: "capacity_estimate", args: { note: "estimate only — no mutation" } });
      break;
    default:
      // Fall back to a health check so the agent always does something observable
      plan.push({ name: "get_server_health", args: {} });
  }
  return plan;
}

function generateActionId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `act_${ts}_${rand}`;
}

function buildFinalSummary(message, intent, authorization, results) {
  if (!results || results.length === 0) return null;
  const first = results[0].result;
  if (!first || !first.outputs) return null;

  const out = first.outputs;
  if (intent.intent === "monitor" && out.serverState) {
    const s = out.serverState;
    const cpu = typeof s.cpu === "number" ? `${s.cpu.toFixed(1)}%` : s.cpu;
    const ram = typeof s.ram === "number" ? `${s.ram.toFixed(1)}%` : s.ram;
    const disk = typeof s.disk === "number" ? `${s.disk.toFixed(1)}%` : s.disk;
    return `Server health: CPU ${cpu}, RAM ${ram}, disk ${disk}. All systems are within normal operating ranges.`;
  }
  if (authorization === "human_approval_required") {
    return `I've prepared a plan for "${message}". Please review and approve it in the approvals panel.`;
  }
  return `Done. Action "${message}" completed successfully.`;
}

async function storeDecisionMemory(actionId, context, plan, pipeline, decisionMass, outcomeResult) {
  const pool = require("../db/pool");
  const primaryStep = plan[0] || {};

  // Ensure m4_execution row exists before m5_decision (FK).
  const actionType = String(primaryStep.name || pipeline.action || "unknown").slice(0, 50);
  await pool.query(
    `INSERT INTO m4_execution (
       action_id, action_type, action_detail, result, saf_passed, human_approved
     ) VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (action_id) DO UPDATE SET
       action_type = EXCLUDED.action_type,
       action_detail = EXCLUDED.action_detail,
       result = EXCLUDED.result,
       saf_passed = EXCLUDED.saf_passed,
       human_approved = EXCLUDED.human_approved`,
    [
      actionId,
      actionType,
      JSON.stringify(plan),
      outcomeResult,
      true,
      outcomeResult === "pending",
    ]
  );

  await pool.query(
    `INSERT INTO m5_decision (
       action_id, context, alternatives_json, confidence, dq_score,
       decision_mass_json, chosen_action, reasoning, risk_level, outcome_result
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (action_id) DO UPDATE SET
       context = EXCLUDED.context,
       alternatives_json = EXCLUDED.alternatives_json,
       confidence = EXCLUDED.confidence,
       dq_score = EXCLUDED.dq_score,
       decision_mass_json = EXCLUDED.decision_mass_json,
       chosen_action = EXCLUDED.chosen_action,
       reasoning = EXCLUDED.reasoning,
       risk_level = EXCLUDED.risk_level,
       outcome_result = EXCLUDED.outcome_result`,
    [
      actionId,
      context,
      JSON.stringify(plan.map((p) => p.name)),
      pipeline.confidence,
      pipeline.dq_score ?? null,
      JSON.stringify(decisionMass),
      String(primaryStep.name || pipeline.action || "unknown").slice(0, 100),
      pipeline.reasoning,
      pipeline.risk_level,
      outcomeResult,
    ]
  );
}

/**
 * AI Function Calling - Select and execute command from command matrix
 */
async function handleAICommandExecution(message, user = { username: "agent", role: "admin" }) {
  const commandExecutor = new CommandExecutor();
  
  try {
    // Get command matrix for AI reference
    const commandMatrix = commandExecutor.getCommandMatrixForAI();
    
    // Build prompt with command matrix
    const prompt = `${FUNCTION_CALLING_PROMPT}

AVAILABLE COMMANDS:
${JSON.stringify(commandMatrix.commands, null, 2)}

USER REQUEST: ${message}

Select the appropriate command and return JSON.`;

    // Call Qwen to select command using guardedCreate
    // Use token-aware model rotation to stay within free tier limits
    const selectedModel = selectModel('ai_command_execution');
    console.log(`[orchestrator] Using model ${selectedModel} for AI command execution`);
    
    const res = await guardedCreate(qwen, {
      model: selectedModel,
      messages: [
        { role: "system", content: FUNCTION_CALLING_PROMPT },
        { role: "user", content: `AVAILABLE COMMANDS:\n${JSON.stringify(commandMatrix.commands, null, 2)}\n\nUSER REQUEST: ${message}\n\nSelect the appropriate command and return JSON.` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: getMaxOutputTokens("ai_command_execution"),
    }, { module: "ai-command-execution", taskType: "ai_command_execution" });
    
    const qwenResponse = res.choices[0].message.content;
    
    // Parse Qwen response
    let commandSelection;
    try {
      commandSelection = JSON.parse(qwenResponse);
    } catch (error) {
      console.error('[orchestrator] Failed to parse Qwen command selection:', error);
      return {
        success: false,
        error: 'Failed to parse AI command selection',
        raw_response: qwenResponse
      };
    }

    // Check if no command matched
    if (commandSelection.command_id === 'no_match') {
      return {
        success: false,
        error: 'No matching command found',
        reasoning: commandSelection.reasoning
      };
    }

    // Execute the command
    const executionResult = await commandExecutor.executeCommand(
      commandSelection.command_id,
      commandSelection.parameters
    );

    return {
      success: executionResult.success,
      command_id: commandSelection.command_id,
      command_name: commandSelection.command_name,
      parameters: commandSelection.parameters,
      risk_level: commandSelection.risk_level,
      requires_approval: commandSelection.requires_approval,
      reasoning: commandSelection.reasoning,
      confidence: commandSelection.confidence,
      execution: executionResult
    };

  } catch (error) {
    console.error('[orchestrator] AI command execution failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { handleAgentMessage, handleAICommandExecution };
