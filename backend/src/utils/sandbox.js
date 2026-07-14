const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { docker } = require("./docker");

const SANDBOX_VOLUME = "/var/althr-volumes/sandbox";
const SANDBOX_DOCKER_VOLUME = "althr-sandbox-vol";
const SANDBOX_IMAGE = "alpine:latest";

const state = {
  active: false,
  activatedAt: null,
};

function isActive() {
  return state.active;
}

function setMode(active) {
  state.active = Boolean(active);
  state.activatedAt = state.active ? new Date().toISOString() : null;
  if (state.active) {
    ensureSandboxVolume();
  }
  return getStatus();
}

function getStatus() {
  return {
    active: state.active,
    activatedAt: state.activatedAt,
    volume: SANDBOX_VOLUME,
    dockerVolume: SANDBOX_DOCKER_VOLUME,
  };
}

function resolveRoot(originalRoot) {
  if (!state.active) return originalRoot;
  ensureSandboxDir();
  return SANDBOX_VOLUME;
}

function resolvePath(originalPath) {
  if (!state.active) return originalPath;
  if (!originalPath) return SANDBOX_VOLUME;
  if (originalPath.startsWith(SANDBOX_VOLUME)) return originalPath;
  if (originalPath.startsWith("/var/althr-volumes/files")) {
    return originalPath.replace("/var/althr-volumes/files", SANDBOX_VOLUME);
  }
  return originalPath;
}

function ensureSandboxDir() {
  try {
    if (!fs.existsSync(SANDBOX_VOLUME)) {
      fs.mkdirSync(SANDBOX_VOLUME, { recursive: true });
    }
  } catch (e) {
    console.warn("[sandbox] Could not create sandbox dir:", e.message);
  }
}

async function ensureSandboxVolume() {
  try {
    const volumes = await docker.listVolumes();
    const exists = volumes.Volumes && volumes.Volumes.some((v) => v.Name === SANDBOX_DOCKER_VOLUME);
    if (!exists) {
      await docker.createVolume({ Name: SANDBOX_DOCKER_VOLUME });
      console.log("[sandbox] Created Docker volume:", SANDBOX_DOCKER_VOLUME);
    }
  } catch (e) {
    console.warn("[sandbox] Could not create Docker volume:", e.message);
  }
}

async function resetSandboxVolume() {
  try {
    if (fs.existsSync(SANDBOX_VOLUME)) {
      const entries = fs.readdirSync(SANDBOX_VOLUME);
      for (const entry of entries) {
        const entryPath = path.join(SANDBOX_VOLUME, entry);
        fs.rmSync(entryPath, { recursive: true });
      }
    }
    ensureSandboxDir();

    try {
      const vol = docker.getVolume(SANDBOX_DOCKER_VOLUME);
      await vol.remove({ force: true });
    } catch (e) {
      // Volume may not exist or may be in use
    }
    await ensureSandboxVolume();

    return { ok: true, reset: true, volume: SANDBOX_VOLUME };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function wrapForSandbox(command, timeout = 10000) {
  if (!state.active) {
    return null;
  }

  await ensureSandboxVolume();

  const safeCmd = command.replace(/"/g, '\\"');
  const dockerCmd = [
    "docker", "run", "--rm",
    "-v", `${SANDBOX_DOCKER_VOLUME}:/workspace`,
    "-w", "/workspace",
    "--memory", "256m",
    "--cpus", "0.5",
    "--network", "none",
    SANDBOX_IMAGE,
    "sh", "-c", `"${safeCmd}"`,
  ].join(" ");

  try {
    const output = execSync(dockerCmd, {
      timeout: timeout,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 1024 * 1024,
    });
    return {
      exit_code: 0,
      stdout: output,
      stderr: "",
      sandboxed: true,
    };
  } catch (e) {
    return {
      exit_code: e.status || 1,
      stdout: e.stdout ? e.stdout.toString() : "",
      stderr: e.stderr ? e.stderr.toString() : e.message,
      sandboxed: true,
    };
  }
}

module.exports = {
  isActive,
  setMode,
  getStatus,
  resolveRoot,
  resolvePath,
  resetSandboxVolume,
  wrapForSandbox,
  ensureSandboxVolume,
  SANDBOX_VOLUME,
  SANDBOX_DOCKER_VOLUME,
};
