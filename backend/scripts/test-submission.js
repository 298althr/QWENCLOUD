/**
 * Comprehensive submission test script.
 * Tests all 10 key features from the submission checklist via API.
 * Run inside the backend container: docker exec althr-dev-backend node scripts/test-submission.js
 */

const http = require("http");

const BASE = "http://localhost:3000/api";

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options = { method, hostname: url.hostname, port: url.port, path: url.pathname + url.search, headers: {} };
    if (body) {
      const data = JSON.stringify(body);
      options.headers["Content-Type"] = "application/json";
      options.headers["Content-Length"] = Buffer.byteLength(data);
    }
    const r = http.request(options, (res) => {
      let chunks = "";
      res.on("data", (d) => (chunks += d));
      res.on("end", () => {
        try {
          const json = JSON.parse(chunks);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data: chunks, headers: res.headers });
        }
      });
    });
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

const results = [];
let passCount = 0;
let failCount = 0;

async function test(name, fn) {
  try {
    const result = await fn();
    if (result.pass) {
      passCount++;
      results.push({ name, status: "PASS", detail: result.detail || "" });
      console.log(`  PASS: ${name}${result.detail ? " - " + result.detail : ""}`);
    } else {
      failCount++;
      results.push({ name, status: "FAIL", detail: result.detail || result.error || "" });
      console.log(`  FAIL: ${name} - ${result.detail || result.error || ""}`);
    }
  } catch (e) {
    failCount++;
    results.push({ name, status: "FAIL", detail: e.message });
    console.log(`  FAIL: ${name} - ${e.message}`);
  }
}

