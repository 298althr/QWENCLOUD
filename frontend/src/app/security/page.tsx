"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export default function SecurityPage() {
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const loadAudit = async () => {
    try {
      const r = await api.auditLog(50);
      setAuditLog(r.entries || []);
    } catch {}
  };

  useEffect(() => { loadAudit(); }, []);

  const runScan = async () => {
    setScanning(true);
    try {
      const r = await api.securityScan();
      setScanResult(r);
    } catch {}
    finally { setScanning(false); }
  };

  const safLayers = [
    { name: "L1: Asset Classification", status: "active" },
    { name: "L2: Identity Verification", status: "active" },
    { name: "L3: Network Segmentation", status: "active" },
    { name: "L4: Policy Enforcement", status: "active" },
    { name: "L5: Immutable Logging", status: "active" },
    { name: "L6: Containment", status: "active" },
    { name: "L7: Governance Compliance", status: "active" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gold-400">Security</h1>
        <p className="text-sm text-ink-500">SAF 7-layer framework status, audit log, and security scans.</p>
      </header>

      {/* SAF 7-layer status */}
      <section className="card-glow p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-500">SAF 7-Layer Framework</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
          {safLayers.map((l) => (
            <div key={l.name} className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-950/30 p-3">
              <span className="h-2 w-2 rounded-full bg-accent-ok" />
              <span className="text-xs text-ink-300">{l.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Security scan */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Security Scan</h2>
          <button
            onClick={runScan}
            disabled={scanning}
            className="rounded-lg bg-accent-info/20 px-4 py-2 text-xs font-medium text-accent-info disabled:opacity-50 hover:bg-accent-info/30"
          >
            {scanning ? "Scanning…" : "Run Scan"}
          </button>
        </div>
        {scanResult && (
          <div className="rounded-lg bg-ink-950/50 p-3 text-xs">
            <div className="flex gap-4">
              <span className="text-ink-500">User: <span className="text-gold-400">{scanResult.user}</span></span>
              <span className="text-ink-500">Open ports: <span className="text-gold-400">{scanResult.open_ports?.length || 0}</span></span>
              <span className="text-ink-500">Status: <span className="text-accent-ok">{scanResult.status}</span></span>
            </div>
          </div>
        )}
      </section>

      {/* Audit log */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Audit Log (Immutable)</h2>
          <button onClick={loadAudit} className="text-xs text-gold-400 hover:text-gold-300">Refresh</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-ink-700 text-ink-600">
                <th className="py-2 text-left">Time</th>
                <th className="py-2 text-left">Operation</th>
                <th className="py-2 text-left">Target</th>
                <th className="py-2 text-left">Result</th>
                <th className="py-2 text-left">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((e, i) => (
                <tr key={i} className="border-b border-ink-800/30">
                  <td className="py-1.5 text-ink-600">{new Date(e.timestamp).toLocaleTimeString()}</td>
                  <td className="py-1.5 text-ink-300">{e.operation}</td>
                  <td className="py-1.5 font-mono text-ink-400">{e.target?.slice(0, 40)}</td>
                  <td className="py-1.5">
                    <span className={`pill ${e.result === "success" ? "pill-ok" : e.result === "blocked" || e.result === "failure" ? "pill-crit" : "pill-info"}`}>
                      {e.result}
                    </span>
                  </td>
                  <td className="py-1.5 text-ink-400">{e.confidence !== null ? `${(e.confidence * 100).toFixed(0)}%` : "—"}</td>
                </tr>
              ))}
              {auditLog.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-ink-600">No audit entries</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
