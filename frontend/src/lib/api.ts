// frontend/src/lib/api.ts
// API client for ALTHR Autopilot backend.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000/api";
export { API_BASE };

async function fetchAPI<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Health
  health: () => fetchAPI("/health"),
  serverHealth: () => fetchAPI("/health/server"),
  cpuDetail: () => fetchAPI("/health/server/cpu"),
  ramDetail: () => fetchAPI("/health/server/ram"),
  diskDetail: () => fetchAPI("/health/server/disk"),

  // Agent
  agent: (message: string) =>
    fetchAPI("/agent", { method: "POST", body: JSON.stringify({ message }) }),

  // Approvals
  approve: (action_id: string) =>
    fetchAPI(`/approvals/${action_id}/approve`, { method: "POST" }),
  reject: (action_id: string, reason?: string) =>
    fetchAPI(`/approvals/${action_id}/reject`, { method: "POST", body: JSON.stringify({ reason }) }),
  pendingApprovals: () => fetchAPI("/approvals"),
  approvalHistory: (limit = 50) => fetchAPI(`/approvals/history?limit=${limit}`),

  // Monitoring
  processes: (sortBy = "cpu", limit = 50) =>
    fetchAPI(`/processes?sort_by=${sortBy}&limit=${limit}`),
  ports: () => fetchAPI("/ports"),
  dockerContainers: (all = false) => fetchAPI(`/docker/containers${all ? "?all=true" : ""}`),
  containerAction: (id: string, action: "stop" | "start" | "restart" | "remove") =>
    fetchAPI(`/docker/containers/${id}/action`, { method: "POST", body: JSON.stringify({ action }) }),
  containerInspect: (id: string) => fetchAPI(`/docker/containers/${id}/inspect`),
  containerLogs: (id: string, tail = 100) => fetchAPI(`/docker/containers/${id}/logs?tail=${tail}`),
  containerStats: (id: string) => fetchAPI(`/docker/containers/${id}/stats`),
  containerExec: (id: string, command: string) =>
    fetchAPI(`/docker/containers/${id}/exec`, { method: "POST", body: JSON.stringify({ command }) }),
  containerBatch: (ids: string[], action: "stop" | "start" | "restart") =>
    fetchAPI("/docker/containers/batch", { method: "POST", body: JSON.stringify({ ids, action }) }),
  dockerImages: () => fetchAPI("/docker/images"),
  topology: () => fetchAPI("/docker/topology"),
  topologyImpact: (id: string) => fetchAPI(`/docker/topology/impact/${id}`),
  monitorStatus: () => fetchAPI("/monitor/status"),
  stopMonitor: () => fetchAPI("/monitor/stop", { method: "POST" }),
  startMonitor: () => fetchAPI("/monitor/start", { method: "POST" }),

  // Command
  runCommand: (command: string, timeout?: number) =>
    fetchAPI("/command", { method: "POST", body: JSON.stringify({ command, timeout }) }),
  explainCommand: (command: string, output: string, exitCode?: number) =>
    fetchAPI("/command/explain", { method: "POST", body: JSON.stringify({ command, output, exitCode }) }),

  // Files
  listFiles: (path = ".") => fetchAPI(`/file/list?path=${encodeURIComponent(path)}`),
  readFile: (path: string) => fetchAPI(`/file/read?path=${encodeURIComponent(path)}`),
  writeFile: (path: string, content: string) =>
    fetchAPI("/file/write", { method: "POST", body: JSON.stringify({ path, content }) }),
  mkdir: (path: string) => fetchAPI("/file/mkdir", { method: "POST", body: JSON.stringify({ path }) }),
  deleteFile: (path: string) => fetchAPI("/file/delete", { method: "POST", body: JSON.stringify({ path }) }),
  copyFile: (src: string, dest: string) => fetchAPI("/file/copy", { method: "POST", body: JSON.stringify({ src, dest }) }),
  moveFile: (src: string, dest: string) => fetchAPI("/file/move", { method: "POST", body: JSON.stringify({ src, dest }) }),
  renameFile: (path: string, newName: string) => fetchAPI("/file/rename", { method: "POST", body: JSON.stringify({ path, newName }) }),
  uploadFile: (path: string, filename: string, content: string) =>
    fetchAPI("/file/upload", { method: "POST", body: JSON.stringify({ path, filename, content }) }),
  downloadUrl: (path: string) => `${API_BASE}/file/download?path=${encodeURIComponent(path)}`,

  // Deployments
  deploy: (repo_url: string, port?: number) =>
    fetchAPI("/deployments", { method: "POST", body: JSON.stringify({ repo_url, port }) }),
  listDeployments: () => fetchAPI("/deployments"),

  // Simulation
  simulateAnomaly: (type: "cpu" | "ram" | "disk" | "port", value?: number) =>
    fetchAPI("/simulate/anomaly", { method: "POST", body: JSON.stringify({ type, value }) }),

