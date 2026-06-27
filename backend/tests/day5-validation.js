// backend/tests/day5-validation.js
// Day 5 validation: learning loop, playbook auto-generation, M3 lookup,
// DQ trend, lessons endpoint.
// Run: node tests/day5-validation.js

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });

const { recordOutcome, lookupSOP, recordSOPResult, getLessons, getDQTrend } = require("../src/memory/learning");
const { pool } = require("../src/db/pool");

let pass = 0, fail = 0;
function ok(n) { pass++; console.log(`  ✓ ${n}`); }
function bad(n, e) { fail++; console.error(`  ✗ ${n}: ${e}`); }

async function main() {
  console.log("\n=== Day 5 Validation ===\n");

  // 1. Record a successful anomaly remediation → auto-generate SOP in M3
  console.log("[1] Record successful remediation → auto-generate M3 SOP");
  let sopId;
  try {
    const result = await recordOutcome({
      actionId: `act_test_${Date.now()}`,
      actionType: "command",
      actionDetail: "kill -9 12345 (node-worker consuming 95% CPU)",
      result: "success",
      safPassed: true,
      humanApproved: false,
      decision: {
        context: "CPU spike detected at 95%, node-worker PID 12345",
        chosenAction: "kill node-worker process",
        confidence: 0.88,
        reasoning: "Process consuming excessive CPU, killing is safest remediation",
        riskLevel: "low",
      },
      anomalyType: "cpu_spike",
      outcome: { result: "success", success: true, toolResults: [{ step: "kill", result: { exit_code: 0 } }] },
    });
    sopId = result.sopId;
    if (sopId) ok(`M3 SOP auto-generated (id=${sopId}), DQ score=${result.dqScore}`);
    else bad("SOP generation", "no sopId returned");
  } catch (e) { bad("SOP generation", e.message); }

  // 2. M3 lookup: same anomaly type should find the SOP
  console.log("\n[2] M3 lookup for 'cpu_spike' → finds the SOP");
  try {
    const { found, sop } = await lookupSOP("cpu_spike");
    if (found && sop) ok(`SOP found: "${sop.sop_name}" success_count=${sop.success_count}`);
    else bad("M3 lookup", "SOP not found");
  } catch (e) { bad("M3 lookup", e.message); }

  // 3. Record the same anomaly again → SOP success_count increments (no duplicate)
  console.log("\n[3] Same anomaly again → SOP reinforced (no duplicate)");
  try {
    const before = (await lookupSOP("cpu_spike")).sop;
    const beforeCount = before?.success_count || 0;
    await recordOutcome({
      actionId: `act_test2_${Date.now()}`,
      actionType: "command",
      actionDetail: "kill -9 12346 (node-worker consuming 92% CPU)",
      result: "success",
      safPassed: true,
      humanApproved: false,
      decision: { chosenAction: "kill node-worker", confidence: 0.9, riskLevel: "low" },
      anomalyType: "cpu_spike",
      outcome: { result: "success", success: true },
    });
    const after = (await lookupSOP("cpu_spike")).sop;
    if (after.success_count > beforeCount) ok(`SOP reinforced: success_count ${beforeCount} → ${after.success_count}`);
    else bad("SOP reinforcement", `count did not increment (${beforeCount} → ${after.success_count})`);
  } catch (e) { bad("SOP reinforcement", e.message); }

  // 4. M6 learning memory was stored with embedding
  console.log("\n[4] M6 learning memory stored (with embedding)");
  try {
    const { rows } = await pool.query(
      "SELECT id, improvement_note, embedding IS NOT NULL AS has_vec FROM m6_learning WHERE improvement_note LIKE '%cpu_spike%' ORDER BY id DESC LIMIT 1"
    );
    if (rows.length && rows[0].has_vec) ok(`M6 learning note stored with embedding: "${rows[0].improvement_note?.slice(0, 60)}…"`);
    else bad("M6 learning", `rows=${rows.length}, has_vec=${rows[0]?.has_vec}`);
  } catch (e) { bad("M6 learning", e.message); }

  // 5. Lessons endpoint returns learned patterns
  console.log("\n[5] getLessons() returns learned patterns");
  try {
    const lessons = await getLessons({ limit: 10 });
    if (lessons.length > 0) ok(`${lessons.length} lessons returned, top: "${lessons[0].improvement_note?.slice(0, 60)}…"`);
    else bad("lessons", "no lessons returned");
  } catch (e) { bad("lessons", e.message); }

  // 6. DQ trend returns score data
  console.log("\n[6] getDQTrend() returns DQ score trend");
  try {
    const trend = await getDQTrend({ days: 30 });
    if (Array.isArray(trend)) ok(`DQ trend returned ${trend.length} data point(s)`);
    else bad("DQ trend", `not an array: ${typeof trend}`);
  } catch (e) { bad("DQ trend", e.message); }

  // 7. Record a failure → M6 stores error learning note
  console.log("\n[7] Record failed remediation → M6 error learning note");
  try {
    const result = await recordOutcome({
      actionId: `act_fail_${Date.now()}`,
      actionType: "command",
      actionDetail: "systemctl restart nonexistent-service",
      result: "failure",
      safPassed: true,
      humanApproved: false,
      decision: { chosenAction: "restart service", confidence: 0.6, riskLevel: "medium" },
      anomalyType: "service_down",
      outcome: { result: "failure", success: false, toolResults: [{ result: { exit_code: 5 } }] },
    });
    if (result.m6Id) ok(`M6 error learning note stored (id=${result.m6Id})`);
    else bad("failure learning", "no m6Id");
  } catch (e) { bad("failure learning", e.message); }

  console.log(`\n=== Day 5 Result: ${pass} passed, ${fail} failed ===\n`);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("fatal:", e); process.exit(1); });
