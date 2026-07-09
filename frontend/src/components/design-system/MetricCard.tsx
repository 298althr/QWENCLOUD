"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "flat";
  trendValue?: string;
  icon?: React.ReactNode;
  status?: "ok" | "warn" | "crit" | "info";
  className?: string;
  delay?: number;
}

const statusColors = {
  ok: "text-status-ok",
  warn: "text-status-warn",
  crit: "text-status-crit",
  info: "text-status-info",
};

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  status = "info",
  className,
  delay = 0,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "card card-hover flex flex-col justify-between p-lg",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-label uppercase text-ink-500">{title}</span>
        {icon && <div className={cn("text-ink-500", statusColors[status])}>{icon}</div>}
      </div>
      <div className="mt-3">
        <div className="text-metric text-ink-100">{value}</div>
        {(trend || subtitle) && (
          <div className="mt-1 flex items-center gap-2 text-caption text-ink-500">
            {trend && (
              <span
                className={cn(
                  "flex items-center gap-0.5",
                  trend === "up" && "text-status-ok",
                  trend === "down" && "text-status-crit",
                  trend === "flat" && "text-ink-500"
                )}
              >
                {trend === "up" && <ArrowUpRight className="h-3 w-3" />}
                {trend === "down" && <ArrowDownRight className="h-3 w-3" />}
                {trend === "flat" && <Minus className="h-3 w-3" />}
                {trendValue}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
}
