// backend/src/qwen/conversations.js
// Qwen cross-device session continuity via the Responses API.
//
// IMPORTANT: The Qwen "Conversations API" is NOT a separate resource.
// Multi-turn context is managed via the Responses API with the
// `previous_response_id` parameter. Each response returns an `id` that
// can be passed to the next call. Response IDs expire after 7 days.
//
// See: docs/GAP-ANALYSIS.md (GAP-1, GAP-2) for details.
// See: https://www.alibabacloud.com/help/en/model-studio/compatibility-with-openai-responses-api

const { qwen, MODELS } = require("./client");
const { query } = require("../db/pool");

/**
 * Create a new conversation session (first response in the chain).
 * Stores the session in qwen_conversations with the first response_id.
 *
 * @param {{userId?:number, source:"telegram"|"dashboard", firstMessage:string, instructions?:string}} opts
 * @returns {Promise<{dbId:number, responseId:string, outputText:string}>}
 */
async function startConversation({ userId = null, source = "dashboard", firstMessage, instructions }) {
  const params = {
    model: MODELS.PLUS,
    input: firstMessage,
  };
  if (instructions) params.instructions = instructions;

  const res = await qwen.responses.create(params);
  const responseId = res.id;

  // Persist the session with the first response_id
  const dbRes = await query(
    `INSERT INTO qwen_conversations (conversation_id, user_id, source, last_response_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [responseId, userId, source, responseId]
  );

  return {
    dbId: dbRes.rows[0].id,
    responseId,
    outputText: res.output_text,
  };
}

/**
 * Look up an existing conversation for a user+source.
 * Returns the last_response_id needed for previous_response_id continuity.
 */
async function getConversation({ userId = null, source = "dashboard" } = {}) {
  const res = await query(
    `SELECT id, conversation_id, last_response_id FROM qwen_conversations
     WHERE user_id IS NOT DISTINCT FROM $1 AND source = $2
     ORDER BY last_active DESC LIMIT 1`,
    [userId, source]
  );
  if (!res.rows.length) return null;
  return {
    dbId: res.rows[0].id,
    conversationId: res.rows[0].conversation_id,
    lastResponseId: res.rows[0].last_response_id,
  };
}

/**
 * Get or create a conversation. If one exists, returns its last_response_id.
 * If not, creates one with an optional greeting/initialization message.
 */
async function getOrCreateConversation({ userId = null, source = "dashboard", initMessage = "Session initialized." } = {}) {
  const existing = await getConversation({ userId, source });
  if (existing) return existing;
  const created = await startConversation({ userId, source, firstMessage: initMessage });
  return { dbId: created.dbId, conversationId: created.responseId, lastResponseId: created.responseId };
}

/**
 * Send a message into an existing conversation using previous_response_id
 * for server-managed context continuity.
 *
 * @param {{conversationId:string, message:string, instructions?:string}} opts
 * @returns {Promise<{responseId:string, outputText:string}>}
 */
async function sendInConversation({ conversationId, message, instructions }) {
  const params = {
    model: MODELS.PLUS,
    input: message,
    previous_response_id: conversationId,
  };
  if (instructions) params.instructions = instructions;

  const res = await qwen.responses.create(params);

  // Update the stored last_response_id so the chain continues
  await query(
    `UPDATE qwen_conversations
     SET last_response_id = $1, last_active = NOW()
     WHERE last_response_id = $2 OR conversation_id = $2`,
    [res.id, conversationId]
  ).catch(() => {});

  return { responseId: res.id, outputText: res.output_text };
}

module.exports = {
  startConversation,
  getConversation,
  getOrCreateConversation,
  sendInConversation,
};
