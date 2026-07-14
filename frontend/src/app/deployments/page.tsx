"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, SectionCard, StatusPill } from "@/components/design-system";
import { Rocket, Loader2, CheckCircle2, AlertCircle, Layers, Power, RotateCcw, Trash2, FileText, ExternalLink, Boxes } from "lucide-react";
import { toast } from "sonner";

type DeployedApp = {
  name: string;
  status: string;
  running: number;
  total: number;
  containers: Array<{
    id: string;
    name: string;
    image: string;
    state: string;
    ports: Array<{ publicPort: number | null; privatePort: number; type: string }>;
    service: string;
  }>;
};

export default function DeploymentsPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [port, setPort] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [apps, setApps] = useState<DeployedApp[]>([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [logsFor, setLogsFor] = useState<string | null>(null);
  const [logs, setLogs] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [stackMode, setStackMode] = useState(false);
  const [composeContent, setComposeContent] = useState("");
  const [stackName, setStackName] = useState("");
  const [deployingStack, setDeployingStack] = useState(false);

  const loadApps = useCallback(async () => {
    try {
      const r = await api.listDeployedApps();
      setApps(r.apps || []);
    } catch { /* ignore */ } finally { setAppsLoading(false); }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const r = await api.listDeployments();
      setHistory(r.deployments || []);
    } catch { /* ignore */ } finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => {
    loadApps();
    loadHistory();
    const interval = setInterval(() => loadApps(), 10000);
    return () => clearInterval(interval);
  }, [loadApps, loadHistory]);

  const deploy = async () => {
    if (!repoUrl.trim()) return;
    setDeploying(true);
    setError("");
    setResult(null);
    try {
      const r = await api.deploy(repoUrl.trim(), port ? Number(port) : undefined);
      setResult(r);
      toast.success("Deployment successful!");
      await loadApps();
    } catch (e: any) {
      setError(e.message);
      toast.error(`Deploy failed: ${e.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const deployStackFn = async () => {
    if (!composeContent.trim()) return;
    setDeployingStack(true);
    setError("");
    try {
      const r = await api.deployStack({ compose_content: composeContent, name: stackName || undefined });
      toast.success(`Stack deployed with ${r.serviceCount} services`);
      await loadApps();
      setStackMode(false);
      setComposeContent("");
      setStackName("");
    } catch (e: any) {
      setError(e.message);
      toast.error(`Stack deploy failed: ${e.message}`);
    } finally {
      setDeployingStack(false);
    }
  };

  const handleAction = async (containerId: string, action: "start" | "stop" | "restart" | "remove") => {
    setActionLoading(`${containerId}-${action}`);
    try {
      await api.deploymentAction(containerId, action);
      toast.success(`Container ${action} sent`);
      await loadApps();
    } catch (e: any) {
      toast.error(`${action} failed: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const viewLogs = async (containerId: string) => {
    if (logsFor === containerId) {
      setLogsFor(null);
      return;
    }
    setLogsFor(containerId);
    setLogsLoading(true);
    setLogs("");
    try {
      const r = await api.getDeploymentLogs(containerId, 50);
      setLogs(r.logs || "No logs available");
    } catch (e: any) {
      setLogs(`Error fetching logs: ${e.message}`);
    } finally {
      setLogsLoading(false);
    }
  };

  const getAppUrl = (app: DeployedApp): string | null => {
    for (const c of app.containers) {
      const port = c.ports?.find((p) => p.publicPort)?.publicPort;
      if (port) return `http://localhost:${port}`;
    }
    return null;
  };

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Deployments"
        description="Deploy apps from GitHub or Docker Compose stacks. Manage containers, view logs, and rollback."
      />

      <SectionCard
        title={stackMode ? "Deploy Docker Compose Stack" : "Deploy App"}
        description={stackMode ? "Paste a docker-compose.yml to deploy all services" : "Clone a GitHub repo, auto-detect stack, build and run"}
        delay={0}
        headerActions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStackMode(!stackMode); setError(""); setResult(null); }}
          >
            {stackMode ? <Rocket className="h-4 w-4 mr-1" /> : <Layers className="h-4 w-4 mr-1" />}
            {stackMode ? "Single App" : "Stack"}
          </Button>
        }
      >
        <div className="space-y-4">
          {stackMode ? (
            <>
              <div className="space-y-1">
                <label className="text-xs text-ink-600">Stack Name (optional)</label>
                <Input value={stackName} onChange={(e) => setStackName(e.target.value)} placeholder="my-stack" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-ink-600">docker-compose.yml content</label>
                <textarea
                  className="w-full min-h-[200px] rounded-md border border-ink-700 bg-ink-900 p-3 font-mono text-xs text-ink-200 focus:border-gold-700 focus:outline-none"
                  value={composeContent}
                  onChange={(e) => setComposeContent(e.target.value)}
                  placeholder={"version: '3.8'\nservices:\n  web:\n    image: nginx:alpine\n    ports:\n      - '8080:80'"}
                />
              </div>
              <Button onClick={deployStackFn} disabled={deployingStack || !composeContent.trim()}>
                {deployingStack ? <><Loader2 className="h-4 w-4 animate-spin" /> Deploying Stack...</> : <><Layers className="h-4 w-4 mr-1" /> Deploy Stack</>}
              </Button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs text-ink-600">GitHub Repo URL</label>
                  <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/user/repo" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-ink-600">Port (optional)</label>
                  <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="8080" />
                </div>
              </div>
              <Button onClick={deploy} disabled={deploying || !repoUrl.trim()}>
                {deploying ? <><Loader2 className="h-4 w-4 animate-spin" /> Deploying...</> : <><Rocket className="h-4 w-4 mr-1" /> Deploy</>}
              </Button>
            </>
          )}

          {error && <div className="flex items-center gap-2 rounded-lg bg-status-crit/10 p-3 text-sm text-status-crit"><AlertCircle className="h-4 w-4" /> {error}</div>}
          {result && (
            <div className="space-y-2 rounded-lg bg-status-ok/10 p-3 text-sm text-status-ok">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Deployment successful! <span className="font-medium">{result.stack}</span> app running.</div>
              {result.appUrl && (
                <div>
                  Open app: <a href={result.appUrl} target="_blank" rel="noreferrer" className="font-mono text-gold-700 underline">{result.appUrl}</a>
                  {result.health?.reachable ? " (health check passed)" : " (health check pending)"}
                </div>
              )}
              {result.findings?.length > 0 && (
                <ul className="mt-2 space-y-1 text-ink-300">
                  {result.findings.map((f: any, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={`badge ${f.severity === "warning" ? "warn" : "info"}`}>{f.severity}</span>
                      <span>{f.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Deployed Apps Cards */}
      <SectionCard
        title="Deployed Apps"
        description="All running containers grouped by project"
        delay={0.05}
        headerActions={
          <Button variant="ghost" size="sm" onClick={loadApps}>Refresh</Button>
        }
      >
        {appsLoading ? (
          <div className="flex items-center justify-center py-8 text-ink-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading apps...
          </div>
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-ink-500">
            <Boxes className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No deployed apps yet. Deploy from GitHub or a Compose stack above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {apps.map((app) => {
              const appUrl = getAppUrl(app);
              return (
                <div
                  key={app.name}
                  className={`rounded-lg border p-4 ${
                    app.status === "running" ? "border-status-ok/30 bg-status-ok/5" :
                    app.status === "degraded" ? "border-status-warn/30 bg-status-warn/5" :
                    "border-status-crit/30 bg-status-crit/5"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink-200 truncate">
                      <Boxes className="h-4 w-4 shrink-0" />
                      {app.name}
                    </span>
                    <StatusPill variant={app.status === "running" ? "ok" : app.status === "degraded" ? "warn" : "crit"} pulse={app.status !== "running"}>
                      {app.status}
                    </StatusPill>
                  </div>

                  <div className="text-xs text-ink-500 mb-3">
                    {app.running}/{app.total} containers running
                  </div>

                  {appUrl && (
                    <a href={appUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gold-700 hover:underline mb-3">
                      <ExternalLink className="h-3 w-3" /> {appUrl}
                    </a>
                  )}

                  <div className="space-y-1.5">
                    {app.containers.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded border border-ink-800 bg-ink-950/30 px-2 py-1.5">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.state === "running" ? "bg-status-ok" : "bg-status-crit"}`} />
                          <span className="text-xs text-ink-300 truncate" title={c.name}>{c.service}</span>
                          <span className={`text-[10px] shrink-0 ${c.state === "running" ? "text-status-ok" : "text-status-crit"}`}>
                            {c.state}
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="View Logs"
                            onClick={() => viewLogs(c.id)}
                          >
                            <FileText className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Restart"
                            onClick={() => handleAction(c.id, "restart")}
                            disabled={actionLoading === `${c.id}-restart`}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title={c.state === "running" ? "Stop" : "Start"}
                            onClick={() => handleAction(c.id, c.state === "running" ? "stop" : "start")}
                            disabled={actionLoading === `${c.id}-${c.state === "running" ? "stop" : "start"}`}
                          >
                            {c.state === "running" ? <Power className="h-3 w-3 text-status-crit" /> : <Power className="h-3 w-3 text-status-ok" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Remove"
                            onClick={() => handleAction(c.id, "remove")}
                            disabled={actionLoading === `${c.id}-remove`}
                          >
                            <Trash2 className="h-3 w-3 text-status-crit" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Logs viewer */}
      {logsFor && (
        <SectionCard
          title={`Container Logs: ${logsFor.substring(0, 12)}`}
          description="Last 50 log lines"
          delay={0.1}
          headerActions={
            <Button variant="ghost" size="sm" onClick={() => setLogsFor(null)}>Close</Button>
          }
        >
          {logsLoading ? (
            <div className="flex items-center justify-center py-4 text-ink-500">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading logs...
            </div>
          ) : (
            <pre className="max-h-80 overflow-auto rounded-md bg-ink-900 p-3 text-xs text-ink-300 font-mono whitespace-pre-wrap">
              {logs || "No logs available"}
            </pre>
          )}
        </SectionCard>
      )}

      {/* Deployment History */}
      <SectionCard
        title="Deployment History"
        description="Audit log of all deployments"
        delay={0.15}
        headerActions={
          <Button variant="ghost" size="sm" onClick={loadHistory}>Refresh</Button>
        }
      >
        {historyLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-ink-800" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-sm text-ink-500 py-4 text-center">No deployments yet</div>
        ) : (
          <div className="space-y-1">
            {history.slice(0, 10).map((h, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-ink-800 px-3 py-2 text-xs">
                <span className="font-mono text-gold-700 truncate max-w-[300px]">{h.target}</span>
                <span className="text-ink-500 shrink-0 ml-2">{new Date(h.timestamp).toLocaleString()}</span>
                <span className={`ml-2 shrink-0 ${h.result === "success" ? "text-status-ok" : "text-status-crit"}`}>{h.result}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
