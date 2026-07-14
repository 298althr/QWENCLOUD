"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Bot,
  Activity,
  Rocket,
  FolderOpen,
  ShieldCheck,
  Brain,
  TrendingUp,
  Settings,
  TerminalSquare,
  PanelLeft,
  Wifi,
  WifiOff,
  Loader2,
  Server,
  Container,
  Network,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { onConnectionStatus, type ConnectionStatus } from "@/lib/websocket";

const GROUPS = [
  {
    label: "Core",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/agent", label: "AI Assistant", icon: Bot },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/monitoring", label: "Live Metrics", icon: Activity },
      { href: "/terminal", label: "Terminal", icon: TerminalSquare },
      { href: "/containers", label: "Containers", icon: Container },
      { href: "/topology", label: "Topology", icon: Network },
      { href: "/deployments", label: "Deploy", icon: Rocket },
      { href: "/files", label: "Files", icon: FolderOpen },
      { href: "/remote", label: "Remote Servers", icon: Server },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/approvals", label: "Approvals", icon: ClipboardCheck },
      { href: "/security", label: "Safety & Audit", icon: ShieldCheck },
      { href: "/memory", label: "Memory", icon: Brain },
      { href: "/analytics", label: "Performance", icon: TrendingUp },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobile?: boolean;
}

export default function Sidebar({ collapsed, onToggle, mobile = false }: SidebarProps) {
  const pathname = usePathname();
  const [connStatus, setConnStatus] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
    const off = onConnectionStatus((s) => setConnStatus(s));
    return () => off();
  }, []);

  return (
    <aside
      className={cn(
        "sticky top-0 z-20 flex h-screen shrink-0 flex-col border-r border-ink-700/40 bg-ink-900 transition-all duration-300",
        collapsed && !mobile ? "w-16" : "w-60"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center gap-2 border-b border-ink-700/40 px-4">
        <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 shadow-glow" />
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide text-ink-1000">ALTHR</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-500">Autopilot</div>
          </div>
        )}
        {!mobile && (
          <button
            onClick={onToggle}
            className={cn(
              "ml-auto rounded-lg p-1 text-ink-500 hover:bg-ink-800 hover:text-ink-1000 transition-micro",
              collapsed && "mx-auto ml-0"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft className={cn("h-4 w-4", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        {GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-600">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              const link = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "nav-link relative",
                    active && "nav-link-active",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
              return collapsed && !mobile ? (
                <Tooltip key={item.href} delayDuration={100}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom status */}
      <div className="border-t border-ink-700/40 px-3 py-3">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          {connStatus === "connected" ? (
            <Wifi className="h-3.5 w-3.5 text-status-ok" />
          ) : connStatus === "reconnecting" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-status-warn" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-status-crit" />
          )}
          {!collapsed && (
            <span className="text-[10px] text-ink-500">
              {connStatus === "connected" ? "Connected" : connStatus === "reconnecting" ? "Reconnecting" : "Offline"}
            </span>
          )}
        </div>
        {!collapsed && (
          <div className="mt-2 text-[10px] text-ink-600">
            Track 4 · Qwen Cloud · v0.3
          </div>
        )}
      </div>
    </aside>
  );
}
