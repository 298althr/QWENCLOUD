"use client";

import { useState, useEffect, useCallback } from "react";
import { api, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, SectionCard, StatusPill } from "@/components/design-system";
import { SecretText } from "@/components/SecretField";
import { Rocket, Loader2, CheckCircle2, AlertCircle, Layers, Power, RotateCcw, Trash2, FileText, ExternalLink, Boxes, Eye, EyeOff, Bug, Webhook, Shield } from "lucide-react";
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

type ValidationData = {
  valid: boolean;
  owner?: string;
  repo?: string;
  full_name?: string;
  description?: string;
  default_branch?: string;
  private?: boolean;
  stars?: number;
  language?: string;
  clone_url?: string;
  error?: string;
};

type DeployReport = {
  id: string;
  repo_url: string;
  stage: string;
  error_type: string;
  problem_statement: string;
  possible_causes: string[];
  solutions: string[];
  recommended_action: string;
  raw_error?: string;
  timestamp: string;
};

export default function DeploymentsPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [port, setPort] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [envVarsText, setEnvVarsText] = useState("");
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

  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationData | null>(null);
  const [showEnvVars, setShowEnvVars] = useState(false);

  const [webhookConfigs, setWebhookConfigs] = useState<any[]>([]);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [autoRebuild, setAutoRebuild] = useState(false);

  const [reports, setReports] = useState<DeployReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [investigating, setInvestigating] = useState(false);
  const [showReportDetail, setShowReportDetail] = useState<string | null>(null);

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

  const loadWebhookConfigs = useCallback(async () => {
    try {
      const r = await api.getWebhookConfigs();
      setWebhookConfigs(r.configs || []);
    } catch { /* ignore */ }
  }, []);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const r = await api.getDeploymentReports(20);
      setReports(r.reports || []);
    } catch { /* ignore */ } finally { setReportsLoading(false); }
  }, []);

  useEffect(() => {
    loadApps();
    loadHistory();
    loadWebhookConfigs();
    loadReports();
    const interval = setInterval(() => loadApps(), 10000);
    return () => clearInterval(interval);
  }, [loadApps, loadHistory, loadWebhookConfigs, loadReports]);

  const validateUrl = async () => {
    if (!repoUrl.trim()) return;
    setValidating(true);
    setValidation(null);
    try {
      const r = await api.validateRepoUrl(repoUrl.trim());
      setValidation(r);
      if (r.valid) {
        toast.success(`Valid repo: ${r.full_name}`);
      } else {
        toast.error(`Invalid: ${r.error || "unknown error"}`);
      }
    } catch (e: any) {
      setValidation({ valid: false, error: e.message });
      toast.error(`Validation failed: ${e.message}`);
    } finally {
      setValidating(false);
    }
  };

  const deploy = async () => {
    if (!repoUrl.trim()) return;
    setDeploying(true);
    setError("");
    setResult(null);
    try {
      const envVars = envVarsText.trim()
        ? envVarsText.split("\n").filter((l) => l.includes("=")).map((l) => l.trim())
        : undefined;
      const r = await api.deploy(repoUrl.trim(), port ? Number(port) : undefined);
      setResult(r);
      if (r.success) {
        toast.success("Deployment successful!");
        await loadApps();
        await loadHistory();
        if (autoRebuild) {
          await api.saveWebhookConfig({ repo_url: repoUrl.trim(), autoRebuild: true, env_vars: envVars });
          await loadWebhookConfigs();
          toast.success("Auto-rebuild enabled for this repo");
        }
      } else {
        toast.error(`Deploy failed at ${r.stage}: ${r.error?.substring(0, 100)}`);
        setError(`Failed at ${r.stage}: ${r.error?.substring(0, 200)}`);
      }
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

  const investigateDeployFailure = async () => {
    if (!result && !error) return;
    setInvestigating(true);
    try {
      const failureData = result
        ? { stage: result.stage, error: result.error, findings: result.findings }
        : { stage: "unknown", error };
      const r = await api.investigateFailure({
        repo_url: repoUrl.trim(),
        failure_data: failureData,
      });
      await loadReports();
      setShowReportModal(true);
      setShowReportDetail(r.id);
      toast.success("Investigation complete. Report available.");
    } catch (e: any) {
      toast.error(`Investigation failed: ${e.message}`);
    } finally {
      setInvestigating(false);
    }
  };

  const saveWebhookConfig = async () => {
    if (!repoUrl.trim()) return;
    setWebhookLoading(true);
    try {
      const envVars = envVarsText.trim()
        ? envVarsText.split("\n").filter((l) => l.includes("=")).map((l) => l.trim())
        : [];
      await api.saveWebhookConfig({ repo_url: repoUrl.trim(), autoRebuild, env_vars: envVars });
      await loadWebhookConfigs();
      toast.success("Webhook config saved");
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally {
      setWebhookLoading(false);
    }
  };

  const getAppUrl = (app: DeployedApp): string | null => {
    for (const c of app.containers) {
      const port = c.ports?.find((p) => p.publicPort)?.publicPort;
      if (port) return `http://localhost:${port}`;
    }
    return null;
  };

  const webhookUrl = `${API_BASE.replace("/api", "")}/api/deployments/webhook`;

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Deployments"
        description="Deploy apps from GitHub or Docker Compose stacks. Manage containers, view logs, and rollback."
        badge={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setShowReportModal(!showReportModal); loadReports(); }}
          >
            <Bug className="h-4 w-4 mr-1" />
            Deployment Reports
            {reports.length > 0 && (
              <span className="ml-1 rounded-full bg-status-warn/20 px-1.5 text-xs text-status-warn">
                {reports.length}
              </span>
            )}
          </Button>
        }
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
                  <div className="flex gap-2">
                    <Input
                      value={repoUrl}
                      onChange={(e) => { setRepoUrl(e.target.value); setValidation(null); }}
                      placeholder="https://github.com/user/repo"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={validateUrl}
                      disabled={validating || !repoUrl.trim()}
                    >
                      {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4 mr-1" />}
                      Validate
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-ink-600">Port (optional)</label>
                  <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="auto" />
                </div>
              </div>

              {validation && (
                <div className={`rounded-lg p-3 text-sm ${validation.valid ? "bg-status-ok/10 text-status-ok" : "bg-status-crit/10 text-status-crit"}`}>
                  {validation.valid ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Valid: {validation.full_name}</div>
                      <div className="text-xs text-ink-500">
                        {validation.description || "No description"} | {validation.language || "unknown"} | {validation.stars || 0} stars | branch: {validation.default_branch || "main"}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {validation.error}</div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-ink-600">Public URL (optional, self-managed)</label>
                <Input
                  value={publicUrl}
                  onChange={(e) => setPublicUrl(e.target.value)}
                  placeholder="https://myapp.example.com"
                />
                <p className="text-xs text-ink-600">Set this if you have a domain pointing to this deployment. Otherwise the system uses the server IP.</p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-ink-600">Environment Variables (optional, one per line as KEY=value)</label>
                  <button
                    type="button"
                    onClick={() => setShowEnvVars(!showEnvVars)}
                    className="text-ink-600 hover:text-ink-300 transition-colors"
                  >
                    {showEnvVars ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <textarea
                  className={`w-full rounded-md border border-ink-700 bg-ink-950 p-3 font-mono text-xs focus:border-gold-700 focus:outline-none ${showEnvVars ? "text-ink-200" : "text-transparent"}`}
                  value={envVarsText}
                  onChange={(e) => setEnvVarsText(e.target.value)}
                  placeholder={"DATABASE_URL=postgres://user:pass@host:5432/db\nAPI_KEY=your-secret-key"}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-950/30 p-3">
                <Webhook className="h-4 w-4 text-ink-500" />
                <div className="flex-1">
                  <label className="text-sm text-ink-300">Enable auto-rebuild on push</label>
                  <p className="text-xs text-ink-600">Adds a webhook config so new pushes to this repo trigger an automatic rebuild.</p>
                </div>
                <input
                  type="checkbox"
                  checked={autoRebuild}
                  onChange={(e) => setAutoRebuild(e.target.checked)}
                  className="h-4 w-4 accent-gold-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={deploy} disabled={deploying || !repoUrl.trim()}>
                  {deploying ? <><Loader2 className="h-4 w-4 animate-spin" /> Deploying...</> : <><Rocket className="h-4 w-4 mr-1" /> Deploy</>}
                </Button>
                {autoRebuild && (
                  <Button variant="outline" size="sm" onClick={saveWebhookConfig} disabled={webhookLoading || !repoUrl.trim()}>
                    {webhookLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Webhook className="h-4 w-4 mr-1" />}
                    Save Webhook Config
                  </Button>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="space-y-2 rounded-lg bg-status-crit/10 p-3 text-sm text-status-crit">
              <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {error}</div>
              <Button variant="outline" size="sm" onClick={investigateDeployFailure} disabled={investigating}>
                {investigating ? <><Loader2 className="h-4 w-4 animate-spin" /> Investigating...</> : <><Bug className="h-4 w-4 mr-1" /> Investigate with AI</>}
              </Button>
            </div>
          )}
          {result && result.success && (
            <div className="space-y-2 rounded-lg bg-status-ok/10 p-3 text-sm text-status-ok">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Deployment successful! <span className="font-medium">{result.stack}</span> app running.</div>
              {result.appUrl && (
                <div>
                  Open app: <a href={result.appUrl} target="_blank" rel="noreferrer" className="font-mono text-gold-700 underline">{result.appUrl}</a>
                  {result.health?.reachable ? " (health check passed)" : " (health check pending)"}
                </div>
              )}
              {publicUrl && (
                <div>Public URL: <span className="font-mono text-gold-700">{publicUrl}</span></div>
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
          {result && !result.success && (
            <div className="space-y-2 rounded-lg bg-status-crit/10 p-3 text-sm text-status-crit">
              <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Failed at stage: {result.stage}</div>
              <pre className="max-h-32 overflow-auto rounded bg-ink-950 p-2 text-xs text-ink-400 font-mono whitespace-pre-wrap">{result.error?.substring(0, 500)}</pre>
              <Button variant="outline" size="sm" onClick={investigateDeployFailure} disabled={investigating}>
                {investigating ? <><Loader2 className="h-4 w-4 animate-spin" /> Investigating...</> : <><Bug className="h-4 w-4 mr-1" /> Investigate with AI</>}
              </Button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Webhook URL display */}
      {webhookConfigs.length > 0 && (
        <SectionCard title="Auto-Rebuild Webhooks" description="GitHub webhook configuration for automatic rebuilds" delay={0.05}>
          <div className="space-y-3">
            <SecretText label="Webhook URL" value={webhookUrl} />
            <p className="text-xs text-ink-600">
              Add this URL to your GitHub repo under Settings then Webhooks. Set content type to application/json. Select push events.
            </p>
            <div className="space-y-1">
              {webhookConfigs.map((cfg, i) => (
                <div key={i} className="flex items-center justify-between rounded border border-ink-800 px-3 py-2 text-xs">
                  <span className="font-mono text-gold-700 truncate max-w-[300px]">{cfg.repo_url}</span>
                  <span className="text-ink-500 shrink-0 ml-2">{cfg.envVarsCount} env vars</span>
                  <span className={`ml-2 shrink-0 ${cfg.autoRebuild ? "text-status-ok" : "text-ink-500"}`}>
                    {cfg.autoRebuild ? "active" : "paused"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

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
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="View Logs" onClick={() => viewLogs(c.id)}>
                            <FileText className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Restart" onClick={() => handleAction(c.id, "restart")} disabled={actionLoading === `${c.id}-restart`}>
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title={c.state === "running" ? "Stop" : "Start"} onClick={() => handleAction(c.id, c.state === "running" ? "stop" : "start")} disabled={actionLoading === `${c.id}-${c.state === "running" ? "stop" : "start"}`}>
                            {c.state === "running" ? <Power className="h-3 w-3 text-status-crit" /> : <Power className="h-3 w-3 text-status-ok" />}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Remove" onClick={() => handleAction(c.id, "remove")} disabled={actionLoading === `${c.id}-remove`}>
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
          headerActions={<Button variant="ghost" size="sm" onClick={() => setLogsFor(null)}>Close</Button>}
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
        headerActions={<Button variant="ghost" size="sm" onClick={loadHistory}>Refresh</Button>}
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

      {/* Deployment Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowReportModal(false)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-lg border border-ink-700 bg-ink-900 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-ink-100">Deployment Reports</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowReportModal(false)}>Close</Button>
            </div>

            {reportsLoading ? (
              <div className="flex items-center justify-center py-8 text-ink-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading reports...
              </div>
            ) : reports.length === 0 ? (
              <div className="text-sm text-ink-500 py-8 text-center">No deployment reports yet. Reports are generated automatically when a build fails.</div>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => (
                  <div key={r.id} className="rounded-lg border border-ink-800 bg-ink-950/30 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`badge ${r.error_type === "dependency" ? "warn" : r.error_type === "code" ? "crit" : "info"}`}>
                          {r.error_type}
                        </span>
                        <span className="text-xs text-ink-500">{new Date(r.timestamp).toLocaleString()}</span>
                      </div>
                      <button
                        onClick={() => setShowReportDetail(showReportDetail === r.id ? null : r.id)}
                        className="text-xs text-gold-700 hover:underline"
                      >
                        {showReportDetail === r.id ? "Hide" : "Reveal"}
                      </button>
                    </div>
                    <div className="text-xs font-mono text-ink-500 mb-2 truncate">{r.repo_url}</div>
                    <p className="text-sm text-ink-300 mb-2">{r.problem_statement}</p>
                    {showReportDetail === r.id && (
                      <div className="mt-3 space-y-3">
                        <div>
                          <p className="text-xs font-medium text-ink-400 mb-1">Possible Causes:</p>
                          <ul className="space-y-1">
                            {r.possible_causes?.map((c, i) => (
                              <li key={i} className="text-xs text-ink-500 flex items-start gap-2">
                                <span className="text-status-warn shrink-0">-</span>
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-ink-400 mb-1">Solutions:</p>
                          <ul className="space-y-1">
                            {r.solutions?.map((s, i) => (
                              <li key={i} className="text-xs text-ink-500 flex items-start gap-2">
                                <span className="text-status-ok shrink-0">-</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded border border-gold-700/30 bg-gold-700/5 p-2">
                          <p className="text-xs font-medium text-gold-700 mb-1">Recommended Action:</p>
                          <p className="text-xs text-ink-300">{r.recommended_action}</p>
                        </div>
                        {r.raw_error && (
                          <div>
                            <p className="text-xs font-medium text-ink-400 mb-1">Raw Error:</p>
                            <pre className="rounded bg-ink-950 p-2 text-xs text-ink-500 font-mono whitespace-pre-wrap max-h-32 overflow-auto">{r.raw_error}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
