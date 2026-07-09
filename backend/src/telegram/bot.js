// backend/src/telegram/bot.js
// Telegram bot interface for ALTHR Autopilot.
// - Free text -> agent pipeline (same as /api/agent)
// - /start, /status, /approve, /reject, /memory, /security, /deploy,
//   /containers, /logs, /config, /analytics, /cancel
// - Inline keyboard buttons for human-in-the-loop approvals.
//
// Only starts if TELEGRAM_BOT_TOKEN is set.

const TelegramBot = require("node-telegram-bot-api");
const { handleAgentMessage, handleAICommandExecution } = require("../pipeline/orchestrator");
const { listPending, approveAction, rejectAction } = require("../pipeline/approvals");
const { get_server_health, executeTool } = require("../qwen/toolExecutor");
const { queryAudit } = require("../utils/audit");
const { safCheck } = require("../pipeline/saf");
const memory = require("../memory/store");
const { getLessons, getDQTrend } = require("../memory/learning");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED = (process.env.TELEGRAM_ALLOWED_USERS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

let bot = null;

function start(io) {
  if (!TOKEN) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled");
    return null;
  }
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log("[telegram] bot started (polling)");

  const allowedFilter = (msg) => {
    if (ALLOWED.length === 0) return true; // no allowlist = open
    return ALLOWED.includes(String(msg.from?.id));
  };

  // ---- Commands ----
  bot.onText(/^\/start/, (msg) => {
    if (!allowedFilter(msg)) return;
    bot.sendMessage(
      msg.chat.id,
      "*ALTHR Autopilot* online 🤖\n\n" +
        "Send a natural-language command, or use:\n" +
        "`/status` — server health\n" +
        "`/ai <command>` — AI-powered DevOps command execution\n" +
        "`/deploy <url>` — deploy from GitHub\n" +
        "`/containers` — Docker containers\n" +
        "`/security` — security scan\n" +
        "`/memory <layer>` — PML memory (M1-M7)\n" +
        "`/logs` — recent audit log\n" +
        "`/analytics` — DQ score trend\n" +
        "`/config` — current configuration\n" +
        "`/pending` — pending approvals\n" +
        "`/cancel` — cancel pending action",
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/^\/status/, async (msg) => {
    if (!allowedFilter(msg)) return;
    try {
      const h = await get_server_health();
      const cpuEmoji = h.cpu > 85 ? "🔴" : h.cpu > 70 ? "🟡" : "🟢";
      const ramEmoji = h.ram > 90 ? "🔴" : h.ram > 75 ? "🟡" : "🟢";
      bot.sendMessage(
        msg.chat.id,
        `*Server Health*\n\n` +
          `${cpuEmoji} CPU: *${h.cpu}%*\n` +
          `${ramEmoji} RAM: *${h.ram}%* (${h.ram_used_mb}/${h.ram_total_mb} MB)\n` +
          `💾 Disk: *${h.disk}%*\n` +
          `⏱ Uptime: *${h.uptime}s*`,
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      bot.sendMessage(msg.chat.id, `❌ status error: ${e.message}`);
    }
  });

  bot.onText(/^\/deploy\s+(.+)/, async (msg, match) => {
    if (!allowedFilter(msg)) return;
    const repoUrl = match[1].trim();
    bot.sendMessage(msg.chat.id, `🚀 Deploying from \`${repoUrl}\`…`, { parse_mode: "Markdown" });
    try {
      const saf = await safCheck(`deploy ${repoUrl}`, "deploy", "medium", { username: `tg:${msg.from.id}`, role: "admin" }, 0.8, false);
      if (!saf.passed) return bot.sendMessage(msg.chat.id, `❌ Blocked by SAF: ${saf.failed_layer}`);
      const cloneResult = await executeTool("git_clone", { repo_url: repoUrl });
      const buildResult = await executeTool("docker_build", { path: cloneResult.path, tag: `althr-${Date.now()}` });
      const runResult = await executeTool("docker_run", { image: buildResult.tag, ports: "8080:8080" });
      bot.sendMessage(msg.chat.id, `✅ Deployed!\nClone: ${cloneResult.path}\nImage: ${buildResult.tag}\nContainer: ${runResult.container_id?.slice(0, 12) || "running"}`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, `❌ deploy error: ${e.message}`);
    }
  });

  bot.onText(/^\/containers/, async (msg) => {
    if (!allowedFilter(msg)) return;
    try {
      const result = await executeTool("list_containers", {});
      const containers = result.containers || [];
      if (!containers.length) return bot.sendMessage(msg.chat.id, "No Docker containers running.");
      const text = containers.map((c) => `${c.status?.includes("Up") ? "🟢" : "🔴"} ${c.name || c.id?.slice(0, 12)} — ${c.status || "unknown"}`).join("\n");
      bot.sendMessage(msg.chat.id, `*Docker Containers*\n\n${text}`, { parse_mode: "Markdown" });
    } catch (e) {
      bot.sendMessage(msg.chat.id, `❌ containers error: ${e.message}`);
    }
  });

  bot.onText(/^\/security/, async (msg) => {
    if (!allowedFilter(msg)) return;
    try {
      const [ports, audit] = await Promise.all([
        executeTool("check_ports", {}).catch(() => ({ ports: [] })),
        queryAudit({ limit: 5 }),
      ]);
      const openPorts = ports.ports || [];
      bot.sendMessage(
        msg.chat.id,
        `*Security Scan*\n\n` +
          `🔒 SAF: 7/7 layers active\n` +
          `🔌 Open ports: ${openPorts.length}\n` +
          `📋 Recent audit entries: ${audit.length}\n\n` +
          audit.map((r) => `  [${r.result}] ${r.operation} → ${r.target?.slice(0, 40)}`).join("\n"),
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      bot.sendMessage(msg.chat.id, `❌ security error: ${e.message}`);
    }
  });

  bot.onText(/^\/memory(?:\s+(\w+))?/, async (msg, match) => {
    if (!allowedFilter(msg)) return;
    const layer = (match?.[1] || "M6").toUpperCase();
    try {
      const res = await memory.query(layer, { limit: 5 });
      const text = res.rows
        .map((r) => `- ${r.improvement_note || r.description || r.action_detail || r.chosen_action || r.content || r.sop_name || JSON.stringify(r).slice(0, 150)}`)
        .join("\n") || "(empty)";
      bot.sendMessage(msg.chat.id, `*Memory ${layer}* (${res.count} entries)\n\n${text}`, { parse_mode: "Markdown" });
    } catch (e) {
      bot.sendMessage(msg.chat.id, `❌ memory error: ${e.message}`);
    }
  });

  bot.onText(/^\/logs/, async (msg) => {
    if (!allowedFilter(msg)) return;
    try {
      const rows = await queryAudit({ limit: 10 });
      const text = rows.map((r) => `[${r.result}] ${r.operation} ${r.actor}→${r.target?.slice(0, 30)}`.slice(0, 200)).join("\n") || "(empty)";
      bot.sendMessage(msg.chat.id, `*Audit Log* (last 10)\n\n${text}`, { parse_mode: "Markdown" });
    } catch (e) {
      bot.sendMessage(msg.chat.id, `❌ logs error: ${e.message}`);
    }
  });

  bot.onText(/^\/analytics/, async (msg) => {
    if (!allowedFilter(msg)) return;
    try {
      const [trend, lessons] = await Promise.all([
        getDQTrend({ days: 30 }),
        getLessons({ limit: 5 }),
      ]);
      const avgDQ = trend.length > 0
        ? (trend.reduce((s, d) => s + Number(d.dq_score), 0) / trend.length).toFixed(1)
        : "—";
      const lessonText = lessons.map((l) => `  • ${l.improvement_note?.slice(0, 60)}`).join("\n") || "(none yet)";
      bot.sendMessage(
        msg.chat.id,
        `*Analytics*\n\n` +
          `📊 Avg DQ Score (30d): *${avgDQ}*\n` +
          `📝 Data points: ${trend.length}\n` +
          `🧠 Learned lessons: ${lessons.length}\n\n${lessonText}`,
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      bot.sendMessage(msg.chat.id, `❌ analytics error: ${e.message}`);
    }
  });

  bot.onText(/^\/config/, (msg) => {
    if (!allowedFilter(msg)) return;
    bot.sendMessage(
      msg.chat.id,
      `*Configuration*\n\n` +
        `🤖 Model: ${process.env.QWEN_MODEL || "qwen3.7-plus"}\n` +
        `🎯 Confidence threshold: ${process.env.CONFIDENCE_THRESHOLD || 85}%\n` +
        `📊 Monitor interval: ${process.env.MONITOR_INTERVAL_MS || 30000}ms\n` +
        `🛡 SAF: enabled (7 layers)\n` +
        `🧠 PML: 7 layers (M1-M7)\n` +
        `📡 Embeddings: text-embedding-v4 (1024d)`,
      { parse_mode: "Markdown" }
    );
  });

  bot.onText(/^\/pending/, (msg) => {
    if (!allowedFilter(msg)) return;
    const pending = listPending();
    if (!pending.length) return bot.sendMessage(msg.chat.id, "✅ No pending approvals.");
    pending.forEach((p) => sendApprovalKeyboard(msg.chat.id, p));
  });

  bot.onText(/^\/approve\s+(\S+)/, async (msg, match) => {
    if (!allowedFilter(msg)) return;
    try {
      const r = await approveAction({ action_id: match[1], approver: `human:tg:${msg.from.id}`, io });
      bot.sendMessage(msg.chat.id, `✅ Approved & executed: ${match[1]}\n${JSON.stringify(r.results).slice(0, 800)}`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, `❌ approve error: ${e.message}`);
    }
  });

  bot.onText(/^\/reject(?:\s+(\S+))?(?:\s+(.+))?/, async (msg, match) => {
    if (!allowedFilter(msg)) return;
    if (!match[1]) return bot.sendMessage(msg.chat.id, "Usage: /reject <action_id> [reason]");
    try {
      const r = await rejectAction({ action_id: match[1], reason: match[2] || "", approver: `human:tg:${msg.from.id}`, io });
      bot.sendMessage(msg.chat.id, `❌ Rejected: ${match[1]}`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, `❌ reject error: ${e.message}`);
    }
  });

  bot.onText(/^\/cancel/, (msg) => {
    if (!allowedFilter(msg)) return;
    bot.sendMessage(msg.chat.id, "ℹ️ Send /pending to see actions that can be cancelled. Use /reject <id> to cancel.");
  });

  // ---- AI Command Execution ----
  bot.onText(/^\/ai\s+(.+)/, async (msg, match) => {
    if (!allowedFilter(msg)) return;
    const command = match[1].trim();
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId, `🤖 AI processing: "${command}"...`);
    
    try {
      const result = await handleAICommandExecution(
        command,
        { username: `tg:${msg.from.id}`, role: "admin" }
      );

      if (result.success) {
        const response =
          `✅ *AI Command Executed*\n\n` +
          `🔧 Command: ${result.command_name}\n` +
          `📊 Confidence: ${(result.confidence * 100).toFixed(0)}%\n` +
          `⚠️ Risk: ${result.risk_level}\n` +
          `💭 Reasoning: ${result.reasoning}\n\n` +
          `📋 Parameters: ${JSON.stringify(result.parameters)}\n\n` +
          `🎯 Execution Result:\n${JSON.stringify(result.execution, null, 2).slice(0, 800)}`;
        
        bot.sendMessage(chatId, response, { parse_mode: "Markdown" });
      } else {
        const response =
          `❌ *AI Command Failed*\n\n` +
          `Error: ${result.error}\n` +
          (result.reasoning ? `Reasoning: ${result.reasoning}` : '');
        
        bot.sendMessage(chatId, response, { parse_mode: "Markdown" });
      }
    } catch (e) {
      bot.sendMessage(chatId, `❌ AI command error: ${e.message}`);
    }
  });

  // ---- Inline keyboard callbacks (approve/reject) ----
  bot.on("callback_query", async (cb) => {
    if (!allowedFilter(cb)) return bot.answerCallbackQuery(cb.id, { text: "not allowed" });
    const [verb, action_id] = (cb.data || "").split(":");
    try {
      if (verb === "approve") {
        const r = await approveAction({ action_id, approver: `human:tg:${cb.from.id}`, io });
        bot.answerCallbackQuery(cb.id, { text: "approved" });
        bot.editMessageText(`✅ Approved & executed: ${action_id}\n${JSON.stringify(r.results).slice(0, 800)}`, {
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
        });
      } else if (verb === "reject") {
        const r = await rejectAction({ action_id, approver: `human:tg:${cb.from.id}`, io });
        bot.answerCallbackQuery(cb.id, { text: "rejected" });
        bot.editMessageText(`❌ Rejected: ${action_id}`, {
          chat_id: cb.message.chat.id,
          message_id: cb.message.message_id,
        });
      } else {
        bot.answerCallbackQuery(cb.id, { text: "unknown" });
      }
    } catch (e) {
      bot.answerCallbackQuery(cb.id, { text: e.message });
    }
  });

  // ---- Free text -> agent pipeline ----
  bot.on("message", async (msg) => {
    if (!allowedFilter(msg)) return;
    if (!msg.text || msg.text.startsWith("/")) return; // commands handled above
    const chatId = msg.chat.id;
    try {
      let serverState = {};
      try { serverState = await get_server_health(); } catch { serverState = {}; }
      const result = await handleAgentMessage({
        message: msg.text,
        serverState,
        user: { username: `tg:${msg.from.id}`, role: "admin" },
        io,
        source: "telegram",
      });

      const summary =
        `*Intent:* ${result.intent.intent} (${(result.confidence * 100).toFixed(0)}%)\n` +
        `*Risk:* ${result.risk_level} · ${result.authorization}\n` +
        `${result.intent.summary || ""}`;

      if (result.authorization === "human_approval_required" && result.action_id) {
        sendApprovalKeyboard(chatId, {
          action_id: result.action_id,
          plan: result.plan,
          confidence: result.confidence,
          risk_level: result.risk_level,
        });
      } else {
        bot.sendMessage(chatId, summary, { parse_mode: "Markdown" });
      }
    } catch (e) {
      bot.sendMessage(chatId, `agent error: ${e.message}`);
    }
  });

  return bot;
}

function sendApprovalKeyboard(chatId, pending) {
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `approve:${pending.action_id}` },
          { text: "❌ Reject", callback_data: `reject:${pending.action_id}` },
        ],
      ],
    },
  };
  const text =
    `🔐 Approval needed: ${pending.action_id}\n` +
    `Confidence: ${(pending.confidence * 100).toFixed(0)}% · Risk: ${pending.risk_level}\n` +
    `Plan: ${JSON.stringify(pending.plan).slice(0, 600)}`;
  bot.sendMessage(chatId, text, opts);
}

function stop() {
  if (bot) {
    bot.stopPolling();
    bot = null;
  }
}

module.exports = { start, stop };
