"use client";

import { cn } from "@/lib/utils";

export type RiskLevel = "low" | "medium" | "high";

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

const config: Record<RiskLevel, { label: string; className: string }> = {
  low: {
    label: "Low Risk",
    className: "bg-status-ok/15 text-status-ok border-status-ok/30",
  },
  medium: {
    label: "Medium Risk",
    className: "bg-status-warn/15 text-status-warn border-status-warn/30",
  },
  high: {
    label: "High Risk",
    className: "bg-status-crit/15 text-status-crit border-status-crit/30",
  },
};

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const { label, className: variantClass } = config[level];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-2.5 py-1 text-caption font-medium",
        variantClass,
        className
      )}
    >
      {label}
    </span>
  );
}
