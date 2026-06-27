// backend/src/qwen/toolExecutor.js
// Dispatches Qwen function-calling tool invocations to real implementations.
// Each handler returns a JSON-serializable result string (per OpenAI tool-call convention).

const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const si = require("systeminformation");

const { isCommandAllowed } = require("../config/allowed-commands");
const { safCheck } = require("../pipeline/saf");
const memory = require("../memory/store");

// ---- helpers ----

function runShell(command, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    exec(command, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      const time_ms = Date.now() - t0;
      if (err) {
        resolve({
          exit_code: err.code ?? 1,
          stdout: stdout?.toString() ?? "",
          stderr: (stderr?.toString() ?? "") + (err.killed ? " [timeout]" : ""),
          time_ms,
        });
      } else {
        resolve({ exit_code: 0, stdout: stdout.toString(), stderr: stderr.toString(), time_ms });
      }
    });
  });
}

// ---- tool handlers ----

async function execute_command({ command, timeout = 10000 }) {
  if (!isCommandAllowed(command)) {
    return { exit_code: 126, stdout: "", stderr: "blocked: command not in SAF whitelist", time_ms: 0 };
  }
  return runShell(command, timeout);
}

async function read_file({ path: p }) {
  try {
    const content = fs.readFileSync(p, "utf8");
    return { ok: true, path: p, content };
  } catch (e) {
    return { ok: false, path: p, error: e.message };
  }
}

async function write_file({ path: p, content }) {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, "utf8");
    return { ok: true, path: p, bytes: content.length };
  } catch (e) {
    return { ok: false, path: p, error: e.message };
  }
}

async function list_processes({ sort_by = "cpu", limit = 50 }) {
  const procs = await si.processes();
  const rows = procs.list
    .slice()
    .sort((a, b) => (b[sort_by] ?? 0) - (a[sort_by] ?? 0))
    .slice(0, limit)
    .map((p) => ({ pid: p.pid, name: p.name, cpu: p.cpu, mem: p.mem }));
  return { processes: rows, count: rows.length };
}

async function check_ports() {
  try {
    const ports = await si.networkConnections();
    const listening = ports
      .filter((c) => c.state === "LISTEN")
      .map((c) => ({ port: c.localPort, pid: c.pid, protocol: c.protocol, state: c.state, localAddress: c.localAddress }));
    return { ports: listening, count: listening.length };
  } catch (e) {
    return { ports: [], error: e.message };
  }
}

async function docker_build({ dockerfile, tag, timeout = 120000 }) {
  // Build via a temp Dockerfile + `docker build`. SAF must have cleared this.
  const tmpDir = path.join(require("os").tmpdir(), "althr-build-" + Date.now());
  fs.mkdirSync(tmpDir, { recursive: true });
  const dockerfilePath = path.join(tmpDir, "Dockerfile");
  fs.writeFileSync(dockerfilePath, dockerfile, "utf8");
  const res = await runShell(`docker build -t ${tag} -f "${dockerfilePath}" .`, timeout);
  return { tag, ...res };
}

async function git_clone({ repo_url, dest }) {
  const res = await runShell(`git clone ${repo_url} ${dest ? `"${dest}"` : ""}`, 60000);
  return { repo_url, dest, ...res };
}

async function run_security_scan({ tool }) {
  if (tool === "rkhunter") return runShell("rkhunter --check --sk", 120000);
  if (tool === "lynis") return runShell("lynis audit system --quick", 120000);
  return { exit_code: 1, stderr: `unknown scan tool: ${tool}` };
}

async function get_server_health() {
  const [cpuLoad, mem, fsSize, time] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.time(),
  ]);
  const disk = fsSize[0] ? { used: fsSize[0].used, total: fsSize[0].size, percent: fsSize[0].use } : null;
  return {
    cpu: Number(cpuLoad.currentLoad.toFixed(2)),
    ram: Number(((mem.used / mem.total) * 100).toFixed(2)),
    ram_used_mb: Math.round(mem.used / 1024 / 1024),
    ram_total_mb: Math.round(mem.total / 1024 / 1024),
    disk: disk ? disk.percent : null,
    uptime: time.uptime,
  };
}

async function saf_check({ action, target, risk_level }) {
  // Default actor = agent; full wiring uses authenticated user in Day 3.
  return safCheck(action, target, risk_level, { username: "agent", role: "admin" }, 0.9, false);
}

async function query_memory({ layer, query, limit = 10 }) {
  return memory.query(layer, { query, limit });
}

async function store_memory({ layer, content, metadata = {} }) {
  return memory.store(layer, content, metadata);
}

// ---- dispatcher ----

const HANDLERS = {
  execute_command,
  read_file,
  write_file,
  list_processes,
  check_ports,
  docker_build,
  git_clone,
  run_security_scan,
  get_server_health,
  saf_check,
  query_memory,
  store_memory,
};

async function executeTool(name, args) {
  const handler = HANDLERS[name];
  if (!handler) return { error: `unknown tool: ${name}` };
  try {
    return await handler(args || {});
  } catch (e) {
    return { error: e.message, tool: name };
  }
}

module.exports = { executeTool, HANDLERS };
