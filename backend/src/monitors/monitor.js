// backend/src/monitors/monitor.js
// SOS Architecture Mapping:
// - SOS V5 (Simulation): Digital Twin Manager - creates digital representation of system state
// - SOS V7 (Execution & Learning): Monitoring Engine - measures actual execution
// - SOS V7 (Execution & Learning): Feedback Engine - captures reality from system metrics
//
// Continuous monitoring service — polls server health every 30s and detects
// anomalies (CPU, RAM, disk, process crashes, port conflicts).
//
// On anomaly:
//   1. Store in M1 (Raw Event)
//   2. Classify incident severity and blast radius
//   3. Check M3 for a known SOP (learning loop)
//   4. If no SOP: trigger Qwen diagnosis (qwen3.7-max + thinking + stream)
//   5. Stream reasoning_content to dashboard via WebSocket
//   6. Route through SAF and escalation procedure
//      - auto-execute low-risk / high-confidence actions
//      - request human approval for medium-risk or medium-confidence actions
//      - escalate on high-risk, SAF block, repeated failure, or approval timeout
//   7. Check cascade effects via topology
//   8. Notify user via Telegram + Dashboard
//   9. Record resolution in M6 and update M3 SOP learning

const si = require("systeminformation");
const { v4: uuidv4 } = require("uuid");

const { client: redisClient, connect: redisConnect } = require("../db/redis");
const memory = require("../memory/store");
const { audit } = require("../utils/audit");
const { logAction } = require("../utils/actionHistory");
const tokenTracker = require("../qwen/tokenTracker");
const { addTerminalLog } = require("../utils/terminalLog");
const { buildTopology, getImpactAnalysis } = require("../utils/topology");
const { listAllContainers, getParsedStats } = require("../utils/docker");
const { getTopProcesses, getListeningPorts } = require("../utils/hostProcesses");
const incidentResponse = require("./incidentResponse");
const { query } = require("../db/pool");

// Anomaly thresholds (configurable via env)
const THRESHOLDS = {
  CPU_PERCENT: Number(process.env.THRESHOLD_CPU || 85),
  RAM_PERCENT: Number(process.env.THRESHOLD_RAM || 90),
  DISK_PERCENT: Number(process.env.THRESHOLD_DISK || 85),
  NET_LATENCY_MS: Number(process.env.THRESHOLD_NET_LATENCY || 500),
  NET_ERROR_RATE: Number(process.env.THRESHOLD_NET_ERRORS || 10),
};

const POLL_INTERVAL_MS = Number(process.env.MONITOR_INTERVAL_MS || 60000);

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// Anomaly cooldown: don't re-diagnose the same anomaly type within this window
const ANOMALY_COOLDOWN_MS = Number(process.env.ANOMALY_COOLDOWN_MS || 5 * 60 * 1000);

// Track state for sustained-anomaly detection (CPU needs 5 min sustained)
const state = {
  cpuHighSince: null,
  lastProcesses: [],
  lastPorts: [],
  running: false,
  intervalId: null,
  io: null,
  anomalyCooldowns: new Map(),
  tickCount: 0,
};

/**
 * Start the monitoring loop.
 * @param {object} io  Socket.io server for real-time alerts
 */
function start(io) {
  if (state.running) return;
  state.io = io;
  state.running = true;
  console.log(`[monitor] Started (poll every ${POLL_INTERVAL_MS}ms)`);
  // Run immediately, then on interval
  tick().catch((e) => console.error("[monitor] tick error:", e.message));
  state.intervalId = setInterval(() => tick().catch((e) => console.error("[monitor] tick error:", e.message)), POLL_INTERVAL_MS);
}

function stop() {
  if (state.intervalId) clearInterval(state.intervalId);
  state.running = false;
  console.log("[monitor] Stopped");
}

/**
 * Single monitoring tick: collect metrics, detect anomalies, trigger diagnosis.
 */
