const Docker = require("dockerode");

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

async function listAllContainers(all = true) {
  const containers = await docker.listContainers({ all });
  return containers.map((c) => ({
    id: c.Id,
    name: c.Names[0] ? c.Names[0].replace(/^\//, "") : c.Id.substring(0, 12),
    names: c.Names.map((n) => n.replace(/^\//, "")),
    image: c.Image,
    state: c.State,
    status: c.Status,
    ports: c.Ports.map((p) => ({
      ip: p.IP || "",
      privatePort: p.PrivatePort,
      publicPort: p.PublicPort || null,
      type: p.Type,
    })),
    labels: c.Labels || {},
    networkMode: c.HostConfig ? c.HostConfig.NetworkMode : "default",
    health: c.State.Health ? c.State.Health.Status : "none",
  }));
}

async function getContainer(id) {
  return docker.getContainer(id);
}

async function inspectContainer(id) {
  const container = docker.getContainer(id);
  const info = await container.inspect();
  return info;
}

async function getContainerLogs(id, { tail = 100, follow = false } = {}) {
  const container = docker.getContainer(id);
  const logStream = await container.logs({
    follow,
    stdout: true,
    stderr: true,
    tail,
  });
  return logStream;
}

async function getContainerStats(id, { stream = false } = {}) {
  const container = docker.getContainer(id);
  const stats = await container.stats({ stream });
  return stats;
}

async function getParsedStats(id) {
  const stats = await getContainerStats(id, { stream: false });
  const memUsage = stats.memory_stats ? (stats.memory_stats.usage || 0) : 0;
  const memLimit = stats.memory_stats ? (stats.memory_stats.limit || 0) : 0;
  const cpuDelta = stats.cpu_stats && stats.precpu_stats
    ? (stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage)
    : 0;
  const systemDelta = stats.cpu_stats && stats.precpu_stats
    ? (stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage)
    : 0;
  const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;
  const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;
  return {
    cpuPercent: Number(cpuPercent.toFixed(2)),
    memUsageMB: Math.round(memUsage / 1024 / 1024),
    memLimitMB: Math.round(memLimit / 1024 / 1024),
    memPercent: Number(memPercent.toFixed(2)),
  };
}

async function execInContainer(id, command) {
  const container = docker.getContainer(id);
  const cmd = Array.isArray(command) ? command : command.split(" ");
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({ Detach: false, Tty: false });
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const demuxStream = docker.modem.demuxStream(stream, {
      write: (chunk) => { stdout += chunk.toString(); },
    }, {
      write: (chunk) => { stderr += chunk.toString(); },
    });
    stream.on("end", () => {
      exec.inspect().then((info) => {
        resolve({
          exitCode: info.ExitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });
    });
    stream.on("error", () => {
      resolve({ exitCode: 1, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function containerAction(id, action) {
  const container = docker.getContainer(id);
  if (action === "stop") await container.stop();
  else if (action === "start") await container.start();
  else if (action === "restart") await container.restart();
  else if (action === "remove") await container.remove({ force: true });
  else throw new Error(`Unknown action: ${action}`);
  return { ok: true, action, container_id: id };
}

async function batchAction(ids, action) {
  const results = [];
  for (const id of ids) {
    try {
      await containerAction(id, action);
      results.push({ id, action, ok: true });
    } catch (e) {
      results.push({ id, action, ok: false, error: e.message });
    }
  }
  return { results, count: results.length, succeeded: results.filter((r) => r.ok).length };
}

async function listImages() {
  const images = await docker.listImages();
  return images.map((img) => ({
    id: img.Id,
    tags: img.RepoTags || [],
    size: img.Size,
    created: img.Created,
  }));
}

module.exports = {
  docker,
  listAllContainers,
  getContainer,
  inspectContainer,
  getContainerLogs,
  getContainerStats,
  getParsedStats,
  execInContainer,
  containerAction,
  batchAction,
  listImages,
};
