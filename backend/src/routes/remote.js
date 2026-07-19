// backend/src/routes/remote.js
// Remote server management via SSH.
// All actions are routed through the existing SAF whitelist and audit log.

const express = require("express");
const router = express.Router();
const { execRemote } = require("../remote/ssh");
const { listHosts, getHost, createHost, deleteHost } = require("../remote/hosts");
const { isCommandAllowed } = require("../config/allowed-commands");
const { safCheck } = require("../pipeline/saf");
const { audit } = require("../utils/audit");
const { logAction } = require("../utils/actionHistory");

const DEFAULT_TIMEOUT = 15000;

function getUser(req) {
  return req.user || { username: "api", role: "admin" };
}

// ---- helpers ----

function parseDockerPs(output) {
  const lines = output.trim().split("\n").filter(Boolean);
  return lines.map((line) => {
    try {
      const c = JSON.parse(line);
      return {
        id: c.ID,
        name: c.Names,
        image: c.Image,
        status: c.Status,
        ports: c.Ports,
      };
    } catch {
      return { raw: line };
    }
  });
}

function parseFindOutput(output, basePath) {
  // Format: name\ttype\tsize\n
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      const name = parts[0];
      const rawType = parts[1] || "f";
      const size = parts[2] ? parseInt(parts[2], 10) : 0;
      return {
        name,
        type: rawType === "d" ? "directory" : rawType === "l" ? "symlink" : "file",
        size,
        path: basePath === "." ? name : `${basePath}/${name}`,
      };
    });
}

function parseProcesses(output) {
  return output
    .trim()
    .split("\n")
    .slice(1) // skip header
    .filter(Boolean)
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        pid: parseInt(parts[0], 10) || 0,
        name: parts[1] || "",
        cpu: parseFloat(parts[2]) || 0,
        mem: parseFloat(parts[3]) || 0,
      };
    });
}

function parsePorts(output) {
  // Parse `ss -tlnp` output:
  // tcp   LISTEN  0  128  0.0.0.0:22  0.0.0.0:*  users:(("sshd",pid=1234))
  return output
    .trim()
    .split("\n")
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const local = parts[3] || "";
      const portMatch = local.match(/:(\d+)$/);
      const processMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)\)\)/);
      return {
        port: portMatch ? parseInt(portMatch[1], 10) : null,
        localAddress: local,
        protocol: parts[0] || "tcp",
        state: parts[1] || "LISTEN",
        process: processMatch ? processMatch[1] : null,
        pid: processMatch ? parseInt(processMatch[2], 10) : null,
      };
    })
    .filter((p) => p.port !== null);
}

function sanitizePath(p) {
  if (!p) return ".";
  // Reject paths that escape the filesystem root.
  const normalized = p.replace(/\\/g, "/");
  if (normalized.startsWith("..")) return ".";
  return normalized;
}

// ---- routes ----

