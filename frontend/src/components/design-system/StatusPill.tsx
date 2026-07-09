"use client";

import { cn } from "@/lib/utils";

export type StatusVariant = "ok" | "warn" | "crit" | "info" | "ai" | "gold";

interface StatusPillProps {
  variant: StatusVariant;
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

const variants: Record<StatusVariant, string> = {
  ok: "pill-ok",
  warn: "pill-warn",
  crit: "pill-crit",
  info: "pill-info",
  ai: "pill-ai",
  gold: "pill-gold",
};

export function StatusPill({ variant, children, pulse = false, className, icon }: StatusPillProps) {
  return (
    <span className={cn(variants[variant], "items-center gap-1.5", className)}>
      <span className={cn("status-dot", pulse && "animate-pulse-dot")} />
      {icon}
      {children}
    </span>
  );
}
