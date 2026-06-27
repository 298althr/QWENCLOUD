"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { onServerMetrics } from "@/lib/websocket";

export default function MonitoringPage() {
  const [processes, setProcesses] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [containers, setContainers] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<{ cpu: number; ram: number; disk: number | null } | null>(null);

  useEffect(() => {
    api.processes("cpu", 30).then((r) => setProcesses(r.processes || [])).catch(() => {});
    api.ports().then((r) => setPorts(r.ports || [])).catch(() => {});
    api.dockerContainers().then((r) => setContainers(r.containers || [])).catch(() => {});
    const off = onServerMetrics((m) => setMetrics({ cpu: m.cpu, ram: m.ram, disk: m.disk }));
    return () => { off(); };
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gold-400">Monitoring</h1>
        <p className="text-sm text-ink-500">Real-time server metrics, processes, ports, and Docker containers.</p>
      </header>

      {/* Live metrics */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: "CPU", value: metrics?.cpu, unit: "%", threshold: 85 },
          { label: "RAM", value: metrics?.ram, unit: "%", threshold: 90 },
          { label: "Disk", value: metrics?.disk, unit: "%", threshold: 85 },
        ].map((m) => (
          <div key={m.label} className="card p-5">
            <h3 className="text-sm font-medium text-ink-500">{m.label}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gold-400">{m.value !== null && m.value !== undefined ? m.value.toFixed(1) : "—"}</span>
              <span className="text-sm text-ink-600">{m.unit}</span>
            </div>
            {m.value !== null && m.value !== undefined && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-800">
                <div
                  className={`h-full transition-all ${m.value > m.threshold ? "bg-accent-crit" : m.value > m.threshold * 0.7 ? "bg-accent-warn" : "bg-accent-ok"}`}
                  style={{ width: `${Math.min(m.value, 100)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Processes table */}
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">Top Processes (by CPU)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-ink-700 text-ink-600">
                <th className="py-2 text-left">PID</th>
                <th className="py-2 text-left">Name</th>
                <th className="py-2 text-right">CPU %</th>
                <th className="py-2 text-right">MEM %</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p, i) => (
                <tr key={i} className="border-b border-ink-800/50">
                  <td className="py-1.5 font-mono text-ink-400">{p.pid}</td>
                  <td className="py-1.5 text-ink-200">{p.name}</td>
                  <td className="py-1.5 text-right text-ink-300">{typeof p.cpu === "number" ? p.cpu.toFixed(1) : "—"}</td>
                  <td className="py-1.5 text-right text-ink-300">{typeof p.mem === "number" ? p.mem.toFixed(1) : "—"}</td>
                </tr>
              ))}
              {processes.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-ink-600">No process data</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Ports */}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">Listening Ports</h2>
          <div className="space-y-1.5 text-xs">
            {ports.map((p, i) => (
              <div key={i} className="flex justify-between border-b border-ink-800/30 py-1">
                <span className="font-mono text-ink-300">{p.port || p.localPort}</span>
                <span className="text-ink-600">{p.process || p.processName || "—"}</span>
              </div>
            ))}
            {ports.length === 0 && <p className="text-ink-600">No port data</p>}
          </div>
        </section>

        {/* Docker containers */}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">Docker Containers</h2>
          <div className="space-y-2 text-xs">
            {containers.map((c, i) => (
              <div key={i} className="flex items-center justify-between border-b border-ink-800/30 py-1.5">
                <span className="font-mono text-ink-300">{c.name || c.id?.slice(0, 12)}</span>
                <span className={`pill ${c.status?.includes("Up") ? "pill-ok" : "pill-crit"}`}>{c.status || "unknown"}</span>
              </div>
            ))}
            {containers.length === 0 && <p className="text-ink-600">No containers running</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
