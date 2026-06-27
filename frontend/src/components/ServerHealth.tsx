"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { onServerMetrics } from "@/lib/websocket";

type HealthData = {
  cpu?: number;
  ram?: number;
  disk?: number | null;
  status?: string;
  services?: { postgres: string; redis: string };
};

export default function ServerHealth() {
  const [health, setHealth] = useState<HealthData>({});
  const [wsMetrics, setWsMetrics] = useState<{ cpu: number; ram: number; disk: number | null } | null>(null);

  useEffect(() => {
    api.serverHealth().then(setHealth).catch(() => {});
    const off = onServerMetrics((m) => setWsMetrics({ cpu: m.cpu, ram: m.ram, disk: m.disk }));
    return () => off();
  }, []);

  const cpu = wsMetrics?.cpu ?? health.cpu;
  const ram = wsMetrics?.ram ?? health.ram;
  const disk = wsMetrics?.disk ?? health.disk;

  const metricBar = (label: string, value: number | null | undefined, threshold = 85) => {
    if (value === null || value === undefined) return null;
    const pct = Math.min(value, 100);
    const color = value > threshold ? "bg-accent-crit" : value > threshold * 0.7 ? "bg-accent-warn" : "bg-accent-ok";
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-ink-500">{label}</span>
          <span className="text-ink-300">{value.toFixed(1)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink-800">
          <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="card p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-500">Server Health</h2>
      <div className="space-y-3">
        {metricBar("CPU", cpu)}
        {metricBar("RAM", ram)}
        {metricBar("Disk", disk)}
      </div>
      {health.services && (
        <div className="mt-4 flex gap-3 text-xs">
          <span className={`pill ${health.services.postgres === "ok" ? "pill-ok" : "pill-crit"}`}>
            PG: {health.services.postgres}
          </span>
          <span className={`pill ${health.services.redis === "ok" ? "pill-ok" : "pill-crit"}`}>
            Redis: {health.services.redis}
          </span>
        </div>
      )}
    </div>
  );
}
