"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  icon?: React.ReactNode;
  status?: "ok" | "warn" | "crit" | "info";
};

export function KPICard({ label, value, unit, trend, icon, status = "info" }: Props) {
  const trendIcon = trend === undefined ? null :
    trend > 0 ? <ArrowUp className="h-3 w-3 text-status-crit" /> :
    trend < 0 ? <ArrowDown className="h-3 w-3 text-status-ok" /> :
    <Minus className="h-3 w-3 text-ink-600" />;

  const statusColor = {
    ok: "text-status-ok",
    warn: "text-status-warn",
    crit: "text-status-crit",
    info: "text-gold-700",
  }[status];

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-500">{label}</span>
        {icon && <span className={cn("opacity-70", statusColor)}>{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={cn("text-2xl font-bold", statusColor)}>{value}</span>
        {unit && <span className="text-sm text-ink-600">{unit}</span>}
        {trendIcon && <span className="ml-2 flex items-center gap-0.5 text-xs text-ink-600">{trendIcon}{Math.abs(trend || 0).toFixed(1)}%</span>}
      </div>
    </Card>
  );
}