async function tick() {
  state.tickCount++;
  // Kill switch: skip all anomaly handling if AI is halted
  const killSwitchActive = tokenTracker.isKillSwitchActive();

  const metrics = await collectMetrics();
  const anomalies = detectAnomalies(metrics);

  persistMetrics(metrics).catch((e) =>
    console.warn("[monitor] persist metrics failed:", e.message)
  );

  for (const anomaly of anomalies) {
    if (killSwitchActive) {
      // Log the anomaly but do not call Qwen or execute remediation
      console.log(`[monitor] Anomaly: ${anomaly.type} — ${anomaly.message} (kill switch active, skipping)`);
      if (state.io) {
        state.io.emit("anomaly_alert", { id: `anom_${uuidv4().slice(0, 8)}`, ...anomaly, timestamp: new Date().toISOString(), killSwitchActive: true });
      }
      continue;
    }
    await handleAnomaly(anomaly, metrics);
  }

  // Emit metrics to connected dashboards (for live graphs)
  if (state.io) {
    state.io.emit("server_metrics", metrics);
  }
}

/**
 * Collect all server metrics in one pass.
 * Expensive operations (processes, network connections) only run every 5th tick
 * to avoid CPU feedback loops on small instances.
 */
async function collectMetrics() {
  const doHeavy = state.tickCount % 5 === 0;

  const [cpuLoad, mem, fsSize, netStats, osInfo] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    withTimeout(si.networkStats(), 15000).catch(() => []),
    si.osInfo().catch(() => null),
  ]);

  const disk = fsSize[0] ? { used: fsSize[0].used, total: fsSize[0].size, percent: fsSize[0].use } : null;

  // Network stats: aggregate across all interfaces
  let network = { rx_bytes: 0, tx_bytes: 0, rx_errors: 0, tx_errors: 0, ops: 0 };
  if (netStats && netStats.length > 0) {
    for (const iface of netStats) {
      if (iface.iface === "lo") continue;
      network.rx_bytes += iface.rx_bytes || 0;
      network.tx_bytes += iface.tx_bytes || 0;
      network.rx_errors += iface.rx_errors || 0;
      network.tx_errors += iface.tx_errors || 0;
      network.ops += iface.ops || 0;
    }
  }
  network.rx_mb = Math.round(network.rx_bytes / 1024 / 1024);
  network.tx_mb = Math.round(network.tx_bytes / 1024 / 1024);

  // Network latency check (only on heavy ticks to avoid overhead)
  let latency = null;
  if (doHeavy) {
    try {
      latency = await withTimeout(si.inetLatency("8.8.8.8"), 5000).catch(() => null);
      if (latency !== null) latency = Number(latency.toFixed(2));
    } catch {}
  }

  let processes = [];
  let ports = [];
  if (doHeavy) {
    const [topProcs, listenPorts] = await Promise.all([
      getTopProcesses(50),
      getListeningPorts(),
    ]);
    processes = topProcs;
    ports = listenPorts;
  }

  // OS info (static, cache it)
  if (!state.osInfo && osInfo) {
    state.osInfo = {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      kernel: osInfo.kernel,
      hostname: osInfo.hostname,
      arch: osInfo.arch,
    };
  }

  // Uptime
  let uptime_seconds = null;
  try {
    const time = si.time();
    uptime_seconds = time.uptime;
  } catch {}

  await cacheTelemetry({ cpuLoad, mem, fsSize, processes });
  return {
    timestamp: new Date().toISOString(),
    cpu: Number(cpuLoad.currentLoad.toFixed(2)),
    ram: Number((((mem.total - (mem.available || mem.free)) / mem.total) * 100).toFixed(2)),
    ram_used_mb: Math.round((mem.total - (mem.available || mem.free)) / 1024 / 1024),
    ram_available_mb: Math.round((mem.available || mem.free) / 1024 / 1024),
    ram_total_mb: Math.round(mem.total / 1024 / 1024),
    ram_buff_cache_mb: Math.round((mem.used - (mem.total - (mem.available || mem.free))) / 1024 / 1024),
    disk: disk ? disk.percent : null,
    network,
    latency_ms: latency,
    os: state.osInfo,
    uptime_seconds,
    processes,
    ports,
  };
}

