"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function DeploymentsPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [port, setPort] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);

  const deploy = async () => {
    if (!repoUrl.trim()) return;
    setDeploying(true);
    setError("");
    setResult(null);
    try {
      const r = await api.deploy(repoUrl.trim(), port ? Number(port) : undefined);
      setResult(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeploying(false);
    }
  };

  const loadHistory = async () => {
    try {
      const r = await api.listDeployments();
      setHistory(r.deployments || []);
    } catch {}
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gold-400">Deployments</h1>
        <p className="text-sm text-ink-500">Deploy from GitHub repos with one click. Docker build + run automated.</p>
      </header>

      <section className="card-glow p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-500">New Deployment</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="text-xs text-ink-600">GitHub Repo URL</label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
              className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-200 placeholder-ink-600 focus:border-gold-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-ink-600">Port (optional)</label>
            <input
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="8080"
              className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-200 placeholder-ink-600 focus:border-gold-500 focus:outline-none"
            />
          </div>
        </div>
        <button
          onClick={deploy}
          disabled={deploying || !repoUrl.trim()}
          className="mt-4 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-50 hover:from-gold-400 hover:to-gold-500 transition-all"
        >
          {deploying ? "Deploying…" : "Deploy"}
        </button>

        {error && <div className="mt-3 rounded-lg bg-accent-crit/10 p-3 text-sm text-accent-crit">{error}</div>}
        {result && (
          <div className="mt-3 rounded-lg bg-accent-ok/10 p-3 text-sm text-accent-ok">
            Deployment successful! Container running.
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Deployment History</h2>
          <button onClick={loadHistory} className="text-xs text-gold-400 hover:text-gold-300">Refresh</button>
        </div>
        <div className="space-y-2 text-xs">
          {history.map((d, i) => (
            <div key={i} className="flex items-center justify-between border-b border-ink-800/30 py-2">
              <span className="font-mono text-ink-300">{d.target}</span>
              <div className="flex gap-3">
                <span className="text-ink-600">{new Date(d.timestamp).toLocaleString()}</span>
                <span className={`pill ${d.result === "success" ? "pill-ok" : "pill-crit"}`}>{d.result}</span>
              </div>
            </div>
          ))}
          {history.length === 0 && <p className="text-ink-600">Click Refresh to load deployment history.</p>}
        </div>
      </section>
    </div>
  );
}
