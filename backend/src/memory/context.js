// backend/src/memory/context.js
// Persistent context loader for the AI Assistant.
// Combines: recent conversation turns (M1/Redis), semantic memory (M6/M7),
// and the durable ai-context.log file.

const fs = require("fs");
const path = require("path");
const { store, query, semanticSearch } = require("./store");

const CONTEXT_LOG_DIR = "/var/althr-volumes";
const CONTEXT_LOG_PATH = path.join(CONTEXT_LOG_DIR, "ai-context.log");
const MAX_CONVERSATION_TURNS = 20;
const MAX_SEMANTIC_RESULTS = 10;
const MAX_LOG_TAIL_LINES = 20;

function ensureLogDir() {
  try {
    fs.mkdirSync(CONTEXT_LOG_DIR, { recursive: true });
  } catch (e) {
    console.warn("[context] cannot create log dir:", e.message);
  }
}

function formatLogLine(timestamp, actor, type, message) {
  return `${timestamp.toISOString()} | ${actor.padEnd(6)} | ${type.padEnd(12)} | ${message.replace(/\n/g, " ")}`;
}

function appendContextLog(actor, type, message) {
  ensureLogDir();
  try {
    const line = formatLogLine(new Date(), actor, type, message) + "\n";
    fs.appendFileSync(CONTEXT_LOG_PATH, line, "utf8");
  } catch (e) {
    console.warn("[context] append log failed:", e.message);
  }
}

function readContextLogTail(lines = MAX_LOG_TAIL_LINES) {
  ensureLogDir();
  try {
    if (!fs.existsSync(CONTEXT_LOG_PATH)) return [];
    const content = fs.readFileSync(CONTEXT_LOG_PATH, "utf8");
    return content.trim().split("\n").filter(Boolean).slice(-lines);
  } catch (e) {
    console.warn("[context] read log failed:", e.message);
    return [];
  }
}

async function storeConversationTurn({ user, message, response, intent, action_id }) {
  // M1 raw events
  try {
    await store("M1", `user: ${message}`, {
      event_type: "user_message",
      severity: "info",
      raw_data: { user, message, intent: intent?.intent, action_id },
    });
    await store("M1", `ai: ${response}`, {
      event_type: "ai_response",
      severity: "info",
      raw_data: { response, action_id },
    });
  } catch (e) {
    console.warn("[context] store M1 turn failed:", e.message);
  }

  // Durable log file
  appendContextLog("USER", "message", message);
  appendContextLog("AI", "response", response);

  // M6 learning: cache the Q&A pair for future context retrieval
  try {
    await store("M6", `Q: ${message}\nA: ${response}`, {
      action_id,
      error_type: intent?.intent || "general",
      pattern_hash: `qa-${Buffer.from(message).toString("base64").slice(0, 32)}`,
      improvement_note: `Q: ${message}\nA: ${response}`,
      reinforcement_count: 1,
    });
  } catch (e) {
    console.warn("[context] store M6 cache failed:", e.message);
  }
}

async function loadRecentConversationTurns(limit = MAX_CONVERSATION_TURNS) {
  try {
    const { rows } = await query("M1", { limit: limit * 2 }); // user + ai pairs
    // Pair user/ai messages into conversation turns
    const turns = [];
    let current = {};
    for (const row of rows) {
      const type = row.event_type;
      const content = row.content || row.raw_data?.content || row.raw_data?.message || row.raw_data?.response || "";
      if (type === "user_message") {
        if (current.user) turns.unshift(current);
        current = { user: content, ai: null, timestamp: row.timestamp };
      } else if (type === "ai_response") {
        if (!current.user) current = { user: "", ai: null, timestamp: row.timestamp };
        current.ai = content;
        turns.unshift(current);
        current = {};
      }
    }
    return turns.slice(-limit);
  } catch (e) {
    console.warn("[context] load conversation turns failed:", e.message);
    return [];
  }
}

async function loadSemanticMemory(queryString, limit = MAX_SEMANTIC_RESULTS) {
  try {
    const { results } = await semanticSearch(queryString, ["M6", "M7"], limit);
    return results.filter((r) => r.similarity > 0.6);
  } catch (e) {
    console.warn("[context] semantic search failed:", e.message);
    return [];
  }
}

async function buildContextForMessage(message) {
  const [turns, semantic, logTail] = await Promise.all([
    loadRecentConversationTurns(),
    loadSemanticMemory(message),
    readContextLogTail(),
  ]);

  const parts = [];

  if (logTail.length > 0) {
    parts.push(`=== LONG-TERM CONTEXT LOG ===\n${logTail.join("\n")}`);
  }

  if (turns.length > 0) {
    const history = turns
      .map((t, i) => `Turn ${i + 1}:\nUser: ${t.user}\nAI: ${t.ai || "(no response recorded)"}`)
      .join("\n\n");
    parts.push(`=== RECENT CONVERSATION (${turns.length} turns) ===\n${history}`);
  }

  if (semantic.length > 0) {
    const memory = semantic
      .map((r, i) => `[${i + 1}] ${r.layer} similarity ${r.similarity.toFixed(2)}: ${r.content || r.description || ""}`)
      .join("\n");
    parts.push(`=== SEMANTIC MEMORY ===\n${memory}`);
  }

  return parts.join("\n\n");
}

module.exports = {
  buildContextForMessage,
  storeConversationTurn,
  loadRecentConversationTurns,
  loadSemanticMemory,
  readContextLogTail,
  appendContextLog,
};
