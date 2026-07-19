"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { api } from "@/lib/api";
import { PageHeader, SectionCard, StatusPill, EmptyState, ErrorState, PageLoader } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import {
  Network,
  Database,
  Server,
  Globe,
  Box,
  AlertTriangle,
  RefreshCw,
  Zap,
  ArrowRight,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TopologyNode {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  health: string;
  ports: { ip: string; privatePort: number; publicPort: number | null; type: string }[];
  composeService: string;
  composeProject: string;
  networks: { name: string; ipv4: string; driver: string }[];
  labels: Record<string, string>;
}

interface TopologyEdge {
  source: string;
  sourceName: string;
  target: string;
  targetName: string;
  type: string;
  direction: string | null;
  network: string;
}

interface TopologyData {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  networks: any[];
  services: Record<string, any>;
  summary: {
    totalContainers: number;
    runningContainers: number;
    stoppedContainers: number;
    totalNetworks: number;
    totalEdges: number;
    totalServices: number;
  };
}

interface ImpactData {
  source: string;
  sourceName: string;
  impacted: { id: string; name: string; service: string; state: string }[];
  impactedCount: number;
}

const SERVICE_ICONS: Record<string, any> = {
  postgres: Database,
  redis: Box,
  backend: Server,
  frontend: Globe,
};

const SERVICE_COLORS: Record<string, string> = {
  postgres: "#3ddc84",
  redis: "#d44444",
  backend: "#d4af5f",
  frontend: "#5aa9ff",
};

function getNodeIcon(service: string) {
  return SERVICE_ICONS[service] || Circle;
}

function getNodeColor(service: string) {
  return SERVICE_COLORS[service] || "#888888";
}

export default function TopologyPage() {
  const [topology, setTopology] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [impact, setImpact] = useState<ImpactData | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  const fetchTopology = useCallback(async () => {
    try {
      setError(null);
      const r = await api.topology();
      setTopology(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopology();
    const interval = setInterval(fetchTopology, 10000);
    return () => clearInterval(interval);
  }, [fetchTopology]);

  useEffect(() => {
    const updateDims = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: Math.max(400, containerRef.current.clientHeight),
        });
      }
    };
    updateDims();
    window.addEventListener("resize", updateDims);
    return () => window.removeEventListener("resize", updateDims);
  }, []);

  const handleImpact = async (node: TopologyNode) => {
    setSelectedNode(node);
    setImpactLoading(true);
    setImpact(null);
    try {
      const r = await api.topologyImpact(node.id);
      setImpact(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImpactLoading(false);
    }
  };

  const nodePositions = useMemo(() => {
    if (!topology || topology.nodes.length === 0) return {};
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const radius = Math.min(dimensions.width, dimensions.height) * 0.32;
    const positions: Record<string, { x: number; y: number }> = {};
    const runningNodes = topology.nodes.filter((n) => n.state === "running");
    const stoppedNodes = topology.nodes.filter((n) => n.state !== "running");
    const allNodes = [...runningNodes, ...stoppedNodes];

    allNodes.forEach((node, i) => {
      const angle = (i / allNodes.length) * 2 * Math.PI - Math.PI / 2;
      positions[node.id] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
    return positions;
  }, [topology, dimensions]);

  if (loading) {
    return (
      <div className="space-y-xl">
        <PageHeader title="Topology" description="Service discovery and container dependency map" />
        <div className="h-96 animate-pulse rounded-xl border border-ink-700/40 bg-ink-800/50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-xl">
        <PageHeader title="Topology" description="Service discovery and container dependency map" />
        <ErrorState title="Failed to load topology" message={error} onRetry={fetchTopology} />
      </div>
    );
  }

  if (!topology || topology.nodes.length === 0) {
    return (
      <div className="space-y-xl">
        <PageHeader title="Topology" description="Service discovery and container dependency map" />
        <EmptyState icon={Network} title="No containers found" description="No Docker containers running to build topology." />
      </div>
    );
  }

  const runningCount = topology.summary.runningContainers;
  const stoppedCount = topology.summary.stoppedContainers;

  if (loading) {
    return <PageLoader variant="detail" title="Loading topology..." />;
  }

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Topology"
        description="Service discovery and container dependency map"
        badge={
          <StatusPill variant={runningCount > 0 ? "ok" : "crit"} pulse={runningCount > 0}>
            {runningCount} running / {stoppedCount} stopped
          </StatusPill>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <SectionCard title="Containers" description="Total services discovered">
          <div className="text-3xl font-bold text-gold-700">{topology.summary.totalContainers}</div>
          <div className="mt-1 text-xs text-ink-500">{topology.summary.totalServices} services</div>
        </SectionCard>
        <SectionCard title="Networks" description="Docker networks detected">
          <div className="text-3xl font-bold text-gold-700">{topology.summary.totalNetworks}</div>
          <div className="mt-1 text-xs text-ink-500">
            {topology.networks.filter((n: any) => n.name !== "bridge" && n.name !== "host" && n.name !== "none").length} custom
          </div>
        </SectionCard>
        <SectionCard title="Connections" description="Edges between containers">
          <div className="text-3xl font-bold text-gold-700">{topology.summary.totalEdges}</div>
          <div className="mt-1 text-xs text-ink-500">
            {topology.edges.filter((e) => e.type === "depends_on").length} dependencies
          </div>
        </SectionCard>
        <SectionCard title="Health" description="Overall service health">
          <div className="flex items-center gap-2">
            <div className={cn("h-3 w-3 rounded-full", stoppedCount === 0 ? "bg-status-ok" : "bg-status-crit")} />
            <span className="text-lg font-semibold text-ink-200">
              {stoppedCount === 0 ? "All Healthy" : `${stoppedCount} Down`}
            </span>
          </div>
          <div className="mt-1 text-xs text-ink-500">{runningCount} of {topology.summary.totalContainers} running</div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            title="Service Map"
            description="Visual topology of container dependencies. Click a node to analyze impact."
            headerActions={
              <button
                onClick={fetchTopology}
                className="flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 hover:text-ink-200"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            }
          >
            <div ref={containerRef} className="relative h-[450px] w-full overflow-hidden rounded-lg bg-ink-950/50">
              <svg width={dimensions.width} height={dimensions.height} className="absolute inset-0">
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#d4af5f" />
                  </marker>
                  <marker id="arrowhead-dim" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#4a4a5a" />
                  </marker>
                </defs>

                {topology.edges.map((edge, i) => {
                  const src = nodePositions[edge.source];
                  const tgt = nodePositions[edge.target];
                  if (!src || !tgt) return null;
                  const isDependency = edge.type === "depends_on";
                  const isHovered = hoveredNode === edge.source || hoveredNode === edge.target;
                  const midX = (src.x + tgt.x) / 2;
                  const midY = (src.y + tgt.y) / 2;
                  const dx = tgt.x - src.x;
                  const dy = tgt.y - src.y;
                  const len = Math.sqrt(dx * dx + dy * dy);
                  const ux = dx / len;
                  const uy = dy / len;
                  const offset = 45;
                  const x1 = src.x + ux * offset;
                  const y1 = src.y + uy * offset;
                  const x2 = tgt.x - ux * offset;
                  const y2 = tgt.y - uy * offset;

                  return (
                    <g key={i}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={isDependency ? "#d4af5f" : "#3a3a4a"}
                        strokeWidth={isDependency ? 2 : 1}
                        strokeDasharray={isDependency ? "none" : "4 4"}
                        opacity={isHovered ? 1 : 0.6}
                        markerEnd={isDependency ? "url(#arrowhead)" : "url(#arrowhead-dim)"}
                      />
                      {isDependency && (
                        <text
                          x={midX}
                          y={midY - 5}
                          textAnchor="middle"
                          fill="#d4af5f"
                          fontSize="9"
                          className="font-mono"
                          opacity={isHovered ? 1 : 0.5}
                        >
                          depends_on
                        </text>
                      )}
                    </g>
                  );
                })}

                {topology.nodes.map((node) => {
                  const pos = nodePositions[node.id];
                  if (!pos) return null;
                  const color = getNodeColor(node.composeService);
                  const isRunning = node.state === "running";
                  const isSelected = selectedNode?.id === node.id;
                  const isHovered = hoveredNode === node.id;
                  const Icon = getNodeIcon(node.composeService);
                  const r = isHovered || isSelected ? 38 : 32;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      className="cursor-pointer"
                      onClick={() => handleImpact(node)}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      <circle
                        r={r + 4}
                        fill="none"
                        stroke={isSelected ? "#d4af5f" : "transparent"}
                        strokeWidth="2"
                        opacity="0.5"
                      />
                      <circle
                        r={r}
                        fill={isRunning ? `${color}22` : "#1a1a2a"}
                        stroke={isRunning ? color : "#444"}
                        strokeWidth="2"
                        opacity={isHovered ? 1 : 0.85}
                      />
                      <g transform="translate(-10, -10)">
                        <foreignObject width="20" height="20">
                          <div className="flex items-center justify-center">
                            <Icon className="h-5 w-5" style={{ color: isRunning ? color : "#666" }} />
                          </div>
                        </foreignObject>
                      </g>
                      <text
                        y={r + 14}
                        textAnchor="middle"
                        fill={isRunning ? "#e0e0e0" : "#666"}
                        fontSize="11"
                        className="font-mono font-medium"
                      >
                        {node.composeService}
                      </text>
                      <text
                        y={r + 26}
                        textAnchor="middle"
                        fill="#666"
                        fontSize="8"
                        className="font-mono"
                      >
                        {node.networks[0]?.ipv4 || "no ip"}
                      </text>
                      <circle
                        cx={r - 6}
                        cy={-r + 6}
                        r="4"
                        fill={isRunning ? "#3ddc84" : "#d44444"}
                      />
                    </g>
                  );
                })}
              </svg>

              <div className="absolute bottom-3 left-3 flex items-center gap-4 rounded-lg bg-ink-900/80 px-3 py-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <div className="h-0.5 w-4 bg-gold-600" /> depends_on
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="h-0.5 w-4 border-t border-dashed border-ink-500" /> network
                </span>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          {selectedNode ? (
            <SectionCard title="Impact Analysis" description={`If ${selectedNode.composeService} goes down`}>
              {impactLoading ? (
                <div className="flex items-center gap-2 text-sm text-ink-500">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Analyzing...
                </div>
              ) : impact ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-lg bg-status-crit/10 border border-status-crit/20 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-status-crit" />
                    <span className="text-sm text-status-crit font-medium">
                      {impact.impactedCount} service{impact.impactedCount !== 1 ? "s" : ""} impacted
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium text-ink-500 uppercase tracking-wider">Source</div>
                    <div className="flex items-center gap-2 rounded-lg bg-ink-800/50 px-3 py-2">
                      <div className="h-2 w-2 rounded-full bg-status-crit" />
                      <span className="font-mono text-sm text-gold-700">{impact.sourceName}</span>
                    </div>
                  </div>

                  {impact.impacted.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-ink-500 uppercase tracking-wider">Impacted Services</div>
                      {impact.impacted.map((svc) => (
                        <div key={svc.id} className="flex items-center gap-2 rounded-lg bg-status-warn/10 border border-status-warn/20 px-3 py-2">
                          <Zap className="h-3.5 w-3.5 text-status-warn" />
                          <span className="font-mono text-sm text-ink-200">{svc.name}</span>
                          <span className="text-xs text-ink-500">({svc.service})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-500">No other services would be impacted.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-ink-500">No impact data available.</p>
              )}
            </SectionCard>
          ) : (
            <SectionCard title="Impact Analysis" description="Click a node to see what breaks">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Network className="h-8 w-8 text-ink-600 mb-2" />
                <p className="text-sm text-ink-500">Click any container in the map to see which services would be affected if it goes down.</p>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Services" description="Discovered service groups">
            <div className="space-y-2">
              {Object.entries(topology.services).map(([name, svc]: [string, any]) => (
                <div key={name} className="flex items-center gap-2 rounded-lg border border-ink-700/40 bg-ink-800/30 p-2.5">
                  <div className={cn("h-2 w-2 shrink-0 rounded-full", svc.state === "running" ? "bg-status-ok" : "bg-status-crit")} />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-sm text-gold-700">{name}</div>
                    <div className="text-xs text-ink-500 truncate">{svc.image}</div>
                  </div>
                  <Badge variant={svc.state === "running" ? "success" : "critical"} className="shrink-0">
                    {svc.state}
                  </Badge>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Networks" description="Docker networks in use">
            <div className="space-y-2">
              {topology.networks.filter((n: any) => n.name !== "bridge" && n.name !== "host" && n.name !== "none").map((net: any) => (
                <div key={net.id} className="rounded-lg border border-ink-700/40 bg-ink-800/30 p-2.5">
                  <div className="flex items-center gap-2">
                    <Network className="h-3.5 w-3.5 text-ink-500" />
                    <span className="font-mono text-sm text-ink-200">{net.name}</span>
                  </div>
                  <div className="mt-1 text-xs text-ink-500">
                    {net.containers.length} containers - {net.driver}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
