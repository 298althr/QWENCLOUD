"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { PageHeader, SectionCard, StatusPill, EmptyState, ErrorState, PageLoader } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Container,
  Play,
  Square,
  RotateCw,
  Trash2,
  FileText,
  Terminal,
  Activity,
  Cpu,
  MemoryStick,
  Network,
  RefreshCw,
  Layers,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DockerContainer {
  id: string;
  name: string;
  names: string[];
  image: string;
  state: string;
  status: string;
  ports: { ip: string; privatePort: number; publicPort: number | null; type: string }[];
  labels: Record<string, string>;
  networkMode: string;
  health: string;
}

interface ContainerStats {
  cpuPercent: number;
  memUsageMB: number;
  memLimitMB: number;
  memPercent: number;
  networkRx: number;
  networkTx: number;
}

export default function ContainersPage() {
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<DockerContainer | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [inspectData, setInspectData] = useState<any>(null);
  const [execCommand, setExecCommand] = useState("");
  const [execResult, setExecResult] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("containers");

  const fetchContainers = useCallback(async () => {
    try {
      setError(null);
      const r = await api.dockerContainers(showAll);
      setContainers(r.containers || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 5000);
    return () => clearInterval(interval);
  }, [fetchContainers]);

  useEffect(() => {
    if (activeTab === "images") {
      api.dockerImages().then((r) => setImages(r.images || [])).catch(() => {});
    }
  }, [activeTab]);

  const handleAction = async (id: string, action: "stop" | "start" | "restart" | "remove") => {
    setActionLoading(`${id}-${action}`);
    try {
      await api.containerAction(id, action);
      await fetchContainers();
      if (selectedId === id) {
        setSelectedId(null);
        setSelectedContainer(null);
        setLogs("");
        setStats(null);
        setInspectData(null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelect = async (container: DockerContainer) => {
    if (selectedId === container.id) {
      setSelectedId(null);
      setSelectedContainer(null);
      setLogs("");
      setStats(null);
      setInspectData(null);
      return;
    }
    setSelectedId(container.id);
    setSelectedContainer(container);
    setLogs("");
    setStats(null);
    setInspectData(null);
    setExecResult(null);
    try {
      const [logsRes, statsRes] = await Promise.all([
        api.containerLogs(container.id, 100).catch(() => ({ logs: "" })),
        api.containerStats(container.id).catch(() => null),
      ]);
      setLogs(logsRes.logs || "");
      if (statsRes) setStats(statsRes);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleExec = async () => {
    if (!selectedId || !execCommand) return;
    setActionLoading("exec");
    try {
      const result = await api.containerExec(selectedId, execCommand);
      setExecResult(`Exit: ${result.exitCode}\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`);
    } catch (e: any) {
      setExecResult(`Error: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleInspect = async () => {
    if (!selectedId) return;
    setActionLoading("inspect");
    try {
      const data = await api.containerInspect(selectedId);
      setInspectData(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefreshLogs = async () => {
    if (!selectedId) return;
    try {
      const r = await api.containerLogs(selectedId, 100);
      setLogs(r.logs || "");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const runningCount = containers.filter((c) => c.state === "running").length;
  const stoppedCount = containers.filter((c) => c.state !== "running").length;

  const stateColor = (state: string) => {
    if (state === "running") return "success";
    if (state === "exited" || state === "dead") return "critical";
    return "warning";
  };

  if (loading) {
    return <PageLoader variant="list" title="Loading containers..." />;
  }

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Containers"
        description="Multi-container Docker management with logs, stats, exec, and batch actions"
        badge={
          <StatusPill variant={runningCount > 0 ? "ok" : "crit"} pulse={runningCount > 0}>
            {runningCount} running / {stoppedCount} stopped
          </StatusPill>
        }
      />

      {error && (
        <ErrorState
          title="Failed to load containers"
          message={error}
          onRetry={fetchContainers}
        />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="containers">
            <Container className="mr-2 h-4 w-4" /> Containers
          </TabsTrigger>
          <TabsTrigger value="images">
            <Layers className="mr-2 h-4 w-4" /> Images
          </TabsTrigger>
        </TabsList>

        <TabsContent value="containers" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAll(!showAll)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-micro",
                  showAll
                    ? "border-gold-600 bg-gold-600/10 text-gold-700"
                    : "border-ink-700 text-ink-400 hover:text-ink-200"
                )}
              >
                {showAll ? "Showing all" : "Running only"}
              </button>
              <button
                onClick={fetchContainers}
                className="flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-400 transition-micro hover:text-ink-200"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            <span className="text-xs text-ink-600">{containers.length} containers</span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-ink-700/40 bg-ink-800/50" />
              ))}
            </div>
          ) : containers.length === 0 ? (
            <EmptyState
              icon={Container}
              title="No containers found"
              description="No Docker containers are running on this host."
            />
          ) : (
            <div className="space-y-2">
              {containers.map((c) => (
                <div key={c.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-3 rounded-xl border p-3 transition-micro cursor-pointer",
                      selectedId === c.id
                        ? "border-gold-600/50 bg-gold-600/5"
                        : "border-ink-700/40 bg-ink-800/30 hover:border-ink-600/60"
                    )}
                    onClick={() => handleSelect(c)}
                  >
                    <div className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      c.state === "running" ? "bg-status-ok" : "bg-status-crit"
                    )} />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono text-sm text-gold-700">{c.name}</span>
                        <Badge variant={stateColor(c.state) as any} className="shrink-0">
                          {c.state}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-ink-500">
                        <span className="truncate">{c.image}</span>
                        <span className="shrink-0 font-mono">{c.id.substring(0, 12)}</span>
                      </div>
                    </div>

                    <div className="hidden items-center gap-3 text-xs text-ink-500 md:flex">
                      {c.ports.filter((p) => p.publicPort).map((p, i) => (
                        <span key={i} className="font-mono">:{p.publicPort}</span>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 transition-micro group-hover:opacity-100">
                      {c.state === "running" ? (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAction(c.id, "stop"); }}
                            disabled={actionLoading === `${c.id}-stop`}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-status-crit/10 hover:text-status-crit"
                            title="Stop"
                          >
                            <Square className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAction(c.id, "restart"); }}
                            disabled={actionLoading === `${c.id}-restart`}
                            className="rounded-lg p-1.5 text-ink-400 hover:bg-status-warn/10 hover:text-status-warn"
                            title="Restart"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAction(c.id, "start"); }}
                          disabled={actionLoading === `${c.id}-start`}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-status-ok/10 hover:text-status-ok"
                          title="Start"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleAction(c.id, "remove"); }}
                        disabled={actionLoading === `${c.id}-remove`}
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-status-crit/10 hover:text-status-crit"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {selectedId === c.id && (
                    <div className="mt-2 rounded-xl border border-gold-600/20 bg-ink-900/60 p-4">
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-ink-200">
                            <Activity className="h-4 w-4 text-gold-700" /> Stats
                          </div>
                          {stats ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2">
                                <span className="flex items-center gap-1.5 text-xs text-ink-500">
                                  <Cpu className="h-3.5 w-3.5" /> CPU
                                </span>
                                <span className="font-mono text-sm text-ink-200">{stats.cpuPercent}%</span>
                              </div>
                              <div className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2">
                                <span className="flex items-center gap-1.5 text-xs text-ink-500">
                                  <MemoryStick className="h-3.5 w-3.5" /> Memory
                                </span>
                                <span className="font-mono text-sm text-ink-200">
                                  {stats.memUsageMB} / {stats.memLimitMB} MB ({stats.memPercent}%)
                                </span>
                              </div>
                              <div className="flex items-center justify-between rounded-lg bg-ink-800/50 px-3 py-2">
                                <span className="flex items-center gap-1.5 text-xs text-ink-500">
                                  <Network className="h-3.5 w-3.5" /> Network
                                </span>
                                <span className="font-mono text-xs text-ink-300">
                                  RX {stats.networkRx}KB / TX {stats.networkTx}KB
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-ink-600">Stats unavailable</p>
                          )}

                          <div className="pt-2">
                            <button
                              onClick={handleInspect}
                              disabled={actionLoading === "inspect"}
                              className="flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 hover:text-ink-200"
                            >
                              <FileText className="h-3.5 w-3.5" /> Inspect
                            </button>
                          </div>

                          {inspectData && (
                            <div className="max-h-48 overflow-y-auto rounded-lg bg-ink-950 p-3">
                              <pre className="whitespace-pre-wrap text-xs text-ink-400">
                                {JSON.stringify({
                                  Name: inspectData.Name,
                                  Config: {
                                    Image: inspectData.Config?.Image,
                                    Env: inspectData.Config?.Env?.slice(0, 5),
                                    Cmd: inspectData.Config?.Cmd,
                                  },
                                  State: inspectData.State,
                                  NetworkSettings: {
                                    IPAddress: inspectData.NetworkSettings?.IPAddress,
                                    Ports: inspectData.NetworkSettings?.Ports,
                                  },
                                  Mounts: inspectData.Mounts?.map((m: any) => ({
                                    Source: m.Source,
                                    Destination: m.Destination,
                                    Type: m.Type,
                                  })),
                                }, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>

                        <div className="lg:col-span-2 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-ink-200">
                              <FileText className="h-4 w-4 text-gold-700" /> Logs
                            </div>
                            <button
                              onClick={handleRefreshLogs}
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-500 hover:text-ink-200"
                            >
                              <RefreshCw className="h-3 w-3" /> Refresh
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto rounded-lg bg-ink-950 p-3">
                            {logs ? (
                              <pre className="whitespace-pre-wrap font-mono text-xs text-ink-400">{logs}</pre>
                            ) : (
                              <p className="text-xs text-ink-600">No logs available</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-ink-200">
                              <Terminal className="h-4 w-4 text-gold-700" /> Exec
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={execCommand}
                                onChange={(e) => setExecCommand(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleExec()}
                                placeholder="e.g. ps aux"
                                className="flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-1.5 font-mono text-sm text-ink-200 placeholder:text-ink-600 focus:border-gold-600/50 focus:outline-none"
                              />
                              <button
                                onClick={handleExec}
                                disabled={actionLoading === "exec" || !execCommand}
                                className="rounded-lg bg-gold-600 px-4 py-1.5 text-xs font-medium text-ink-950 hover:bg-gold-500 disabled:opacity-50"
                              >
                                Run
                              </button>
                            </div>
                            {execResult && (
                              <div className="max-h-32 overflow-y-auto rounded-lg bg-ink-950 p-3">
                                <pre className="whitespace-pre-wrap font-mono text-xs text-ink-400">{execResult}</pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="images" className="mt-4">
          <SectionCard title="Docker Images" description={`${images.length} images on host`}>
            {images.length === 0 ? (
              <p className="text-sm text-ink-600">No images found</p>
            ) : (
              <div className="space-y-2">
                {images.map((img) => (
                  <div
                    key={img.id}
                    className="flex items-center gap-3 rounded-lg border border-ink-700/40 bg-ink-800/30 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {img.tags.length > 0 ? (
                          <span className="font-mono text-sm text-gold-700">{img.tags[0]}</span>
                        ) : (
                          <span className="font-mono text-sm text-ink-500">&lt;none&gt;</span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-ink-600">{img.id.substring(0, 19)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs text-ink-400">
                        {(img.size / 1024 / 1024).toFixed(1)} MB
                      </div>
                      <div className="text-xs text-ink-600">
                        {new Date(img.created * 1000).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
