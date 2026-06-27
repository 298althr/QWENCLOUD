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
};
