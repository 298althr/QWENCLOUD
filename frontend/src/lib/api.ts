// frontend/src/lib/api.ts
// API client for ALTHR Autopilot backend.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3000/api";

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

  // Agent
  agent: (message: string) =>
    fetchAPI("/agent", { method: "POST", body: JSON.stringify({ message }) }),

  // Approvals
  approve: (action_id: string) =>
    fetchAPI("/approvals/approve", { method: "POST", body: JSON.stringify({ action_id }) }),
  reject: (action_id: string, reason?: string) =>
    fetchAPI("/approvals/reject", { method: "POST", body: JSON.stringify({ action_id, reason }) }),
  pendingApprovals: () => fetchAPI("/approvals/pending"),

  // Monitoring
  processes: (sortBy = "cpu", limit = 50) =>
    fetchAPI(`/processes?sort_by=${sortBy}&limit=${limit}`),
  ports: () => fetchAPI("/ports"),
  dockerContainers: () => fetchAPI("/docker/containers"),

  // Command
  runCommand: (command: string, timeout?: number) =>
    fetchAPI("/command", { method: "POST", body: JSON.stringify({ command, timeout }) }),

  // Files
  listFiles: (path = ".") => fetchAPI(`/file/list?path=${encodeURIComponent(path)}`),
  readFile: (path: string) => fetchAPI(`/file/read?path=${encodeURIComponent(path)}`),
  writeFile: (path: string, content: string) =>
    fetchAPI("/file/write", { method: "POST", body: JSON.stringify({ path, content }) }),

  // Deployments
  deploy: (repo_url: string, port?: number) =>
    fetchAPI("/deployments", { method: "POST", body: JSON.stringify({ repo_url, port }) }),
  listDeployments: () => fetchAPI("/deployments"),

  // Simulation
  simulateAnomaly: (type: "cpu" | "ram" | "disk" | "port", value?: number) =>
    fetchAPI("/simulate/anomaly", { method: "POST", body: JSON.stringify({ type, value }) }),

  // Security
  auditLog: (limit = 50) => fetchAPI(`/security/audit?limit=${limit}`),
  securityScan: () => fetchAPI("/security/scan", { method: "POST" }),

  // Memory
  memory: (layer: string, limit = 20) => fetchAPI(`/memory/${layer}?limit=${limit}`),
  storeMemory: (layer: string, content: string, metadata?: any) =>
    fetchAPI("/memory/store", { method: "POST", body: JSON.stringify({ layer, content, metadata }) }),
  searchMemory: (query: string, layers = "M6,M7", limit = 10) =>
    fetchAPI(`/memory/search?query=${encodeURIComponent(query)}&layers=${layers}&limit=${limit}`),

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
};