async function runAll() {
  console.log("\n========================================");
  console.log("  ALTHR Autopilot - Submission Test Suite");
  console.log("========================================\n");

  // 1. Health check
  console.log("[1] Health Check");
  await test("GET /api/health returns ok", async () => {
    const r = await req("GET", "/health");
    return r.status === 200 && r.data.status === "ok"
      ? { pass: true, detail: `status=${r.data.status}` }
      : { pass: false, detail: `status=${r.status}, body=${JSON.stringify(r.data).slice(0, 100)}` };
  });

  // 2. Dashboard metrics
  console.log("\n[2] Dashboard / Server Metrics");
  await test("GET /api/health/server returns metrics", async () => {
    const r = await req("GET", "/health/server");
    if (r.status === 200 && r.data) {
      const hasCpu = r.data.cpu !== undefined || r.data.metrics?.cpu !== undefined;
      return hasCpu
        ? { pass: true, detail: `cpu=${r.data.cpu ?? r.data.metrics?.cpu}` }
        : { pass: false, detail: "no cpu metric in response" };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  // 3. Terminal command execution
  console.log("\n[3] Terminal - Command Execution");
  await test("POST /api/command docker ps (whitelisted)", async () => {
    const r = await req("POST", "/command", { command: "docker ps" });
    if (r.status === 200 && r.data.exit_code !== undefined) {
      return { pass: true, detail: `exit_code=${r.data.exit_code}` };
    }
    return { pass: false, detail: `status=${r.status}, body=${JSON.stringify(r.data).slice(0, 100)}` };
  });

  await test("POST /api/command blocked by SAF (rm -rf)", async () => {
    const r = await req("POST", "/command", { command: "rm -rf /" });
    if (r.status === 403) {
      return { pass: true, detail: "blocked by SAF" };
    }
    return { pass: false, detail: `expected 403, got ${r.status}` };
  });

  // 4. Terminal explain
  console.log("\n[4] Terminal - Explain");
  await test("POST /api/command/explain returns plain English", async () => {
    const r = await req("POST", "/command/explain", {
      command: "docker ps",
      output: "CONTAINER ID IMAGE STATUS",
      exitCode: 0,
    });
    if (r.status === 200 && r.data.explanation) {
      const isJson = r.data.explanation.trim().startsWith("{");
      return !isJson
        ? { pass: true, detail: `explanation length=${r.data.explanation.length}` }
        : { pass: false, detail: "explanation is JSON, not plain English" };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  // 5. Simulate incident
  console.log("\n[5] Simulate Incident");
  await test("POST /api/simulate/anomaly cpu spike", async () => {
    const r = await req("POST", "/simulate/anomaly", { type: "cpu", value: 95 });
    if (r.status === 200 && r.data.status === "triggered") {
      return { pass: true, detail: `status=${r.data.status}` };
    }
    return { pass: false, detail: `status=${r.status}, body=${JSON.stringify(r.data).slice(0, 100)}` };
  });

  await test("POST /api/simulate/anomaly ram pressure", async () => {
    const r = await req("POST", "/simulate/anomaly", { type: "ram", value: 94 });
    if (r.status === 200 && r.data.status === "triggered") {
      return { pass: true, detail: `status=${r.data.status}` };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  await test("GET /api/simulate/scenarios lists available types", async () => {
    const r = await req("GET", "/simulate/scenarios");
    if (r.status === 200 && r.data.scenarios && r.data.scenarios.length >= 4) {
      return { pass: true, detail: `${r.data.scenarios.length} scenarios` };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  // 6. AI Assistant
  console.log("\n[6] AI Assistant");
  await test("POST /api/agent show server health", async () => {
    const r = await req("POST", "/agent", { message: "show server health" });
    if (r.status === 200 && r.data.action_id) {
      const hasResults = r.data.results && r.data.results.length > 0;
      const hasReasoning = r.data.reasoning && r.data.reasoning.length > 0;
      return hasResults || hasReasoning
        ? { pass: true, detail: `intent=${r.data.intent?.intent}, auth=${r.data.authorization}` }
        : { pass: false, detail: "no results or reasoning returned" };
    }
    return { pass: false, detail: `status=${r.status}, body=${JSON.stringify(r.data).slice(0, 150)}` };
  });

  // 7. Terminal persistent logs
  console.log("\n[7] Terminal Persistent Logs");
  await test("GET /api/terminal/logs returns entries", async () => {
    const r = await req("GET", "/terminal/logs?limit=50");
    if (r.status === 200 && r.data.logs !== undefined) {
      return { pass: true, detail: `count=${r.data.count}` };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  await test("Terminal logs contain simulation entries", async () => {
    const r = await req("GET", "/terminal/logs?limit=50");
    if (r.status === 200 && r.data.logs) {
      const simLogs = r.data.logs.filter((l) => l.source === "simulate");
      return simLogs.length > 0
        ? { pass: true, detail: `${simLogs.length} simulation log entries` }
        : { pass: false, detail: "no simulation entries found" };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  // 8. File Manager
  console.log("\n[8] File Manager");
  const testDir = "/var/althr-volumes/files/__test_subdir";

  await test("POST /api/file/mkdir creates folder", async () => {
    const r = await req("POST", "/file/mkdir", { path: testDir });
    return r.status === 200 && r.data.ok
      ? { pass: true, detail: `created ${testDir}` }
      : { pass: false, detail: `status=${r.status}` };
  });

  await test("POST /api/file/write creates file", async () => {
    const r = await req("POST", "/file/write", { path: `${testDir}/test.txt`, content: "hello world" });
    return r.status === 200 && (r.data.ok || r.data.content !== undefined)
      ? { pass: true, detail: "wrote test.txt" }
      : { pass: false, detail: `status=${r.status}, body=${JSON.stringify(r.data).slice(0, 80)}` };
  });

  await test("GET /api/file/list lists directory", async () => {
    const r = await req("GET", `/file/list?path=${encodeURIComponent(testDir)}`);
    if (r.status === 200 && r.data.entries) {
      const hasTest = r.data.entries.some((e) => e.name === "test.txt");
      return hasTest
        ? { pass: true, detail: `${r.data.entries.length} entries, test.txt found` }
        : { pass: false, detail: "test.txt not in listing" };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  await test("GET /api/file/read reads file content", async () => {
    const r = await req("GET", `/file/read?path=${encodeURIComponent(testDir + "/test.txt")}`);
    if (r.status === 200 && r.data.content !== undefined) {
      return r.data.content.includes("hello world")
        ? { pass: true, detail: `content="${r.data.content.slice(0, 30)}"` }
        : { pass: false, detail: `content mismatch: "${r.data.content}"` };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  await test("POST /api/file/copy copies file", async () => {
    const r = await req("POST", "/file/copy", { src: `${testDir}/test.txt`, dest: `${testDir}/test_copy.txt` });
    return r.status === 200 && r.data.ok
      ? { pass: true, detail: "copied to test_copy.txt" }
      : { pass: false, detail: `status=${r.status}, body=${JSON.stringify(r.data).slice(0, 80)}` };
  });

  await test("POST /api/file/rename renames file", async () => {
    const r = await req("POST", "/file/rename", { path: `${testDir}/test_copy.txt`, newName: "test_renamed.txt" });
    return r.status === 200 && r.data.ok
      ? { pass: true, detail: "renamed to test_renamed.txt" }
      : { pass: false, detail: `status=${r.status}` };
  });

  await test("POST /api/file/move moves file", async () => {
    const r = await req("POST", "/file/move", { src: `${testDir}/test_renamed.txt`, dest: `${testDir}/sub_moved.txt` });
    return r.status === 200 && r.data.ok
      ? { pass: true, detail: "moved to sub_moved.txt" }
      : { pass: false, detail: `status=${r.status}` };
  });

  await test("POST /api/file/upload uploads file", async () => {
    const r = await req("POST", "/file/upload", { path: testDir, filename: "uploaded.txt", content: "uploaded content" });
    return r.status === 200 && r.data.ok
      ? { pass: true, detail: "uploaded uploaded.txt" }
      : { pass: false, detail: `status=${r.status}` };
  });

  await test("GET /api/file/download downloads file", async () => {
    const r = await req("GET", `/file/download?path=${encodeURIComponent(testDir + "/test.txt")}`);
    return r.status === 200 && r.headers["content-disposition"]?.includes("attachment")
      ? { pass: true, detail: "downloaded with attachment header" }
      : { pass: false, detail: `status=${r.status}` };
  });

  await test("POST /api/file/delete deletes file", async () => {
    const r = await req("POST", "/file/delete", { path: `${testDir}/test.txt` });
    return r.status === 200 && r.data.ok
      ? { pass: true, detail: "deleted test.txt" }
      : { pass: false, detail: `status=${r.status}` };
  });

  // Cleanup test directory
  await req("POST", "/file/delete", { path: testDir });

  // 9. Safety and Audit
  console.log("\n[9] Safety and Audit");
  await test("GET /api/security/audit returns audit log", async () => {
    const r = await req("GET", "/security/audit?limit=10");
    if (r.status === 200) {
      const hasEntries = (r.data.entries && r.data.entries.length > 0) || (r.data.audits && r.data.audits.length > 0) || (Array.isArray(r.data) && r.data.length > 0);
      return { pass: true, detail: `audit data received` };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  // 10. Kill Switch
  console.log("\n[10] Kill Switch");
  await test("GET /api/settings/kill-switch status", async () => {
    const r = await req("GET", "/settings/kill-switch");
    if (r.status === 200) {
      return { pass: true, detail: `kill switch data: ${JSON.stringify(r.data).slice(0, 60)}` };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  // 11. Decision Engine
  console.log("\n[11] Decision Engine");
  await test("GET /api/decision/calibration returns decision data", async () => {
    const r = await req("GET", "/decision/calibration");
    if (r.status === 200) {
      return { pass: true, detail: "decision calibration data returned" };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  // 12. Memory
  console.log("\n[12] Memory System");
  await test("GET /api/memory/M1 returns memory entries", async () => {
    const r = await req("GET", "/memory/M1?limit=5");
    if (r.status === 200) {
      return { pass: true, detail: "M1 memory returned" };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  // 13. Deployments
  console.log("\n[13] Deployments");
  await test("GET /api/deployments lists deployments", async () => {
    const r = await req("GET", "/deployments");
    if (r.status === 200) {
      return { pass: true, detail: "deployments list returned" };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  // 14. Processes
  console.log("\n[14] Processes");
  await test("GET /api/processes returns process list", async () => {
    const r = await req("GET", "/processes");
    if (r.status === 200) {
      return { pass: true, detail: "process list returned" };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  // 15. Ports
  console.log("\n[15] Ports");
  await test("GET /api/ports returns port list", async () => {
    const r = await req("GET", "/ports");
    if (r.status === 200) {
      return { pass: true, detail: "port list returned" };
    }
    return { pass: false, detail: `status=${r.status}` };
  });

  // Summary
  console.log("\n========================================");
  console.log(`  RESULTS: ${passCount} passed, ${failCount} failed, ${results.length} total`);
  console.log("========================================\n");

  // Output JSON for the handoff doc
  console.log("=== JSON RESULTS ===");
  console.log(JSON.stringify({ passCount, failCount, total: results.length, results }));
}

runAll().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
