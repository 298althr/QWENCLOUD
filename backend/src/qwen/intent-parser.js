// backend/src/qwen/intent-parser.js
// SOS Architecture Mapping:
// - SOS V3 (Problem Understanding): Problem Compiler - converts natural language to structured problem
// - SOS V3 (Problem Understanding): Context Compiler - transforms scattered information into structured context
//
// NL -> structured JSON intent via qwen3.7-plus Chat Completions (structured output).

const { qwen, selectModel } = require("./client");
const { guardedCreate, getMaxOutputTokens } = require("./guardrails");
const { INTENT_PARSER_PROMPT } = require("./prompts");

const SYSTEM_PROMPT = INTENT_PARSER_PROMPT;

async function parseIntent(userMessage) {
  const res = await guardedCreate(qwen, {
    model: selectModel("intent"),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: getMaxOutputTokens("intent"),
  }, { module: "intent-parser", taskType: "intent" });
  const raw = res.choices[0].message.content;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // Model sometimes returns plain text instead of JSON (especially when it
    // wants to ask clarifying questions). Recover gracefully.
    console.warn("[intent-parser] Non-JSON response; recovering:", raw.slice(0, 200));
    parsed = buildClarificationIntent(userMessage, raw);
  }

  // Some models return valid JSON but put a clarifying message in an "error"
  // field instead of the expected schema. Normalize that.
  const hasClarifyingQuestions = Array.isArray(parsed.clarifying_questions) && parsed.clarifying_questions.length > 0;
  if (parsed.error || parsed.needs_clarification || hasClarifyingQuestions) {
    const text = typeof parsed.error === "string"
      ? parsed.error
      : parsed.clarifying_questions?.join(" ") || raw;
    parsed = buildClarificationIntent(userMessage, text, parsed);
  }

  // If the model hallucinated a response (e.g., fake health metrics) and ignored
  // the intent schema, recover using the user message.
  if (!parsed.intent) {
    const inferred = inferIntentFromText(userMessage);
    const needsClarification = inferred === "capacity_planning" || inferred === "other";
    parsed = {
      intent: inferred,
      confidence: 0.5,
      summary: (parsed.summary || parsed.status || userMessage).trim().slice(0, 80),
      needs_clarification: needsClarification,
      clarifying_questions: needsClarification ? extractQuestions(parsed.summary || parsed.status || raw) : [],
      entities: extractEntities(userMessage, inferred),
    };
  }

  return parsed;
}

function extractEntities(message, intent) {
  const entities = {};
  const lower = message.toLowerCase();
  if (intent === "command") {
    const m = message.match(/(?:run|execute|run\s+the\s+command)\s+["']?([^"'\n]+)["']?/i);
    if (m) entities.command = m[1].trim();
  }
  if (intent === "deploy") {
    const m = message.match(/(https?:\/\/[^\s]+)/i);
    if (m) entities.repo_url = m[1];
  }
  if (intent === "file") {
    const m = message.match(/(?:file|path)\s+["']?([^"'\n]+)["']?/i);
    if (m) entities.path = m[1].trim();
  }
  if (intent === "diagnose" || intent === "capacity_planning") {
    entities.target = message;
  }
  return entities;
}

function buildClarificationIntent(userMessage, text, base = {}) {
  return {
    intent: base.intent || inferIntentFromText(userMessage),
    confidence: typeof base.confidence === "number" ? base.confidence : 0.5,
    summary: text.trim().slice(0, 80),
    needs_clarification: true,
    clarifying_questions: extractQuestions(text),
    entities: base.entities || {},
  };
}

function inferIntentFromText(message) {
  const lower = message.toLowerCase();
  if (/capacity|how many|can i run|apps? can|users/i.test(lower)) return "capacity_planning";
  if (/health|cpu|ram|disk|status/i.test(lower)) return "monitor";
  if (/restart|start|stop|deploy|build/i.test(lower)) return "command";
  if (/security|scan|audit/i.test(lower)) return "security";
  if (/file|read|write|path/i.test(lower)) return "file";
  if (/memory|lesson|learn/i.test(lower)) return "memory";
  return "other";
}

function extractQuestions(text) {
  // Pull out numbered questions or sentences ending in ?
  const questions = [];
  const numbered = text.match(/\d+\.\s+([^\n]+)/g);
  if (numbered) {
    numbered.forEach(q => questions.push(q.replace(/^\d+\.\s+/, "").trim()));
  }
  const inline = text.match(/[^.!?]*\?/g);
  if (inline) {
    inline.forEach(q => {
      const trimmed = q.trim();
      if (trimmed && !questions.includes(trimmed)) questions.push(trimmed);
    });
  }
  if (questions.length === 0 && text.trim()) {
    questions.push(text.trim());
  }
  return questions.slice(0, 5);
}

module.exports = { parseIntent };
