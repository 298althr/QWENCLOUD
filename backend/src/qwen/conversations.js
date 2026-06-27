// backend/src/qwen/conversations.js
// Qwen Conversations API wrapper for cross-device session continuity.
// Same conversation_id works across Telegram and the web dashboard.
//
// NOTE: The Conversations API is exposed via the Responses endpoint
// (qwenResponses client). We persist the mapping in qwen_conversations.

const { qwenResponses, MODELS } = require("./client");
const { query } = require("../db/pool");

/**
 * Create a new Qwen conversation and persist the mapping.
 * @param {{userId?:number, source:"telegram"|"dashboard"}} opts
 * @returns {Promise<{conversationId:string, dbId:number}>}
 */
async function createConversation({ userId = null, source = "dashboard" } = {}) {
  // The Conversations API exposes conversation management via the responses client.
  // We create a conversation id locally (server-managed context) and store it.
  // On supported Qwen endpoints, conversations.create() returns a managed id.
  let conversationId;
  try {
    const conv = await qwenResponses.conversations.create({
      name: `althr-${source}-${Date.now()}`,
    });
    conversationId = conv.id || conv.conversation_id;
  } catch {
    // Fallback: generate a stable id; the Responses API will treat the
    // `conversation` param as an opaque session key when the managed API
    // is unavailable.
    conversationId = `althr_conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  const res = await query(
    `INSERT INTO qwen_conversations (conversation_id, user_id, source)
     VALUES ($1, $2, $3) RETURNING id`,
    [conversationId, userId, source]
  );
  return { conversationId, dbId: res.rows[0].id };
}

/**
 * Look up an existing conversation for a user+source, or create one.
 */
async function getOrCreateConversation({ userId = null, source = "dashboard" } = {}) {
  const existing = await query(
    `SELECT id, conversation_id FROM qwen_conversations
     WHERE user_id IS NOT DISTINCT FROM $1 AND source = $2
     ORDER BY last_active DESC LIMIT 1`,
    [userId, source]
  );
  if (existing.rows.length) {
    return { conversationId: existing.rows[0].conversation_id, dbId: existing.rows[0].id };
  }
  return createConversation({ userId, source });
}

/**
 * Send a message into a conversation using the Responses API with the
 * `conversation` parameter so Qwen manages context server-side.
 */
async function sendInConversation({ conversationId, message, instructions }) {
  const params = {
    model: MODELS.PLUS,
    input: message,
  };
  if (conversationId) params.conversation = conversationId;
  if (instructions) params.instructions = instructions;
  const res = await qwenResponses.responses.create(params);
  // Touch last_active
  await query(
    `UPDATE qwen_conversations SET last_active = NOW() WHERE conversation_id = $1`,
    [conversationId]
  ).catch(() => {});
  return res;
}

module.exports = { createConversation, getOrCreateConversation, sendInConversation };