async function cacheTelemetry({ cpuLoad, mem, fsSize, processes }) {
  try {
    await redisConnect();
    const cpu_overall = Number(cpuLoad.currentLoad.toFixed(2));
    const cpu_cores = cpuLoad.cpus ? cpuLoad.cpus.map((c) => Number((c.load || 0).toFixed(2))) : [];
    const TTL = 300;
    const mounts = (fsSize || []).map((fs) => ({
      fs: fs.fs,
      mount: fs.mount,
      size_gb: Number((fs.size / 1024 / 1024 / 1024).toFixed(2)),
      used_gb: Number((fs.used / 1024 / 1024 / 1024).toFixed(2)),
      available_gb: Number(((fs.size - fs.used) / 1024 / 1024 / 1024).toFixed(2)),
      percent: Number((fs.use || 0).toFixed(2)),
    }));
    await redisClient.setEx(
      "althr:telemetry:disk",
      TTL,
      JSON.stringify({
        mounts,
        total_size_gb: Number(mounts.reduce((s, m) => s + m.size_gb, 0).toFixed(2)),
        total_used_gb: Number(mounts.reduce((s, m) => s + m.used_gb, 0).toFixed(2)),
        total_available_gb: Number(mounts.reduce((s, m) => s + m.available_gb, 0).toFixed(2)),
      })
    );

    const top_cpu = (processes || [])
      .slice()
      .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
      .slice(0, 10)
      .map((p) => ({
        pid: p.pid,
        name: p.name,
        cpu: Number((p.cpu || 0).toFixed(2)),
        mem: Number((p.mem || 0).toFixed(2)),
        command: p.command || p.name,
      }));
    await redisClient.setEx(
      "althr:telemetry:cpu",
      TTL,
      JSON.stringify({ cpu_overall, cpu_cores, top_processes: top_cpu })
    );

    const used = mem.total - (mem.available || mem.free);
    const top_mem = (processes || [])
      .slice()
      .sort((a, b) => (b.mem || 0) - (a.mem || 0))
      .slice(0, 20)
      .map((p) => ({
        pid: p.pid,
        name: p.name,
        mem_percent: Number((p.mem || 0).toFixed(2)),
        mem_mb: Math.round(((p.mem || 0) / 100) * (mem.total / 1024 / 1024)),
        cpu: Number((p.cpu || 0).toFixed(2)),
        command: p.command || p.name,
      }));
    await redisClient.setEx(
      "althr:telemetry:ram",
      TTL,
      JSON.stringify({
        total_mb: Math.round(mem.total / 1024 / 1024),
        used_mb: Math.round(used / 1024 / 1024),
        available_mb: Math.round((mem.available || mem.free) / 1024 / 1024),
        buff_cache_mb: Math.round((mem.used - used) / 1024 / 1024),
        used_percent: Number(((used / mem.total) * 100).toFixed(2)),
        available_percent: Number((((mem.available || mem.free) / mem.total) * 100).toFixed(2)),
        swap_total_mb: Math.round((mem.swaptotal || 0) / 1024 / 1024),
        swap_used_mb: Math.round((mem.swapused || 0) / 1024 / 1024),
        top_processes: top_mem,
      })
    );
  } catch (e) {
    console.warn("[monitor] cache telemetry failed:", e.message);
  }
}

/**
 * Detect anomalies based on current metrics + thresholds.
 * Returns array of anomaly descriptors.
 */
