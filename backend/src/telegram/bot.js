// backend/src/telegram/bot.js
// Telegram bot interface for ALTHR Autopilot.
// - Free text -> agent pipeline (same as /api/agent)
// - /start, /status, /approve, /reject, /memory, /security, /deploy,
//   /containers, /logs, /config, /analytics, /cancel
// - Inline keyboard buttons for human-in-the-loop approvals.
//
// Only starts if TELEGRAM_BOT_TOKEN is set.

const TelegramBot = require("node-telegram-bot-api");
const { handleAgentMessage } = require("../pipeline/orchestrator");
const { listPending, approveAction, rejectAction } = require("../pipeline/approvals");
const { getServerHealth } = require("../qwen/toolExecutor");
const { queryAudit } = require("../utils/audit");
const memory = require("../memory/store");

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
      "ALTHR Autopilot online. Send a natural-language command, or use /status, /deploy, /security, /memory, /approve."
    );
  });

  bot.onText(/^\/status/, async (msg) => {
    if (!allowedFilter(msg)) return;
    try {
      const h = await getServerHealth();
      bot.sendMessage(
        msg.chat.id,
        `Server health:\nCPU: ${h.cpu}%\nRAM: ${h.ram}% (${h.ram_used_mb}/${h.ram_total_mb} MB)\nDisk: ${h.disk}%\nUptime: ${h.uptime}s`
      );
    } catch (e) {
      bot.sendMessage(msg.chat.id, `status error: ${e.message}`);
    }
  });

  bot.onText(/^\/pending/, (msg) => {
    if (!allowedFilter(msg)) return;
    const pending = listPending();
    if (!pending.length) return bot.sendMessage(msg.chat.id, "No pending approvals.");
    pending.forEach((p) => sendApprovalKeyboard(msg.chat.id, p));
  });

  bot.onText(/^\/memory(?:\s+(\w+))?/, async (msg, match) => {
    if (!allowedFilter(msg)) return;
    const layer = (match?.[1] || "M6").toUpperCase();
    try {
      const res = await memory.query(layer, { limit: 5 });
      const text = res.rows
        .map((r) => `- ${JSON.stringify(r).slice(0, 200)}`)
        .join("\n") || "(empty)";
      bot.sendMessage(msg.chat.id, `Memory ${layer} (${res.count}):\n${text}`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, `memory error: ${e.message}`);
    }
  });

  bot.onText(/^\/audit/, async (msg) => {
    if (!allowedFilter(msg)) return;
    try {
      const rows = await queryAudit({ limit: 5 });
      const text = rows.map((r) => `[${r.timestamp}] ${r.operation} ${r.actor} -> ${r.target}`.slice(0, 200)).join("\n") || "(empty)";
      bot.sendMessage(msg.chat.id, `Audit (last 5):\n${text}`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, `audit error: ${e.message}`);
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
      try { serverState = await getServerHealth(); } catch { serverState = {}; }
      const result = await handleAgentMessage({
        message: msg.text,
        serverState,
        user: { username: `tg:${msg.from.id}`, role: "admin" },
        io,
        source: "telegram",
      });

      const summary =
        `Intent: ${result.intent.intent} (${(result.confidence * 100).toFixed(0)}%)\n` +
        `Risk: ${result.risk_level} · ${result.authorization}\n` +
        `${result.intent.summary || ""}`;

      if (result.authorization === "human_approval_required" && result.action_id) {
        sendApprovalKeyboard(chatId, {
          action_id: result.action_id,
          plan: result.plan,
          confidence: result.confidence,
          risk_level: result.risk_level,
        });
      } else {
        bot.sendMessage(chatId, summary);
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
