// backend/tests/day3-validation.js
// Day 3 validation: end-to-end pipeline, SAF blocking, audit log, immutability.
// Run: node tests/day3-validation.js

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const { handleAgentMessage } = require("../src/pipeline/orchestrator");
const { safCheck } = require("../src/pipeline/saf");
const { audit, queryAudit } = require("../src/utils/audit");
const { query } = require("../src/db/pool");
const { getServerHealth } = require("../src/qwen/toolExecutor");

let pass = 0, fail = 0;
function ok(n) { pass++; console.log(`  ✓ ${n}`); }
function bad(n, e) { fail++; console.error(`  ✗ ${n}: ${e}`); }

async function main() {
  console.log("\n=== Day 3 Validation ===\n");

  // 1. SAF blocks dangerous command: "rm -rf /"
  console.log("[1] SAF blocks 'rm -rf /'");
  try {
    const saf = await safCheck("rm -rf /", "/", "high", { username: "agent", role: "admin" }, 0.99, false);
    if (!saf.passed) ok(`SAF blocked (L4=${saf.layers.L4.passed}, L6=${saf.layers.L6.passed})`);
    else bad("SAF block", "SAF passed a forbidden command");
  } catch (e) { bad("SAF block", e.message); }

  // 2. End-to-end: "show me server health" (low risk, should auto-execute or approve)
  console.log("\n[2] End-to-end: 'show server health'");
  try {
    let serverState = {};
    try { serverState = await getServerHealth(); } catch {}
    const result = await handleAgentMessage({
      message: "show me the server health",
      serverState,
      user: { username: "test", role: "admin" },
      source: "test",
    });
    ok(`intent=${result.intent.intent}, conf=${(result.confidence*100).toFixed(0)}%, auth=${result.authorization}`);
    if (result.results?.length) ok(`executed ${result.results.length} tool step(s)`);
  } catch (e) { bad("e2e health", e.message); }

  // 3. Audit log has entries
  console.log("\n[3] Audit log entries exist");
  try {
    const rows = await queryAudit({ limit: 5 });
    if (rows.length > 0) ok(`audit_log has ${rows.length} recent entr(y|ies)`);
    else bad("audit log", "no entries");
  } catch (e) { bad("audit log", e.message); }

  // 4. Audit log immutability — UPDATE should raise
  console.log("\n[4] Audit log immutability (UPDATE must raise)");
  try {
    const r = await query("SELECT id FROM audit_log ORDER BY id DESC LIMIT 1");
    if (!r.rows.length) { ok("skipped (no rows yet)"); }
    else {
      const id = r.rows[0].id;
      try {
        await query("UPDATE audit_log SET result = 'tampered' WHERE id = $1", [id]);
        bad("immutability", "UPDATE succeeded — trigger missing");
      } catch (e) {
        if (/immutable/i.test(e.message)) ok("UPDATE blocked by immutability trigger");
        else bad("immutability", `unexpected error: ${e.message}`);
      }
    }
  } catch (e) { bad("immutability", e.message); }

  // 5. Audit log immutability — DELETE should raise
  console.log("\n[5] Audit log immutability (DELETE must raise)");
  try {
    const r = await query("SELECT id FROM audit_log ORDER BY id DESC LIMIT 1");
    if (!r.rows.length) { ok("skipped (no rows yet)"); }
    else {
      const id = r.rows[0].id;
      try {
        await query("DELETE FROM audit_log WHERE id = $1", [id]);
        bad("immutability", "DELETE succeeded — trigger missing");
      } catch (e) {
        if (/immutable/i.test(e.message)) ok("DELETE blocked by immutability trigger");
        else bad("immutability", `unexpected error: ${e.message}`);
      }
    }
  } catch (e) { bad("immutability", e.message); }

  // 6. Conversations API — Responses API with previous_response_id
  console.log("\n[6] Conversations API (Responses API + previous_response_id)");
  try {
    const { startConversation, sendInConversation, getConversation } = require("../src/qwen/conversations");
    const c1 = await startConversation({
      source: "test",
      firstMessage: "My name is Alice. Remember it.",
      instructions: "You are ALTHR Autopilot, a server ops agent.",
    });
    const c2 = await sendInConversation({ conversationId: c1.responseId, message: "What is my name?" });
    const found = await getConversation({ source: "test" });
    const remembered = c2.outputText?.toLowerCase().includes("alice");
    if (remembered && found?.lastResponseId) ok(`cross-turn context works (remembered "Alice", last_response_id stored)`);
    else bad("conversations", `remembered=${remembered}, found=${!!found}`);
  } catch (e) { bad("conversations", e.message); }

  console.log(`\n=== Day 3 Result: ${pass} passed, ${fail} failed ===\n`);
  await require("../src/db/pool").pool.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