function detectAnomalies(metrics) {
  const anomalies = [];

  // CPU: sustained high usage (>threshold for 5 min)
  if (metrics.cpu > THRESHOLDS.CPU_PERCENT) {
    if (!state.cpuHighSince) state.cpuHighSince = Date.now();
    const sustainedMs = Date.now() - state.cpuHighSince;
    if (sustainedMs >= 5 * 60 * 1000) {
      anomalies.push({
        type: "cpu_spike",
        severity: "critical",
        message: `CPU at ${metrics.cpu}% for ${Math.round(sustainedMs / 1000)}s`,
        data: { cpu: metrics.cpu, sustained_seconds: Math.round(sustainedMs / 1000) },
      });
    }
  } else {
    state.cpuHighSince = null;
  }

  // RAM: immediate anomaly if >threshold
  if (metrics.ram > THRESHOLDS.RAM_PERCENT) {
    anomalies.push({
      type: "ram_pressure",
      severity: "critical",
      message: `RAM at ${metrics.ram}% (${metrics.ram_used_mb}/${metrics.ram_total_mb} MB, ${metrics.ram_available_mb} MB available)`,
      data: { ram: metrics.ram, used_mb: metrics.ram_used_mb, available_mb: metrics.ram_available_mb, total_mb: metrics.ram_total_mb, buff_cache_mb: metrics.ram_buff_cache_mb },
    });
  }

  // Disk: immediate anomaly if >threshold
  if (metrics.disk !== null && metrics.disk > THRESHOLDS.DISK_PERCENT) {
    anomalies.push({
      type: "disk_pressure",
      severity: "warning",
      message: `Disk at ${metrics.disk}%`,
      data: { disk: metrics.disk },
    });
  }

  // Port conflicts: same port bound by multiple PIDs
  const portCounts = {};
  for (const p of metrics.ports) {
    const key = `${p.localPort}:${p.protocol}`;
    portCounts[key] = (portCounts[key] || 0) + 1;
  }
  for (const [key, count] of Object.entries(portCounts)) {
    if (count > 1) {
      anomalies.push({
        type: "port_conflict",
        severity: "warning",
        message: `Port ${key} bound by ${count} processes`,
        data: { port: key, count },
      });
    }
  }

  // Network latency anomaly
  if (metrics.latency_ms !== null && metrics.latency_ms > THRESHOLDS.NET_LATENCY_MS) {
    anomalies.push({
      type: "network_latency",
      severity: "warning",
      message: `Network latency at ${metrics.latency_ms}ms (threshold: ${THRESHOLDS.NET_LATENCY_MS}ms)`,
      data: { latency_ms: metrics.latency_ms, threshold: THRESHOLDS.NET_LATENCY_MS },
    });
  }

  // Network error rate anomaly
  const totalErrors = (metrics.network?.rx_errors || 0) + (metrics.network?.tx_errors || 0);
  if (totalErrors > THRESHOLDS.NET_ERROR_RATE) {
    anomalies.push({
      type: "network_errors",
      severity: "warning",
      message: `Network errors detected: ${totalErrors} rx/tx errors`,
      data: { rx_errors: metrics.network?.rx_errors, tx_errors: metrics.network?.tx_errors },
    });
  }

  return anomalies;
}

/**
 * Handle a detected anomaly using the formal incident-response escalation procedure.
 */