router.get("/hosts", async (req, res) => {
  try {
    const hosts = await listHosts();
    res.json({ hosts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/hosts", async (req, res) => {
  const user = getUser(req);
  if (user.role !== "admin") {
    return res.status(403).json({ error: "insufficient role to create hosts" });
  }

  const { id, name, host, port, user: sshUser, privateKey } = req.body || {};
  
  if (!id || !name || !host || !sshUser) {
    return res.status(400).json({ error: "id, name, host, and user are required" });
  }

  try {
    await createHost({ id, name, host, port, user: sshUser, privateKey });
    await audit({
      operation: "create",
      actor: user.username,
      target: id,
      target_type: "remote_host",
      reasoning: "created remote host via API",
      result: "success"
    });
    logAction({ category: "remote", action: "create_host", target: id, actor: user.username, result: "success" }).catch(() => {});
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/hosts/:id", async (req, res) => {
  const user = getUser(req);
  if (user.role !== "admin") {
    return res.status(403).json({ error: "insufficient role to delete hosts" });
  }

  try {
    await deleteHost(req.params.id);
    await audit({
      operation: "delete",
      actor: user.username,
      target: req.params.id,
      target_type: "remote_host",
      reasoning: "deleted remote host via API",
      result: "success"
    });
    logAction({ category: "remote", action: "delete_host", target: req.params.id, actor: user.username, result: "success" }).catch(() => {});
    res.json({ success: true, id: req.params.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:hostId/command", async (req, res) => {
  const { command, timeout } = req.body || {};
  if (!command) return res.status(400).json({ error: "command is required" });
  if (!isCommandAllowed(command)) {
    await audit({
      operation: "block",
      actor: getUser(req).username,
      target: command,
      target_type: "command",
      reasoning: "command not in SAF whitelist",
      result: "blocked",
    });
    return res.status(403).json({ error: "command not in SAF whitelist" });
  }

  const saf = await safCheck(command, req.params.hostId, "medium", getUser(req), 0.9, false);
  if (!saf.passed) {
    await audit({
      operation: "block",
      actor: getUser(req).username,
      target: command,
      target_type: "command",
      reasoning: "SAF blocked",
      safResult: saf,
      result: "blocked",
    });
    return res.status(403).json({ error: "blocked by SAF", saf });
  }

  try {
    const host = getHost(req.params.hostId);
    const result = await execRemote(host, command, timeout || DEFAULT_TIMEOUT);
    await audit({
      operation: "execute",
      actor: getUser(req).username,
      target: `${host.id}:${command}`,
      target_type: "command",
      reasoning: "remote SSH command",
      safResult: saf,
      result: result.exit_code === 0 ? "success" : "failure",
    });
    logAction({ category: "remote", action: "command", target: `${host.id}:${command}`, actor: getUser(req).username, result: result.exit_code === 0 ? "success" : "failure", detail: result }).catch(() => {});
    res.json(result);
  } catch (e) {
    await audit({
      operation: "execute",
      actor: getUser(req).username,
      target: `${req.params.hostId}:${command}`,
      target_type: "command",
      reasoning: "remote SSH command failed",
      result: "failure",
    });
    res.status(500).json({ error: e.message, code: e.code });
  }
});

router.get("/:hostId/containers", async (req, res) => {
  try {
    const host = getHost(req.params.hostId);
    const result = await execRemote(host, "docker ps --format '{{json .}}'", DEFAULT_TIMEOUT);
    if (result.exit_code !== 0) {
      return res.status(500).json({ error: result.stderr || "docker command failed", raw: result.stdout });
    }
    const containers = parseDockerPs(result.stdout);
    res.json({ containers, count: containers.length });
  } catch (e) {
    res.status(500).json({ error: e.message, code: e.code });
  }
});

router.get("/:hostId/files/list", async (req, res) => {
  const dirPath = sanitizePath(req.query.path || ".");
  try {
    const host = getHost(req.params.hostId);
    const findCmd = `find ${JSON.stringify(dirPath)} -maxdepth 1 -not -path ${JSON.stringify(dirPath)} -printf '%f\\t%y\\t%s\\n' | sort`;
    const result = await execRemote(host, findCmd, DEFAULT_TIMEOUT);
    if (result.exit_code !== 0) {
      return res.status(500).json({ error: result.stderr || "list failed", path: dirPath });
    }
    const entries = parseFindOutput(result.stdout, dirPath);
    res.json({ ok: true, path: dirPath, entries });
  } catch (e) {
    res.status(500).json({ error: e.message, code: e.code });
  }
});

router.get("/:hostId/files/read", async (req, res) => {
  const filePath = sanitizePath(req.query.path);
  if (!filePath) return res.status(400).json({ error: "path is required" });
  try {
    const host = getHost(req.params.hostId);
    const result = await execRemote(host, `cat ${JSON.stringify(filePath)}`, DEFAULT_TIMEOUT);
    if (result.exit_code !== 0) {
      return res.status(500).json({ ok: false, path: filePath, error: result.stderr || "read failed" });
    }
    res.json({ ok: true, path: filePath, content: result.stdout });
  } catch (e) {
    res.status(500).json({ ok: false, path: filePath, error: e.message, code: e.code });
  }
});

router.post("/:hostId/files/write", async (req, res) => {
  const { path: filePath, content } = req.body || {};
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: "path and content are required" });
  }
  const user = getUser(req);
  if (user.role !== "admin" && user.role !== "operator") {
    return res.status(403).json({ error: "insufficient role for file write" });
  }

  const safePath = sanitizePath(filePath);
  try {
    const host = getHost(req.params.hostId);
    const base64 = Buffer.from(content, "utf8").toString("base64");
    const writeCmd = `echo ${JSON.stringify(base64)} | base64 -d > ${JSON.stringify(safePath)}`;
    const result = await execRemote(host, writeCmd, DEFAULT_TIMEOUT);
    await audit({
      operation: "update",
      actor: user.username,
      target: `${host.id}:${safePath}`,
      target_type: "file",
      reasoning: "remote file write via SSH",
      result: result.exit_code === 0 ? "success" : "failure",
    });
    logAction({ category: "remote", action: "file_write", target: `${host.id}:${safePath}`, actor: user.username, result: result.exit_code === 0 ? "success" : "failure" }).catch(() => {});
    if (result.exit_code !== 0) {
      return res.status(500).json({ ok: false, path: safePath, error: result.stderr || "write failed" });
    }
    res.json({ ok: true, path: safePath, bytes: Buffer.byteLength(content, "utf8") });
  } catch (e) {
    res.status(500).json({ ok: false, path: safePath, error: e.message, code: e.code });
  }
});

router.get("/:hostId/containers/:containerId/logs", async (req, res) => {
  const { containerId } = req.params;
  const tail = Math.min(parseInt(req.query.tail || "100", 10), 1000);
  try {
    const host = getHost(req.params.hostId);
    const cmd = `docker logs --tail ${tail} ${JSON.stringify(containerId)}`;
    if (!isCommandAllowed(cmd)) {
      return res.status(403).json({ error: "command not in whitelist" });
    }
    const result = await execRemote(host, cmd, DEFAULT_TIMEOUT);
    res.json({ ok: result.exit_code === 0, stdout: result.stdout, stderr: result.stderr, exit_code: result.exit_code });
  } catch (e) {
    res.status(500).json({ error: e.message, code: e.code });
  }
});

router.get("/:hostId/containers/:containerId/inspect", async (req, res) => {
  const { containerId } = req.params;
  try {
    const host = getHost(req.params.hostId);
    const cmd = `docker inspect ${JSON.stringify(containerId)}`;
    if (!isCommandAllowed(cmd)) {
      return res.status(403).json({ error: "command not in whitelist" });
    }
    const result = await execRemote(host, cmd, DEFAULT_TIMEOUT);
    if (result.exit_code !== 0) {
      return res.status(500).json({ error: result.stderr || "inspect failed" });
    }
    const data = JSON.parse(result.stdout || "[]");
    res.json({ ok: true, data: Array.isArray(data) ? data[0] : data });
  } catch (e) {
    res.status(500).json({ error: e.message, code: e.code });
  }
});

async function runDockerAction(req, res, action) {
  const { containerId } = req.params;
  const user = getUser(req);
  if (user.role !== "admin" && user.role !== "operator") {
    return res.status(403).json({ error: "insufficient role for container control" });
  }
  const cmd = `docker ${action} ${JSON.stringify(containerId)}`;
  if (!isCommandAllowed(cmd)) {
    return res.status(403).json({ error: "command not in whitelist" });
  }
  try {
    const host = getHost(req.params.hostId);
    const result = await execRemote(host, cmd, DEFAULT_TIMEOUT);
    await audit({
      operation: "container_control",
      actor: user.username,
      target: `${host.id}:${containerId}`,
      target_type: "container",
      reasoning: `docker ${action}`,
      result: result.exit_code === 0 ? "success" : "failure",
    });
    logAction({ category: "remote", action: `docker_${action}`, target: `${host.id}:${containerId}`, actor: user.username, result: result.exit_code === 0 ? "success" : "failure" }).catch(() => {});
    res.json({ ok: result.exit_code === 0, action, containerId, stdout: result.stdout, stderr: result.stderr, exit_code: result.exit_code });
  } catch (e) {
    res.status(500).json({ error: e.message, code: e.code });
  }
}

router.post("/:hostId/containers/:containerId/start", async (req, res) => runDockerAction(req, res, "start"));
router.post("/:hostId/containers/:containerId/stop", async (req, res) => runDockerAction(req, res, "stop"));
router.post("/:hostId/containers/:containerId/restart", async (req, res) => runDockerAction(req, res, "restart"));

router.get("/:hostId/processes", async (req, res) => {
  try {
    const host = getHost(req.params.hostId);
    const result = await execRemote(host, "ps -eo pid,comm,pcpu,pmem --sort=-pcpu | head -n 51", DEFAULT_TIMEOUT);
    if (result.exit_code !== 0) {
      return res.status(500).json({ error: result.stderr || "process list failed" });
    }
    const processes = parseProcesses(result.stdout);
    res.json({ processes, count: processes.length });
  } catch (e) {
    res.status(500).json({ error: e.message, code: e.code });
  }
});

router.get("/:hostId/ports", async (req, res) => {
  try {
    const host = getHost(req.params.hostId);
    const result = await execRemote(host, "ss -tlnp", DEFAULT_TIMEOUT);
    if (result.exit_code !== 0) {
      return res.status(500).json({ error: result.stderr || "port list failed" });
    }
    const ports = parsePorts(result.stdout);
    res.json({ ports, count: ports.length });
  } catch (e) {
    res.status(500).json({ error: e.message, code: e.code });
  }
});

module.exports = router;
