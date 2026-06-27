// backend/src/qwen/intent-parser.js
// NL -> structured JSON intent via qwen3.7-plus Chat Completions (structured output).

const { qwen, MODELS } = require("./client");

const SYSTEM_PROMPT = `You are the intent parser for ALTHR Autopilot, an AI server operations agent.
Convert the user's natural-language message into a structured JSON intent.
Recognised intent categories:
- "command"        : run a shell command
- "monitor"        : inspect processes / ports / health / resources
- "deploy"         : deploy an app from a git repo with Docker
- "security"       : run a security scan or audit
- "file"           : read / write / list files
- "memory"         : query or store agent memory
- "diagnose"       : investigate an anomaly / root cause
- "other"          : anything not covered above

Return STRICT JSON with this shape:
{
  "intent": "<category>",
  "confidence": 0.0-1.0,
  "summary": "<one-line restatement of what the user wants>",
  "entities": { "command": "...", "path": "...", "repo_url": "...", "tool": "...", "target": "..." }
}
Only include entity keys that are relevant. Do not include markdown fences.`;

async function parseIntent(userMessage) {
  const res = await qwen.chat.completions.create({
    model: MODELS.PLUS,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  const raw = res.choices[0].message.content;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`intent parser returned non-JSON: ${raw}`);
  }
  return parsed;
}

module.exports = { parseIntent };
