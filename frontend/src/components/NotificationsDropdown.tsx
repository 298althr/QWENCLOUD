"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X, AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ApprovalItem {
  action_id: string;
  action: string;
  confidence: number;
  risk_level: string;
  timestamp: string;
}

interface AlertItem {
  id: string;
  type: string;
  severity: string;
  message: string;
  timestamp: string;
}

interface NotificationsDropdownProps {
  approvals: ApprovalItem[];
  alerts: AlertItem[];
}

export default function NotificationsDropdown({ approvals, alerts }: NotificationsDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const total = approvals.length + alerts.length;

  const severityIcon = (severity: string) => {
    if (severity === "critical" || severity === "crit") return <AlertTriangle className="h-3.5 w-3.5 text-status-crit" />;
    if (severity === "warning" || severity === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-status-warn" />;
    return <Info className="h-3.5 w-3.5 text-status-info" />;
  };

  const formatTime = (ts: string | number) => {
    try {
      return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "—";
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-md transition-colors",
          open ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
        )}
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-crit px-1 text-[10px] font-medium text-white">
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-ink-700 bg-ink-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
            <h3 className="text-sm font-semibold text-ink-100">Notifications</h3>
            <button onClick={() => setOpen(false)} className="text-ink-500 hover:text-ink-200">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {approvals.length > 0 && (
              <div className="border-b border-ink-800/50">
                <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                  Pending Approvals ({approvals.length})
                </div>
                {approvals.map((a) => (
                  <Link
                    key={a.action_id}
                    href="/approvals"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 hover:bg-ink-800/60 transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-warn" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink-200">{a.action}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
                          <span className={cn("rounded px-1 py-0.5", a.risk_level === "high" ? "bg-status-crit/10 text-status-crit" : "bg-status-warn/10 text-status-warn")}>
                            {a.risk_level}
                          </span>
                          <span>{(a.confidence * 100).toFixed(0)}% conf</span>
                          <span>{formatTime(a.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {alerts.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-ink-500">
                  System Alerts ({alerts.length})
                </div>
                {alerts.map((alert) => (
                  <div key={alert.id} className="px-4 py-3 hover:bg-ink-800/60 transition-colors">
                    <div className="flex items-start gap-2.5">
                      {severityIcon(alert.severity)}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-ink-200">{alert.type}</div>
                        <div className="mt-0.5 text-xs text-ink-400 line-clamp-2">{alert.message}</div>
                        <div className="mt-1 text-xs text-ink-600">{formatTime(alert.timestamp)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {total === 0 && (
              <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <Bell className="h-8 w-8 text-ink-700" />
                <p className="mt-3 text-sm font-medium text-ink-400">No notifications</p>
                <p className="mt-1 text-xs text-ink-600">Pending approvals and monitoring alerts will appear here.</p>
              </div>
            )}
          </div>

          <div className="border-t border-ink-700 px-4 py-2">
            <Link
              href="/approvals"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-gold-500 hover:text-gold-400"
            >
              View all approvals
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
