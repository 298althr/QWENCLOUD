"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, Command, Wifi, WifiOff, Settings, Loader2, Bell, Search, User, HelpCircle, Keyboard } from "lucide-react";
import Link from "next/link";
import { onConnectionStatus, type ConnectionStatus } from "@/lib/websocket";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Overview",
  "/agent": "Agent Console",
  "/monitoring": "Monitoring",
  "/deployments": "Deployments",
  "/files": "File Manager",
  "/security": "Security",
  "/memory": "Memory & Learning",
  "/analytics": "Analytics",
  "/decisions": "Decision Intelligence",
  "/settings": "Settings",
};

interface TopBarProps {
  onMenuClick: () => void;
  onCommandPalette?: () => void;
  onShortcuts?: () => void;
  alertCount?: number;
}

export default function TopBar({ onMenuClick, onCommandPalette, onShortcuts, alertCount = 0 }: TopBarProps) {
  const pathname = usePathname();
  const [connStatus, setConnStatus] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
    const off = onConnectionStatus((s) => setConnStatus(s));
    return () => { off(); };
  }, []);

  const crumbs = pathname === "/"
    ? ["Overview"]
    : pathname.split("/").filter(Boolean).map((p) =>
        ROUTE_LABELS[`/${p}`] || p.charAt(0).toUpperCase() + p.slice(1)
      );

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-800 bg-ink-900/95 px-4 backdrop-blur-md">
      <Button variant="ghost" size="icon" className="lg:hidden touch-target" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>

      {/* Breadcrumb */}
      <div className="hidden items-center gap-2 text-sm sm:flex">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className="text-ink-700">/</span>}
            <span className={cn("font-medium", i === crumbs.length - 1 ? "text-gold-400" : "text-ink-500")}>
              {c}
            </span>
          </span>
        ))}
      </div>

      {/* Global search */}
      <div className="mx-4 hidden flex-1 max-w-md md:block">
        <button
          onClick={onCommandPalette}
          className="input-pro flex w-full items-center justify-between text-left text-ink-500 hover:text-ink-400"
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span>Search commands, files, memory...</span>
          </span>
          <span className="flex items-center gap-1 rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-500">
            <Command className="h-3 w-3" />K
          </span>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {/* Connection status */}
        <div className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-xs lg:flex">
          {connStatus === "connected" ? (
            <><Wifi className="h-3.5 w-3.5 text-status-ok" /><span className="text-status-ok">Connected</span></>
          ) : connStatus === "reconnecting" ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin text-status-warn" /><span className="text-status-warn">Reconnecting</span></>
          ) : (
            <><WifiOff className="h-3.5 w-3.5 text-status-crit" /><span className="text-status-crit">Offline</span></>
          )}
        </div>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative touch-target">
          <Bell className="h-4 w-4 text-ink-400" />
          {alertCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-crit px-1 text-[10px] font-medium text-white">
              {alertCount > 9 ? "9+" : alertCount}
            </span>
          )}
        </Button>

        {/* Shortcuts */}
        <Button variant="ghost" size="icon" className="hidden touch-target sm:flex" onClick={onShortcuts}>
          <Keyboard className="h-4 w-4 text-ink-400" />
        </Button>

        {/* Help */}
        <Button variant="ghost" size="icon" className="hidden touch-target sm:flex">
          <HelpCircle className="h-4 w-4 text-ink-400" />
        </Button>

        {/* Settings */}
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="touch-target">
            <Settings className="h-4 w-4 text-ink-400" />
          </Button>
        </Link>

        {/* User */}
        <Button variant="ghost" size="icon" className="touch-target">
          <User className="h-4 w-4 text-ink-400" />
        </Button>
      </div>
    </header>
  );
}
