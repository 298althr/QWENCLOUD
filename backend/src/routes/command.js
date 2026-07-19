// backend/src/routes/command.js
// POST /api/command — execute a shell command (goes through SAF)
// POST /api/command/explain — ask Qwen to explain a command + its output

const express = require("express");
const router = express.Router();
const { safCheck } = require("../pipeline/saf");
const { executeTool } = require("../qwen/toolExecutor");
const { audit } = require("../utils/audit");
const { logAction } = require("../utils/actionHistory");
const tokenTracker = require("../qwen/tokenTracker");
const { qwen, selectModel } = require("../qwen/client");
const { guardedCreate } = require("../qwen/guardrails");
const { addTerminalLog } = require("../utils/terminalLog");
const sandbox = require("../utils/sandbox");

router.post("/", async (req, res) => {
  const { command, timeout } = req.body || {};
  if (!command) return res.status(400).json({ error: "command is required" });

  const sandboxActive = sandbox.isActive();

  if (sandboxActive) {
    try {
      const result = await sandbox.wrapForSandbox(command, timeout || 10000);
      if (result) {
        await audit({ operation: "execute", actor: "api", target: command, target_type: "command", reasoning: "sandbox mode execution", safResult: { passed: true, reason: "sandbox mode" }, result: result.exit_code === 0 ? "success" : "failure" });
    logAction({ category: "command", action: "sandbox_execute", target: command, actor: "api", result: result.exit_code === 0 ? "success" : "failure", detail: result }).catch(() => {});

        const io = req.app.get("io");
        addTerminalLog({
          command: `[SANDBOX] ${command}`,
          output: result.stdout || result.stderr || "",
          exitCode: result.exit_code,
          source: "user",
          io,
        }).catch(() => {});

        return res.json({ ...result, sandboxed: true });
      }
    } catch (e) {
      return res.status(500).json({ error: e.message, sandboxed: true });
    }
  }

  const saf = await safCheck(command, "command", "low", { username: "api", role: "admin" }, 1.0, false);
  if (!saf.passed) {
    await audit({ operation: "block", actor: "api", target: command, target_type: "command", reasoning: "SAF blocked", safResult: saf, result: "blocked" });
    logAction({ category: "command", action: "blocked", target: command, actor: "api", result: "blocked", detail: saf }).catch(() => {});
    return res.status(403).json({ error: "blocked by SAF", saf });
  }

  try {
    const result = await executeTool("execute_command", { command, timeout: timeout || 10000 });
    await audit({ operation: "execute", actor: "api", target: command, target_type: "command", reasoning: "direct API call", safResult: saf, result: result.exit_code === 0 ? "success" : "failure" });
    logAction({ category: "command", action: "execute", target: command, actor: "api", result: result.exit_code === 0 ? "success" : "failure", detail: result }).catch(() => {});

    // Persist to terminal log and emit via WebSocket
    const io = req.app.get("io");
    addTerminalLog({
      command,
      output: result.stdout || result.stderr || "",
      exitCode: result.exit_code,
      source: "user",
      io,
    }).catch(() => {});

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/command/explain — explain a command and its output using Qwen
// Input: { command, output, exitCode }
// Output: { explanation, nextStep }
router.post("/explain", async (req, res) => {
  const { command, output, exitCode } = req.body || {};
  if (!command) return res.status(400).json({ error: "command is required" });

  // Kill switch check
  if (tokenTracker.isKillSwitchActive()) {
    const status = tokenTracker.getKillSwitchStatus();
    return res.status(423).json({ error: `AI kill switch active: ${status.reason}` });
  }

  const model = selectModel("simple");
  const truncatedOutput = (output || "").slice(0, 2000);

  const isSafBlocked = String(output || "").toLowerCase().includes("blocked by saf");
  const systemPrompt = `You are a DevOps assistant. A user ran a command and wants to understand the result. Write your response as plain English sentences that a junior engineer could read and understand. Do NOT use JSON, code blocks, structured data, or any format other than natural language paragraphs. Start with "This command" and explain in 2-3 sentences what the command did and what the output means. Then on a new line write "Next step: " followed by one recommended action, or "Next step: No action needed" if everything looks fine.${isSafBlocked ? " The command was blocked by the safety system (SAF). Explain what the command would have done and why it might have been blocked." : ""}`;

  const userPrompt = `Command: ${command}\nExit code: ${exitCode ?? "N/A"}\nOutput:\n${truncatedOutput}`;

  try {
    const response = await guardedCreate(qwen, {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 300,
      temperature: 0.3,
    }, { module: "command-explain", taskType: "simple" });

    const text = response.choices[0]?.message?.content || "";

    // Track token usage
    const usage = response.usage || {};
    tokenTracker.record({
      model,
      module: "command-explain",
      inputTokens: usage.prompt_tokens || tokenTracker.estimateTokens(systemPrompt + userPrompt),
      outputTokens: usage.completion_tokens || tokenTracker.estimateTokens(text),
    });

    // Split explanation and next step
    let explanation = text;
    let nextStep = "";
    const nextStepMatch = text.match(/(?:next step|recommendation|action)[:\s]*\s*(.+)$/i);
    if (nextStepMatch) {
      nextStep = nextStepMatch[1].trim();
      explanation = text.replace(nextStepMatch[0], "").trim();
    }

    // Strip any JSON-like content if the model still returned it
    explanation = explanation.replace(/^\{[^}]*\}$/s, "").trim();
    if (!explanation) explanation = text.trim();

    res.json({ explanation, nextStep, model, costTracked: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
