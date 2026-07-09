"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, WifiOff, AlertCircle, X } from "lucide-react";
import { useState } from "react";

export type AlertSeverity = "crit" | "warn" | "info";

interface GlobalAlertBannerProps {
  severity: AlertSeverity;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  dismissible?: boolean;
  className?: string;
}

const config: Record<AlertSeverity, { bg: string; border: string; text: string; icon: typeof AlertTriangle }> = {
  crit: {
    bg: "bg-status-crit/15",
    border: "border-status-crit/30",
    text: "text-status-crit",
    icon: AlertTriangle,
  },
  warn: {
    bg: "bg-status-warn/15",
    border: "border-status-warn/30",
    text: "text-status-warn",
    icon: AlertCircle,
  },
  info: {
    bg: "bg-status-info/15",
    border: "border-status-info/30",
    text: "text-status-info",
    icon: AlertCircle,
  },
};

export function GlobalAlertBanner({
  severity,
  title,
  message,
  action,
  dismissible = false,
  className,
}: GlobalAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { bg, border, text, icon: Icon } = config[severity];

  if (dismissed) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b px-4 py-2.5",
        bg,
        border,
        className
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", text)} />
      <div className="flex flex-1 items-center gap-2 text-sm">
        <span className={cn("font-medium", text)}>{title}</span>
        {message && <span className="text-ink-400">{message}</span>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            "text-sm font-medium hover:underline",
            text
          )}
        >
          {action.label}
        </button>
      )}
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className={cn("p-1 rounded-md hover:bg-ink-800", text)}
          aria-label="Dismiss alert"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