async function handleAnomaly(anomaly, metrics, opts = {}) {
  const { skipCooldown = false, io: overrideIo = null } = opts;
  const emitIo = overrideIo || state.io;
  const anomalyId = `anom_${uuidv4().slice(0, 8)}`;
  const now = Date.now();
  const lastHandled = state.anomalyCooldowns.get(anomaly.type);
  const inCooldown = !skipCooldown && lastHandled && now - lastHandled < ANOMALY_COOLDOWN_MS;

  // 1. Store in M1 (Raw Event)
  await memory.store("M1", anomaly.message, {
    event_type: anomaly.type,
    severity: anomaly.severity,
    ...anomaly.data,
  });

  // 1b. Log to action_history
  logAction({
    category: "monitor",
    action: anomaly.type,
    target: anomaly.message,
    actor: "monitor",
    result: anomaly.severity,
    detail: { ...anomaly.data, anomalyId },
  }).catch(() => {});

  // 2. Emit alert to dashboard
  if (emitIo) {
    emitIo.emit("anomaly_alert", { id: anomalyId, ...anomaly, timestamp: new Date().toISOString(), inCooldown });
  }

  console.log(`[monitor] Anomaly: ${anomaly.type} — ${anomaly.message}${inCooldown ? " (cooldown, skipping)" : ""}`);

  // Emit action_update so the activity feed picks it up
  if (emitIo) {
    emitIo.emit("action_update", {
      anomalyId,
      stage: "anomaly_detected",
      action: anomaly.type,
      message: anomaly.message,
      severity: anomaly.severity,
      timestamp: new Date().toISOString(),
    });
  }

  if (inCooldown) return;

  state.anomalyCooldowns.set(anomaly.type, now);

  // 3. Run formal incident response: classify, remediate/approve/escalate
  try {
    const { incident, result } = await incidentResponse.handleIncident({ anomaly, metrics, emitIo });
    if (emitIo) {
      emitIo.emit("action_update", {
        stage: "incident_handled",
        action: anomaly.type,
        incident_id: incident.incident_id,
        status: incident.status,
        result,
        timestamp: new Date().toISOString(),
      });
    }

    // 4. Check cascade effects after handling
    const cascade = await checkCascadeEffects(anomaly, emitIo);
    if (cascade.length > 0 && emitIo) {
      emitIo.emit("action_update", {
        stage: "cascade_check",
        action: anomaly.type,
        impacted: cascade,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error(`[monitor] Incident handling failed for ${anomalyId}:`, e.message);
    if (emitIo) emitIo.emit("action_update", { anomalyId, stage: "error", error: e.message });
  }
}

/**
 * Check dependent services for cascading effects when an anomaly is detected.
 * Uses the topology graph from Phase 2 to find which services depend on the
 * affected service and checks their health.
 */
async function checkCascadeEffects(anomaly, emitIo) {
  try {
    const topology = await buildTopology();
    const containers = await listAllContainers(false);

    // Find the container that matches the anomaly context (if any)
    // For host-level anomalies (cpu/ram/disk), check all containers
    const affectedNodes = containers.filter((c) => c.state === "running");
    const cascadeResults = [];

    for (const container of affectedNodes) {
      const impact = await getImpactAnalysis(container.id);
      if (impact.impactedCount > 0) {
        // Check health of each impacted container
        for (const impacted of impact.impacted) {
          try {
            const stats = await getParsedStats(impacted.id);
            const cpuPercent = stats.cpuPercent || 0;
            const memPercent = stats.memPercent || 0;
            const unhealthy = cpuPercent > THRESHOLDS.CPU_PERCENT || memPercent > THRESHOLDS.RAM_PERCENT;

            cascadeResults.push({
              sourceContainer: container.name,
              impactedContainer: impacted.name,
              impactedService: impacted.service,
              cpuPercent: Number(cpuPercent.toFixed(2)),
              memoryPercent: Number(memPercent.toFixed(2)),
              unhealthy,
            });

            if (unhealthy && emitIo) {
              emitIo.emit("cascade_alert", {
                source: container.name,
                impacted: impacted.name,
                service: impacted.service,
                cpu: cpuPercent,
                memory: memPercent,
                timestamp: new Date().toISOString(),
              });
            }
          } catch (e) {
            // Stats may fail for stopped containers
          }
        }
      }
    }

    return cascadeResults;
  } catch (e) {
    console.warn("[monitor] Cascade check failed:", e.message);
    return [];
  }
}

/**
 * Aggregate service health across all running containers.
 * Returns per-service health status: green (all healthy), amber (degraded), red (down).
 * Now uses CPU/RAM thresholds aligned with host-level monitoring.
 */
async function getServiceHealth() {
  try {
    const topology = await buildTopology();
    const containers = await listAllContainers(false);
    const hostMem = await si.mem().catch(() => null);
    const hostMemTotal = hostMem ? hostMem.total : 0;
    const services = [];

    for (const [serviceName, group] of Object.entries(topology.services)) {
      const containerHealths = [];
      for (const container of group.containers) {
        let memUsed = 0;
        let memPercent = 0;
        let cpuPercent = 0;

        try {
          const info = await inspectContainer(container.id);
          const state = info.State || {};
          const memStats = info.MemoryStats || {};
          memUsed = memStats.usage || 0;
          const memLimit = memStats.limit || hostMemTotal || 1;
          memPercent = Number(((memUsed / memLimit) * 100).toFixed(2));

          // CPU percent per-container relative to one core
          const cpuDelta = (info.CpuStats?.cpu_stats?.cpu_usage?.total_usage || 0) -
            (info.CpuStats?.precpu_stats?.cpu_usage?.total_usage || 0);
          const systemDelta = (info.CpuStats?.cpu_stats?.system_cpu_usage || 0) -
            (info.CpuStats?.precpu_stats?.system_cpu_usage || 0);
          cpuPercent = systemDelta > 0
            ? Number(((cpuDelta / systemDelta) * 100).toFixed(2))
            : 0;

          containerHealths.push({
            name: container.name,
            state: state.Status || container.state,
            health: state.Health?.Status || "none",
            cpuPercent,
            memoryPercent: memPercent,
            memoryUsedMB: Math.round(memUsed / 1024 / 1024),
            oomKilled: !!state.OOMKilled,
            exitCode: state.ExitCode ?? null,
            startedAt: state.StartedAt || null,
          });
        } catch (e) {
          containerHealths.push({
            name: container.name,
            state: container.state,
            health: "unknown",
            cpuPercent: 0,
            memoryPercent: 0,
            memoryUsedMB: 0,
            oomKilled: false,
            exitCode: null,
            startedAt: null,
          });
        }
      }

      const running = containerHealths.filter((c) => c.state === "running").length;
      const total = containerHealths.length;
      const anyUnhealthy = containerHealths.some((c) =>
        c.health === "unhealthy" ||
        c.oomKilled ||
        (typeof c.exitCode === "number" && c.exitCode !== 0) ||
        c.memoryPercent > THRESHOLDS.RAM_PERCENT ||
        c.cpuPercent > THRESHOLDS.CPU_PERCENT
      );
      const someRunning = running > 0 && running < total;

      let status = "green";
      if (running === 0) status = "red";
      else if (anyUnhealthy || someRunning) status = "amber";

      services.push({
        name: serviceName,
        image: group.image,
        status,
        running,
        total,
        containers: containerHealths,
      });
    }

    const allGreen = services.every((s) => s.status === "green");
    const anyRed = services.some((s) => s.status === "red");
    const anyAmber = services.some((s) => s.status === "amber");
    const overall = anyRed ? "red" : anyAmber ? "amber" : allGreen ? "green" : "unknown";

    return { overall, services, timestamp: new Date().toISOString() };
  } catch (e) {
    return { overall: "unknown", services: [], error: e.message, timestamp: new Date().toISOString() };
  }
}

/**
 * Persist metrics to monitor_metrics_history table for history graphs.
 */
async function persistMetrics(metrics) {
  await query(
    `INSERT INTO monitor_metrics_history
       (cpu, ram, ram_used_mb, ram_available_mb, ram_total_mb, ram_buff_cache_mb,
        disk, network_rx_mb, network_tx_mb, network_rx_errors, network_tx_errors,
        latency_ms, uptime_seconds, tick_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      metrics.cpu,
      metrics.ram,
      metrics.ram_used_mb,
      metrics.ram_available_mb,
      metrics.ram_total_mb,
      metrics.ram_buff_cache_mb || null,
      metrics.disk,
      metrics.network?.rx_mb || null,
      metrics.network?.tx_mb || null,
      metrics.network?.rx_errors || 0,
      metrics.network?.tx_errors || 0,
      metrics.latency_ms,
      metrics.uptime_seconds || null,
      state.tickCount,
    ]
  );
}

/**
 * Retrieve historical metrics for graphing.
 * @param {number} limit  Number of most recent rows to return (default 60)
 * @param {string} metric Optional filter: 'cpu', 'ram', 'disk', 'network', 'all'
 */
async function getMetricsHistory(limit = 60, metric = "all") {
  const cols = metric === "cpu" ? "id, timestamp, cpu" :
    metric === "ram" ? "id, timestamp, ram, ram_used_mb, ram_available_mb, ram_total_mb, ram_buff_cache_mb" :
    metric === "disk" ? "id, timestamp, disk" :
    metric === "network" ? "id, timestamp, network_rx_mb, network_tx_mb, network_rx_errors, network_tx_errors, latency_ms" :
    "*";
  const result = await query(
    `SELECT ${cols} FROM monitor_metrics_history ORDER BY timestamp DESC LIMIT $1`,
    [Math.min(limit, 1000)]
  );
  return result.rows.reverse();
}

module.exports = { start, stop, tick, collectMetrics, detectAnomalies, handleAnomaly, checkCascadeEffects, getServiceHealth, persistMetrics, getMetricsHistory, THRESHOLDS };
