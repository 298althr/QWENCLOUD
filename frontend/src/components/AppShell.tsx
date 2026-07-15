"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  CheckCircle2,
} from "lucide-react";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import { ErrorBoundary } from "./ErrorBoundary";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CommandPalette } from "@/components/ui/command-palette";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { sendAgentMessage } from "@/lib/websocket";
import { toast } from "sonner";

const COMMAND_ITEMS = [
  { label: "Go to Overview", icon: <LayoutDashboard className="h-4 w-4" />, onSelect: () => window.location.href = "/", group: "Navigation" },
  { label: "Go to Agent Console", icon: <Bot className="h-4 w-4" />, onSelect: () => window.location.href = "/agent", group: "Navigation" },
  { label: "Go to Terminal", icon: <TerminalSquare className="h-4 w-4" />, onSelect: () => window.location.href = "/terminal", group: "Navigation" },
  { label: "Go to Monitoring", icon: <Activity className="h-4 w-4" />, onSelect: () => window.location.href = "/monitoring", group: "Navigation" },
  { label: "Go to Deployments", icon: <Rocket className="h-4 w-4" />, onSelect: () => window.location.href = "/deployments", group: "Navigation" },
  { label: "Go to Files", icon: <FolderOpen className="h-4 w-4" />, onSelect: () => window.location.href = "/files", group: "Navigation" },
  { label: "Go to Security", icon: <ShieldCheck className="h-4 w-4" />, onSelect: () => window.location.href = "/security", group: "Navigation" },
  { label: "Go to Memory", icon: <Brain className="h-4 w-4" />, onSelect: () => window.location.href = "/memory", group: "Navigation" },
  { label: "Go to Analytics", icon: <TrendingUp className="h-4 w-4" />, onSelect: () => window.location.href = "/analytics", group: "Navigation" },
  { label: "Go to Settings", icon: <Settings className="h-4 w-4" />, onSelect: () => window.location.href = "/settings", group: "Navigation" },
  { label: "Check server health", icon: <CheckCircle2 className="h-4 w-4" />, onSelect: () => { sendAgentMessage("show server health"); toast.info("Sent: show server health"); }, group: "Quick Actions" },
  { label: "List top CPU processes", icon: <Activity className="h-4 w-4" />, onSelect: () => { sendAgentMessage("show top CPU processes"); toast.info("Sent: show top CPU processes"); }, group: "Quick Actions" },
  { label: "Run security scan", icon: <ShieldCheck className="h-4 w-4" />, onSelect: () => { sendAgentMessage("run security scan"); toast.info("Sent: run security scan"); }, group: "Quick Actions" },
];

const SHORTCUTS = [
  { keys: "Cmd / Ctrl + K", action: "Open command palette" },
  { keys: "G then O", action: "Go to Overview" },
  { keys: "G then A", action: "Go to Agent Console" },
  { keys: "G then T", action: "Go to Terminal" },
  { keys: "G then M", action: "Go to Monitoring" },
  { keys: "G then S", action: "Go to Settings" },
  { keys: "?", action: "Show keyboard shortcuts" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const router = useRouter();

  // Persist sidebar collapse state
  useEffect(() => {
    const saved = localStorage.getItem("althr-sidebar-collapsed");
    if (saved) setSidebarCollapsed(saved === "true");
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((v) => {
      localStorage.setItem("althr-sidebar-collapsed", String(!v));
      return !v;
    });
  }, []);

  // Command palette: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
      if (e.key === "?" && !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
      if (e.key === "Escape") {
        setShortcutsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Vim-style navigation: G then key
  useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "g" && !gPressed) {
        gPressed = true;
        gTimer = setTimeout(() => { gPressed = false; }, 800);
        return;
      }
      if (gPressed && gTimer) {
        clearTimeout(gTimer);
        gPressed = false;
        const map: Record<string, string> = {
          o: "/", a: "/agent", t: "/terminal", m: "/monitoring",
          s: "/settings", f: "/files", c: "/security", l: "/memory",
          v: "/analytics", p: "/deployments",
        };
        const path = map[e.key];
        if (path) { e.preventDefault(); router.push(path); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen bg-ink-950">
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        </div>

        {/* Mobile sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-60">
            <Sidebar collapsed={false} onToggle={() => {}} mobile />
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 flex-col overflow-x-hidden">
          <TopBar
            onMenuClick={() => setMobileOpen(true)}
            onCommandPalette={() => setCmdOpen(true)}
            onShortcuts={() => setShortcutsOpen(true)}
            alertCount={0}
          />
          <main className="flex-1">
            <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6 lg:py-8 animate-fade-in">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </main>
        </div>
      </div>

      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} items={COMMAND_ITEMS} />
      <Toaster />

      {/* Shortcuts help modal */}
      {shortcutsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShortcutsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-modal border border-ink-700/40 bg-ink-850 p-6 shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-title text-ink-100">Keyboard Shortcuts</h2>
            <p className="mt-1 text-body text-ink-500">Navigate ALTHR Autopilot without leaving your keyboard.</p>
            <div className="mt-4 space-y-2">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.action} className="flex items-center justify-between rounded-lg bg-ink-950 px-3 py-2">
                  <span className="text-sm text-ink-400">{shortcut.action}</span>
                  <kbd className="rounded-input bg-ink-800 px-2 py-1 font-mono text-[11px] text-ink-400">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShortcutsOpen(false)}
                className="rounded-input bg-gold-500 px-4 py-2 text-sm font-medium text-white hover:bg-gold-600 transition-micro"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
}