// Terminal logs (persistent)
  getTerminalLogs: (limit = 100) =>
    fetchAPI(`/terminal/logs?limit=${limit}`),
  addTerminalLog: (command: string, output: string, exitCode: number | null, source: string = "user") =>
    fetchAPI("/terminal/logs", { method: "POST", body: JSON.stringify({ command, output, exitCode, source }) }),
  clearTerminalLogs: () =>
    fetchAPI("/terminal/logs", { method: "DELETE" }),

  // Security
  auditLog: (limit = 50) => fetchAPI(`/security/audit?limit=${limit}`),
  securityScan: () => fetchAPI("/security/scan", { method: "POST" }),

  // Memory
  memory: (layer: string, limit = 20) => fetchAPI(`/memory/${layer}?limit=${limit}`),
  storeMemory: (layer: string, content: string, metadata?: any) =>
    fetchAPI("/memory/store", { method: "POST", body: JSON.stringify({ layer, content, metadata }) }),
  searchMemory: (query: string, layers = "M6,M7", limit = 10) =>
    fetchAPI(`/memory/search?query=${encodeURIComponent(query)}&layers=${layers}&limit=${limit}`),

  // Chat History (persistent AI conversation)
  getChatHistory: (limit = 25) => fetchAPI(`/chat-history?limit=${limit}`),
  clearChatHistory: () => fetchAPI("/chat-history", { method: "DELETE" }),

  // Analytics
  dqTrend: (days = 30) => fetchAPI(`/analytics/dq-trend?days=${days}`),

  // Learning
  lessons: (limit = 20) => fetchAPI(`/learning/lessons?limit=${limit}`),

  // Decision Intelligence
  research: (symptom: string, serverState?: any) =>
    fetchAPI("/decision/research", { method: "POST", body: JSON.stringify({ symptom, serverState }) }),
  verify: (candidates: any[]) =>
    fetchAPI("/decision/verify", { method: "POST", body: JSON.stringify({ candidates }) }),
  scoreReaction: (action: string, serverState: any) =>
    fetchAPI("/decision/reaction", { method: "POST", body: JSON.stringify({ action, serverState }) }),
  calibration: () => fetchAPI("/decision/calibration"),
  discRank: (sources: any[]) =>
    fetchAPI("/decision/disc", { method: "POST", body: JSON.stringify({ sources }) }),
  quality: () => fetchAPI("/decision/quality"),
  mass: () =>
    fetchAPI("/decision/mass/infer", { method: "POST", body: JSON.stringify({ action: "restart nginx", confidence: 0.85, risk_level: "medium" }) }),

  // Remote SSH host management
  remoteHosts: () => fetchAPI("/remote/hosts"),
  createRemoteHost: (hostData: any) =>
    fetchAPI("/remote/hosts", { method: "POST", body: JSON.stringify(hostData) }),
  deleteRemoteHost: (id: string) =>
    fetchAPI(`/remote/hosts/${id}`, { method: "DELETE" }),
  remoteCommand: (hostId: string, command: string, timeout?: number) =>
    fetchAPI(`/remote/${hostId}/command`, { method: "POST", body: JSON.stringify({ command, timeout }) }),
  remoteContainers: (hostId: string) => fetchAPI(`/remote/${hostId}/containers`),
  remoteContainerLogs: (hostId: string, containerId: string, tail = 100) =>
    fetchAPI(`/remote/${hostId}/containers/${encodeURIComponent(containerId)}/logs?tail=${tail}`),
  remoteContainerInspect: (hostId: string, containerId: string) =>
    fetchAPI(`/remote/${hostId}/containers/${encodeURIComponent(containerId)}/inspect`),
  remoteContainerStart: (hostId: string, containerId: string) =>
    fetchAPI(`/remote/${hostId}/containers/${encodeURIComponent(containerId)}/start`, { method: "POST" }),
  remoteContainerStop: (hostId: string, containerId: string) =>
    fetchAPI(`/remote/${hostId}/containers/${encodeURIComponent(containerId)}/stop`, { method: "POST" }),
  remoteContainerRestart: (hostId: string, containerId: string) =>
    fetchAPI(`/remote/${hostId}/containers/${encodeURIComponent(containerId)}/restart`, { method: "POST" }),
  remoteProcesses: (hostId: string) => fetchAPI(`/remote/${hostId}/processes`),
  remotePorts: (hostId: string) => fetchAPI(`/remote/${hostId}/ports`),
  remoteListFiles: (hostId: string, path = ".") =>
    fetchAPI(`/remote/${hostId}/files/list?path=${encodeURIComponent(path)}`),
  remoteReadFile: (hostId: string, path: string) =>
    fetchAPI(`/remote/${hostId}/files/read?path=${encodeURIComponent(path)}`),
  remoteWriteFile: (hostId: string, path: string, content: string) =>
    fetchAPI(`/remote/${hostId}/files/write`, { method: "POST", body: JSON.stringify({ path, content }) }),

  // Settings
  getSettings: () => fetchAPI("/settings"),
  saveSettings: (settings: any) =>
    fetchAPI("/settings", { method: "POST", body: JSON.stringify(settings) }),

  // AI Usage & Guardrails
  getUsage: (window = "day") => fetchAPI(`/settings/usage?window=${window}`),
  getUsageCalls: (limit = 50) => fetchAPI(`/settings/usage/calls?limit=${limit}`),
  saveBudgets: (daily: number, monthly: number) =>
    fetchAPI("/settings/budgets", { method: "POST", body: JSON.stringify({ daily, monthly }) }),
  resetGuardrails: () =>
    fetchAPI("/settings/guardrails/reset", { method: "POST" }),

  // Kill switch
  getKillSwitch: () => fetchAPI("/settings/kill-switch"),
  tripKillSwitch: (reason?: string) =>
    fetchAPI("/settings/kill-switch", { method: "POST", body: JSON.stringify({ action: "trip", reason }) }),
  resetKillSwitch: () =>
    fetchAPI("/settings/kill-switch", { method: "POST", body: JSON.stringify({ action: "reset" }) }),

  // Sandbox Mode
  getSandboxMode: () => fetchAPI("/settings/sandbox-mode"),
  setSandboxMode: (active: boolean) =>
    fetchAPI("/settings/sandbox-mode", { method: "POST", body: JSON.stringify({ active }) }),
  resetSandbox: () =>
    fetchAPI("/settings/sandbox-reset", { method: "POST" }),

  // Service Health & Cascade (Phase 4)
  serviceHealth: () => fetchAPI("/docker/service-health"),
  cascadeCheck: () => fetchAPI("/docker/cascade-check"),
  simulateServiceFailure: (service: string) =>
    fetchAPI("/simulate/service-failure", { method: "POST", body: JSON.stringify({ service }) }),

  // Multi-App Deployments (Phase 5)
  deployStack: (data: { compose_content?: string; compose_url?: string; name?: string }) =>
    fetchAPI("/deployments/stack", { method: "POST", body: JSON.stringify(data) }),
  listDeployedApps: () => fetchAPI("/deployments/apps"),
  rollbackDeployment: (id: string) =>
    fetchAPI(`/deployments/${id}/rollback`, { method: "POST" }),
  getDeploymentLogs: (id: string, tail?: number) =>
    fetchAPI(`/deployments/${id}/logs${tail ? `?tail=${tail}` : ""}`),
  deploymentAction: (id: string, action: "start" | "stop" | "restart" | "remove") =>
    fetchAPI(`/deployments/${id}/action`, { method: "POST", body: JSON.stringify({ action }) }),

  // Deployment validation, webhook, investigation
  validateRepoUrl: (repo_url: string) =>
    fetchAPI("/deployments/validate-url", { method: "POST", body: JSON.stringify({ repo_url }) }),
  getWebhookConfigs: () => fetchAPI("/deployments/webhook/config"),
  saveWebhookConfig: (data: { repo_url: string; autoRebuild?: boolean; env_vars?: string[] }) =>
    fetchAPI("/deployments/webhook/config", { method: "POST", body: JSON.stringify(data) }),
  investigateFailure: (data: { repo_url?: string; failure_data?: any }) =>
    fetchAPI("/deployments/investigate", { method: "POST", body: JSON.stringify(data) }),
  getDeploymentReports: (limit?: number) =>
    fetchAPI(`/deployments/reports${limit ? `?limit=${limit}` : ""}`),
  getDeploymentReportsForRepo: (repoUrl: string) =>
    fetchAPI(`/deployments/reports/${encodeURIComponent(repoUrl)}`),

  // AI file-fixing
  proposeFix: (data: { clone_dir?: string; failure_data?: any; report?: any }) =>
    fetchAPI("/deployments/propose-fix", { method: "POST", body: JSON.stringify(data) }),
  applyFix: (data: { clone_dir: string; file_path: string; old_snippet?: string; new_snippet: string }) =>
    fetchAPI("/deployments/apply-fix", { method: "POST", body: JSON.stringify(data) }),
  rebuild: (data: { clone_dir: string; repo_url?: string; env_vars?: string[] }) =>
    fetchAPI("/deployments/rebuild", { method: "POST", body: JSON.stringify(data) }),

  // Root Cause Analysis
  rcaAnalyze: (anomaly: { type: string; severity: string; message: string; data?: any }, metrics?: any) =>
    fetchAPI("/rca/analyze", { method: "POST", body: JSON.stringify({ anomaly, metrics }) }),
  rcaTests: () => fetchAPI("/rca/tests"),
  rcaCalibrate: () => fetchAPI("/rca/calibrate", { method: "POST" }),
  rcaEvidence: (query: string, topK?: number) =>
    fetchAPI(`/rca/evidence/${encodeURIComponent(query)}?top_k=${topK || 5}`),

  // Incidents
  activeIncidents: () => fetchAPI("/incidents/active"),
  escalateIncident: (id: string, reason?: string) =>
    fetchAPI(`/incidents/${id}/escalate`, { method: "POST", body: JSON.stringify({ reason }) }),
  resolveIncident: (id: string, resolution?: any) =>
    fetchAPI(`/incidents/${id}/resolve`, { method: "POST", body: JSON.stringify(resolution || {}) }),
  incidentHistory: () => fetchAPI("/incidents/history"),
};
