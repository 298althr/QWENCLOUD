const { exec } = require("child_process");

function execWithTimeout(cmd, ms) {
  return new Promise((resolve) => {
    exec(cmd, { timeout: ms, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      resolve(stdout.trim().split("\n"));
    });
  });
}

async function getTopProcesses(limit = 20) {
  const out = await execWithTimeout(
    "ps aux --sort=-%cpu --no-headers | head -" + limit,
    8000
  );
  return out.map((line) => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 11) return null;
    const user = parts[0];
    const pid = Number(parts[1]);
    const cpu = Number(parts[2]);
    const mem = Number(parts[3]);
    const command = parts.slice(10).join(" ");
    const name = command.split("/").pop().split(" ")[0] || command;
    return { pid, name, cpu, mem, command, user };
  }).filter(Boolean);
}

async function getTopMemProcesses(limit = 20) {
  const out = await execWithTimeout(
    "ps aux --sort=-%mem --no-headers | head -" + limit,
    8000
  );
  return out.map((line) => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 11) return null;
    const user = parts[0];
    const pid = Number(parts[1]);
    const cpu = Number(parts[2]);
    const mem = Number(parts[3]);
    const command = parts.slice(10).join(" ");
    const name = command.split("/").pop().split(" ")[0] || command;
    return { pid, name, cpu, mem, command, user };
  }).filter(Boolean);
}

async function getListeningPorts() {
  const out = await execWithTimeout(
    "ss -tlnp 2>/dev/null | tail -n +2 || netstat -tlnp 2>/dev/null | tail -n +3",
    5000
  );
  return out.map((line) => {
    const parts = line.trim().split(/\s+/);
    const localAddr = parts[4] || parts[1] || "";
    const port = localAddr.split(":").pop();
    const pidMatch = line.match(/pid=(\d+)/);
    return {
      localPort: Number(port) || 0,
      protocol: "tcp",
      pid: pidMatch ? Number(pidMatch[1]) : 0,
      state: "LISTEN",
    };
  }).filter((p) => p.localPort > 0);
}

module.exports = { getTopProcesses, getTopMemProcesses, getListeningPorts };
