"use client";

import { useEffect, useRef, useMemo, useState } from "react";
import { useAgentStore } from "@/stores/agent-store";
import { Button } from "@/components/ui/button";
import { onServerMetrics, onActionUpdate, onAnomalyAlert, onApprovalNeeded, sendAgentMessage } from "@/lib/websocket";
import { api } from "@/lib/api";
import { AreaChart } from "@/components/charts/AreaChart";
import { PageHeader, MetricCard, SectionCard, ActivityFeed, QuickActions, StatusPill } from "@/components/design-system";
import ApprovalCard from "@/components/ApprovalCard";
import { Cpu, MemoryStick, HardDrive, Activity, CheckCircle2, AlertTriangle, Terminal, ShieldCheck, Zap, Power, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { ActivityItem } from "@/components/design-system";

const MAX_POINTS = 60;
const QUICK_COMMANDS = ["show server health", "the API is slow", "list top CPU processes", "run security scan"];

function getStatus(value: number | null, warn: number, crit: number): "ok" | "warn" | "crit" {
  if (value === null || value === undefined) return "ok";
  if (value >= crit) return "crit";
  if (value >= warn) return "warn";
  return "ok";
}

function stageToActivityType(stage: string): ActivityItem["type"] {
  if (stage === "error" || stage.includes("fail")) return "crit";
  if (stage === "complete" || stage === "diagnosis_complete" || stage.includes("success")) return "ok";
  if (stage.includes("approval") || stage.includes("hitl")) return "warn";
  if (stage.includes("saf") || stage.includes("security")) return "info";
  return "ai";
}

function stageToTitle(stage: string, action?: string) {
  const label = action || stage.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function HomePage() {
  const { metrics, actions, approvals, setMetrics, addAlert, addAction, addApproval } = useAgentStore();
  const [simulating, setSimulating] = useState<string | null>(null);
  const [monitorEnabled, setMonitorEnabled] = useState<boolean | null>(null);
  const [containers, setContainers] = useState<any[]>([]);
  const [containerLoading, setContainerLoading] = useState<string | null>(null);
  const cpuHistory = useRef<{ time: string; value: number }[]>([]);
  const ramHistory = useRef<{ time: string; value: number }[]>([]);
  const diskHistory = useRef<{ time: string; value: number }[]>([]);

  useEffect(() => {
    loadMonitorStatus();
    loadContainers();
    const offMetrics = onServerMetrics((m) => {
      setMetrics({ cpu: m.cpu, ram: m.ram, disk: m.disk });
      const now = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      cpuHistory.current = [...cpuHistory.current, { time: now, value: m.cpu }].slice(-MAX_POINTS);
      ramHistory.current = [...ramHistory.current, { time: now, value: m.ram }].slice(-MAX_POINTS);
      if (m.disk !== null && m.disk !== undefined) {
        diskHistory.current = [...diskHistory.current, { time: now, value: m.disk }].slice(-MAX_POINTS);
      }
    });
    const offAlert = onAnomalyAlert((a) => { addAlert(a); toast.warning(`${a.type}: ${a.message}`); });
    const offAction = onActionUpdate((a) => addAction(a));
    const offApproval = onApprovalNeeded((a: any) => addApproval({
      action_id: a.anomalyId || a.action_id,
      action: a.action || a.plan?.[0]?.name || "unknown",
      confidence: Number(a.confidence) || 0,
      risk_level: a.risk_level || "medium",
      timestamp: new Date().toISOString(),
      di_tier: a.di_tier,
      di_score: a.di_score,
      rrs: a.rrs,
      crds_vetoed: a.crds_vetoed,
      drev_winner: a.drev_winner,
      drev_reserve: a.drev_reserve,
      drev_cr: a.drev_cr,
      drev_robustness: a.drev_robustness,
      dre_candidates: a.dre_candidates,
      dre_coverage: a.dre_coverage,
      dre_contradiction: a.dre_contradiction,
      degradations: a.degradations,
      explainability: a.explainability,
    }));
    return () => { offMetrics(); offAlert(); offAction(); offApproval(); };
  }, [setMetrics, addAlert, addAction, addApproval]);

  const cpu = metrics?.cpu ?? 0;
  const ram = metrics?.ram ?? 0;
  const disk = metrics?.disk ?? null;

  const cpuStatus = getStatus(cpu, 60, 85);
  const ramStatus = getStatus(ram, 70, 90);
  const diskStatus = getStatus(disk, 70, 85);

  const overallStatus = [cpuStatus, ramStatus, diskStatus].some((s) => s === "crit") ? "crit" :
    [cpuStatus, ramStatus, diskStatus].some((s) => s === "warn") ? "warn" : "ok";

  const activityItems: ActivityItem[] = useMemo(() => {
    return actions.slice(-20).reverse().map((a, i) => ({
      id: `action-${i}`,
      type: stageToActivityType(a.stage),
      title: stageToTitle(a.stage, a.action),
      description: a.message || a.plan?.[0]?.name || a.intent,
      timestamp: a.timestamp || Date.now(),
      metadata: a.confidence ? `${(a.confidence * 100).toFixed(0)}% conf${a.risk_level ? ` · ${a.risk_level}` : ""}` : undefined,
    }));
  }, [actions]);

  const simulate = async (type: string) => {
    setSimulating(type);
    try {
      await api.simulateAnomaly(type as any);
      toast.success(`Simulated ${type} incident — watch the activity feed`);
    } catch (e: any) {
      toast.error(`Simulation failed: ${e.message}`);
    } finally {
      setSimulating(null);
    }
  };

  const loadMonitorStatus = async () => {
    try {
      const status = await api.monitorStatus();
      setMonitorEnabled(status.enabled);
    } catch { /* ignore */ }
  };

  const toggleMonitor = async () => {
    try {
      if (monitorEnabled) {
        await api.stopMonitor();
        toast.success("Autonomous monitor stopped");
      } else {
        await api.startMonitor();
        toast.success("Autonomous monitor started");
      }
      await loadMonitorStatus();
    } catch (e: any) {
      toast.error(`Monitor toggle failed: ${e.message}`);
    }
  };

  const loadContainers = async () => {
    try {
      const r = await api.dockerContainers();
      setContainers(r.containers || []);
    } catch { /* ignore */ }
  };

  const containerAction = async (id: string, action: "stop" | "start" | "restart") => {
    setContainerLoading(`${id}-${action}`);
    try {
      await api.containerAction(id, action);
      toast.success(`Container ${action} sent`);
      await loadContainers();
    } catch (e: any) {
      toast.error(`Container ${action} failed: ${e.message}`);
    } finally {
      setContainerLoading(null);
    }
  };

  const quickActions = QUICK_COMMANDS.map((cmd) => ({
    id: cmd,
    label: cmd,
    icon: Terminal,
    variant: "outline" as const,
    onClick: () => { sendAgentMessage(cmd); toast.info(`Sent: "${cmd}"`); },
  }));

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Command Center"
        description="AI-Native Server Operations Agent — powered by Qwen Cloud"
        badge={<StatusPill variant={overallStatus} pulse={overallStatus !== "ok"}>{overallStatus === "ok" ? "Healthy" : overallStatus === "warn" ? "Warning" : "Critical"}</StatusPill>}
      />

      {/* KPI row */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="CPU"
          value={`${cpu.toFixed(1)}%`}
          subtitle={cpuStatus === "crit" ? "High load" : cpuStatus === "warn" ? "Elevated" : "Normal"}
          status={cpuStatus}
          icon={<Cpu className="h-5 w-5" />}
          delay={0}
        />
        <MetricCard
          title="RAM"
          value={`${ram.toFixed(1)}%`}
          subtitle={ramStatus === "crit" ? "Pressure" : ramStatus === "warn" ? "Elevated" : "Normal"}
          status={ramStatus}
          icon={<MemoryStick className="h-5 w-5" />}
          delay={0.05}
        />
        <MetricCard
          title="Disk"
          value={disk != null ? `${disk.toFixed(1)}%` : "—"}
          subtitle={diskStatus === "crit" ? "High usage" : diskStatus === "warn" ? "Elevated" : "Normal"}
          status={diskStatus}
          icon={<HardDrive className="h-5 w-5" />}
          delay={0.1}
        />
        <MetricCard
          title="Pending Approvals"
          value={approvals.length}
          subtitle={approvals.length > 0 ? "Requires review" : "Queue clear"}
          status={approvals.length > 0 ? "warn" : "ok"}
          icon={<CheckCircle2 className="h-5 w-5" />}
          delay={0.15}
        />
      </section>

      {/* Resource charts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard title="CPU Usage" description="Real-time processor load" delay={0.1}>
          <AreaChart data={cpuHistory.current} color="#d4af5f" label="CPU" threshold={85} />
        </SectionCard>
        <SectionCard title="RAM Usage" description="Memory pressure over time" delay={0.15}>
          <AreaChart data={ramHistory.current} color="#5aa9ff" label="RAM" threshold={90} />
        </SectionCard>
        <SectionCard title="Disk Usage" description="Storage utilization" delay={0.2}>
          <AreaChart data={diskHistory.current} color="#3ddc84" label="Disk" threshold={85} />
        </SectionCard>
      </section>

      {/* Activity + approvals + quick actions */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SectionCard
          title="Recent Activity"
          description="Live stream of agent actions, approvals, and anomalies"
          className="lg:col-span-2"
          delay={0.25}
          footer={`${actions.length} total events tracked · ${approvals.length} pending approval${approvals.length === 1 ? "" : "s"}`}
        >
          <ActivityFeed items={activityItems} emptyMessage="No recent activity. Send a command from the Agent Console to get started." />
        </SectionCard>

        <div className="space-y-4">
          <ApprovalCard />
          <SectionCard
            title="Simulate Incident"
            description="Inject a synthetic anomaly to test the AI autonomous loop"
            delay={0.28}
          >
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => simulate("cpu")}
                disabled={simulating !== null}
                className="justify-start"
              >
                <Cpu className="mr-2 h-4 w-4 text-status-warn" />
                {simulating === "cpu" ? "Injecting…" : "CPU spike"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => simulate("ram")}
                disabled={simulating !== null}
                className="justify-start"
              >
                <MemoryStick className="mr-2 h-4 w-4 text-status-warn" />
                {simulating === "ram" ? "Injecting…" : "RAM pressure"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => simulate("disk")}
                disabled={simulating !== null}
                className="justify-start"
              >
                <HardDrive className="mr-2 h-4 w-4 text-status-warn" />
                {simulating === "disk" ? "Injecting…" : "Disk full"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => simulate("port")}
                disabled={simulating !== null}
                className="justify-start"
              >
                <Activity className="mr-2 h-4 w-4 text-status-warn" />
                {simulating === "port" ? "Injecting…" : "Port conflict"}
              </Button>
            </div>
          </SectionCard>
          <SectionCard title="Try These Commands" delay={0.3}>
            <QuickActions actions={quickActions} />
          </SectionCard>
          <SectionCard
            title="System Controls"
            description="Stop AI loop and manage containers"
            delay={0.36}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-400">AI Monitor</span>
                <Button
                  variant={monitorEnabled ? "destructive" : "outline"}
                  size="sm"
                  onClick={toggleMonitor}
                  disabled={monitorEnabled === null}
                  className="gap-1"
                >
                  {monitorEnabled ? <Power className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {monitorEnabled === null ? "Loading" : monitorEnabled ? "Stop AI" : "Start AI"}
                </Button>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-ink-500 uppercase">Containers</div>
                {containers.length === 0 ? (
                  <div className="text-sm text-ink-600">No containers running</div>
                ) : (
                  containers.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded border border-ink-800 p-2">
                      <div className="text-xs text-ink-300 truncate max-w-[100px]">{c.name}</div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Restart" onClick={() => containerAction(c.id, "restart")} disabled={containerLoading === `${c.id}-restart`}>
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-status-crit" title="Stop" onClick={() => containerAction(c.id, "stop")} disabled={containerLoading === `${c.id}-stop`}>
                          <Power className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </SectionCard>
          <SectionCard
            title="System Status"
            description="Governance & safety indicators"
            delay={0.35}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-400 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> SAF guardrails</span>
                <StatusPill variant="ok">Active</StatusPill>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-400 flex items-center gap-2"><Zap className="h-4 w-4" /> Multi-model routing</span>
                <StatusPill variant="ok">Active</StatusPill>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-400 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Anomaly detection</span>
                <StatusPill variant={overallStatus === "ok" ? "ok" : overallStatus} pulse={overallStatus !== "ok"}>
                  {overallStatus === "ok" ? "Nominal" : overallStatus === "warn" ? "Attention" : "Alert"}
                </StatusPill>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-400 flex items-center gap-2"><Activity className="h-4 w-4" /> Decision pipeline</span>
                <StatusPill variant="ai">DRE → DREV → CRDS</StatusPill>
              </div>
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
