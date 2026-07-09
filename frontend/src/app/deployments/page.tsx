"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Rocket, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function DeploymentsPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [port, setPort] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const deploy = async () => {
    if (!repoUrl.trim()) return;
    setDeploying(true);
    setError("");
    setResult(null);
    try {
      const r = await api.deploy(repoUrl.trim(), port ? Number(port) : undefined);
      setResult(r);
      toast.success("Deployment successful!");
    } catch (e: any) {
      setError(e.message);
      toast.error(`Deploy failed: ${e.message}`);
    } finally {
      setDeploying(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const r = await api.listDeployments();
      setHistory(r.deployments || []);
    } catch {} finally { setHistoryLoading(false); }
  };

  useEffect(() => { loadHistory(); }, []);

  const columns: Column<any>[] = [
    { key: "target", header: "Repo", render: (r) => <span className="font-mono text-xs text-gold-400">{r.target}</span> },
    { key: "timestamp", header: "Time", render: (r) => new Date(r.timestamp).toLocaleString() },
    { key: "result", header: "Result", render: (r) => <Badge variant={r.result === "success" ? "success" : "critical"}>{r.result}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Rocket className="h-6 w-6 text-gold-400" />
        <div>
          <h1 className="text-xl font-semibold text-gold-400">Deploy</h1>
          <p className="text-sm text-ink-500">Deploy from GitHub repos with one click. Docker build + run automated.</p>
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle>Deploy App</CardTitle></CardHeader>
        <CardContent className="space-y-4">
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
            {deploying ? <><Loader2 className="h-4 w-4 animate-spin" /> Deploying…</> : "Deploy"}
          </Button>
          {error && <div className="flex items-center gap-2 rounded-lg bg-status-crit/10 p-3 text-sm text-status-crit"><AlertCircle className="h-4 w-4" /> {error}</div>}
          {result && (
            <div className="space-y-2 rounded-lg bg-status-ok/10 p-3 text-sm text-status-ok">
              <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Deployment successful! <span className="font-medium">{result.stack}</span> app running.</div>
              {result.appUrl && (
                <div>
                  Open app: <a href={result.appUrl} target="_blank" rel="noreferrer" className="font-mono text-gold-400 underline">{result.appUrl}</a>
                  {result.health?.reachable ? " (health check passed)" : " (health check not yet confirmed)"}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Deployment History</CardTitle>
            <Button variant="ghost" size="sm" onClick={loadHistory}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="space-y-2">
              {[1,2,3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <DataTable columns={columns} data={history} pageSize={10} emptyMessage="No deployments yet" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
