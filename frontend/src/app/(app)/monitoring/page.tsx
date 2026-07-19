"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { onServerMetrics } from "@/lib/websocket";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AreaChart } from "@/components/charts/AreaChart";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageHeader, SectionCard, MetricCard, StatusPill, PageLoader } from "@/components/design-system";
import RcaPanel from "@/components/RcaPanel";
import { Activity, Cpu, MemoryStick, HardDrive, Container, Network, AlertTriangle, History } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_POINTS = 60;

function getStatus(value: number | null, warn: number, crit: number): "ok" | "warn" | "crit" {
  if (value === null || value === undefined) return "ok";
  if (value >= crit) return "crit";
  if (value >= warn) return "warn";
  return "ok";
}

export default function MonitoringPage() {
  const [processes, setProcesses] = useState<any[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [containers, setContainers] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<{ cpu: number; ram: number; disk: number | null } | null>(null);
  const cpuHistory = useRef<{ time: string; value: number }[]>([]);
  const ramHistory = useRef<{ time: string; value: number }[]>([]);
  const diskHistory = useRef<{ time: string; value: number }[]>([]);
  const [, forceTick] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [actionHistory, setActionHistory] = useState<any[]>([]);

  useEffect(() => {
    // Load historical metrics on mount to pre-fill graphs
    api.monitorHistory(60, "all").then((r) => {
      if (r.metrics && r.metrics.length > 0) {
        const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
        cpuHistory.current = r.metrics.map((m: any) => ({ time: fmtTime(m.timestamp), value: Number(m.cpu) }));
        ramHistory.current = r.metrics.map((m: any) => ({ time: fmtTime(m.timestamp), value: Number(m.ram) }));
        const diskMetrics = r.metrics.filter((m: any) => m.disk !== null);
        diskHistory.current = diskMetrics.map((m: any) => ({ time: fmtTime(m.timestamp), value: Number(m.disk) }));
        if (r.metrics.length > 0) {
          const latest = r.metrics[r.metrics.length - 1];
          setMetrics({ cpu: Number(latest.cpu), ram: Number(latest.ram), disk: latest.disk !== null ? Number(latest.disk) : null });
        }
        forceTick((t) => t + 1);
      }
    }).catch(() => {});
    // Load action history
    api.actionHistory(20).then((r) => setActionHistory(r.actions || [])).catch(() => {});
    api.processes("cpu", 50).then((r) => setProcesses(r.processes || [])).catch(() => {});
    api.ports().then((r) => setPorts(r.ports || [])).catch(() => {});
    api.dockerContainers().then((r) => { setContainers(r.containers || []); setDataLoaded(true); }).catch(() => setDataLoaded(true));
    const off = onServerMetrics((m) => {
      setMetrics({ cpu: m.cpu, ram: m.ram, disk: m.disk });
      const now = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      cpuHistory.current = [...cpuHistory.current, { time: now, value: m.cpu }].slice(-MAX_POINTS);
      ramHistory.current = [...ramHistory.current, { time: now, value: m.ram }].slice(-MAX_POINTS);
      if (m.disk !== null && m.disk !== undefined) {
        diskHistory.current = [...diskHistory.current, { time: now, value: m.disk }].slice(-MAX_POINTS);
      }
      forceTick((t) => t + 1);
    });
    return () => { off(); };
  }, []);

  const cpu = metrics?.cpu ?? 0;
  const ram = metrics?.ram ?? 0;
  const disk = metrics?.disk ?? null;
  const cpuStatus = getStatus(cpu, 60, 85);
  const ramStatus = getStatus(ram, 70, 90);
  const diskStatus = getStatus(disk, 70, 85);
  const overallStatus = [cpuStatus, ramStatus, diskStatus].some((s) => s === "crit") ? "crit" :
    [cpuStatus, ramStatus, diskStatus].some((s) => s === "warn") ? "warn" : "ok";

  const processColumns: Column<any>[] = [
    { key: "pid", header: "PID", render: (r) => <span className="font-mono text-ink-400">{r.pid}</span> },
    { key: "name", header: "Name" },
    { key: "cpu", header: "CPU %", render: (r) => <span className={cn("font-mono", r.cpu > 50 ? "text-status-warn" : "text-ink-300")}>{typeof r.cpu === "number" ? r.cpu.toFixed(1) : "—"}</span> },
    { key: "mem", header: "MEM %", render: (r) => <span className={cn("font-mono", r.mem > 50 ? "text-status-warn" : "text-ink-300")}>{typeof r.mem === "number" ? r.mem.toFixed(1) : "—"}</span> },
  ];

  const portColumns: Column<any>[] = [
    { key: "port", header: "Port", render: (r) => <span className="font-mono text-gold-700">{r.port || r.localPort}</span> },
    { key: "process", header: "Process", render: (r) => r.process || r.processName || "—" },
    { key: "protocol", header: "Protocol", render: (r) => <span className="font-mono text-xs text-ink-500">{r.protocol || "tcp"}</span> },
  ];

  const containerColumns: Column<any>[] = [
    { key: "name", header: "Container", render: (r) => <span className="font-mono text-sm text-gold-700">{r.name || r.id?.slice(0, 12)}</span> },
    { key: "image", header: "Image", render: (r) => <span className="text-xs text-ink-500">{r.image || "—"}</span> },
    { key: "status", header: "Status", render: (r) => <Badge variant={r.status?.includes("Up") ? "success" : "critical"}>{r.status || "unknown"}</Badge> },
    { key: "ports", header: "Ports", render: (r) => <span className="font-mono text-xs text-ink-500">{r.ports || "—"}</span> },
  ];

  const actionColumns: Column<any>[] = [
    { key: "timestamp", header: "Time", render: (r) => <span className="font-mono text-xs text-ink-500">{new Date(r.timestamp).toLocaleString("en-US", { hour12: false })}</span> },
    { key: "category", header: "Category", render: (r) => <Badge variant="outline">{r.category}</Badge> },
    { key: "action", header: "Action", render: (r) => <span className="font-mono text-sm text-gold-700">{r.action}</span> },
    { key: "target", header: "Target", render: (r) => <span className="text-xs text-ink-400 truncate max-w-[200px] block">{r.target || "—"}</span> },
    { key: "actor", header: "Actor", render: (r) => <span className="text-xs text-ink-300">{r.actor}</span> },
    { key: "result", header: "Result", render: (r) => <Badge variant={r.result === "success" ? "success" : r.result === "failure" ? "critical" : "warning"}>{r.result}</Badge> },
  ];

  if (!dataLoaded) {
    return <PageLoader variant="dashboard" title="Loading live metrics..." />;
  }

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Live Metrics"
        description="Real-time server metrics, processes, ports, and Docker containers"
        badge={
          <StatusPill variant={overallStatus} pulse={overallStatus !== "ok"}>
            {overallStatus === "ok" ? "Healthy" : overallStatus === "warn" ? "Warning" : "Critical"}
          </StatusPill>
        }
      />

      {/* KPI row */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="CPU"
          value={`${cpu.toFixed(1)}%`}
          subtitle={cpuStatus === "crit" ? "High load" : cpuStatus === "warn" ? "Elevated" : "Normal"}
          status={cpuStatus}
          icon={<Cpu className="h-5 w-5" />}
        />
        <MetricCard
          title="RAM"
          value={`${ram.toFixed(1)}%`}
          subtitle={ramStatus === "crit" ? "Pressure" : ramStatus === "warn" ? "Elevated" : "Normal"}
          status={ramStatus}
          icon={<MemoryStick className="h-5 w-5" />}
        />
        <MetricCard
          title="Disk"
          value={disk != null ? `${disk.toFixed(1)}%` : "—"}
          subtitle={diskStatus === "crit" ? "High usage" : diskStatus === "warn" ? "Elevated" : "Normal"}
          status={diskStatus}
          icon={<HardDrive className="h-5 w-5" />}
        />
        <MetricCard
          title="Containers"
          value={containers.length}
          subtitle={containers.length > 0 ? "Tracked" : "None running"}
          status={containers.length > 0 ? "ok" : "info"}
          icon={<Container className="h-5 w-5" />}
        />
      </section>

      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics"><Activity className="mr-2 h-4 w-4" /> Metrics</TabsTrigger>
          <TabsTrigger value="processes"><Cpu className="mr-2 h-4 w-4" /> Processes</TabsTrigger>
          <TabsTrigger value="ports"><Network className="mr-2 h-4 w-4" /> Ports</TabsTrigger>
          <TabsTrigger value="docker"><Container className="mr-2 h-4 w-4" /> Docker</TabsTrigger>
          <TabsTrigger value="actions"><History className="mr-2 h-4 w-4" /> Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SectionCard title="CPU Usage" description="Real-time processor load" delay={0.1}>
              <AreaChart data={cpuHistory.current} color="#d4af5f" label="CPU" threshold={85} />
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-ink-500">Threshold: 85%</span>
                {cpuStatus !== "ok" && <span className="flex items-center gap-1 text-status-warn"><AlertTriangle className="h-3 w-3" /> {cpu.toFixed(1)}%</span>}
              </div>
            </SectionCard>
            <SectionCard title="RAM Usage" description="Memory pressure over time" delay={0.15}>
              <AreaChart data={ramHistory.current} color="#5aa9ff" label="RAM" threshold={90} />
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-ink-500">Threshold: 90%</span>
                {ramStatus !== "ok" && <span className="flex items-center gap-1 text-status-warn"><AlertTriangle className="h-3 w-3" /> {ram.toFixed(1)}%</span>}
              </div>
            </SectionCard>
            <SectionCard title="Disk Usage" description="Storage utilization" delay={0.2}>
              <AreaChart data={diskHistory.current} color="#3ddc84" label="Disk" threshold={85} />
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-ink-500">Threshold: 85%</span>
                {diskStatus !== "ok" && <span className="flex items-center gap-1 text-status-warn"><AlertTriangle className="h-3 w-3" /> {disk?.toFixed(1)}%</span>}
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        <TabsContent value="processes" className="mt-4">
          <SectionCard title="Top Processes" description="By CPU usage" delay={0.1}>
            <DataTable
              columns={processColumns}
              data={processes}
              searchable
              searchKeys={["name", "pid"]}
              pageSize={15}
              emptyMessage="No process data"
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="ports" className="mt-4">
          <SectionCard title="Listening Ports" description="Active network sockets" delay={0.1}>
            <DataTable
              columns={portColumns}
              data={ports}
              pageSize={15}
              emptyMessage="No port data"
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="docker" className="mt-4">
          <SectionCard title="Docker Containers" description="Running containers on host" delay={0.1}>
            {containers.length === 0 ? (
              <p className="text-sm text-ink-600">No containers running</p>
            ) : (
              <DataTable
                columns={containerColumns}
                data={containers}
                pageSize={15}
                emptyMessage="No containers running"
              />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <SectionCard title="Action History" description="All logged actions across the system" delay={0.1}>
            <DataTable
              columns={actionColumns}
              data={actionHistory}
              searchable
              searchKeys={["category", "action", "target", "actor"]}
              pageSize={15}
              emptyMessage="No actions logged yet"
            />
          </SectionCard>
        </TabsContent>
      </Tabs>

      {/* RCA Panel */}
      <RcaPanel />
    </div>
  );
}
