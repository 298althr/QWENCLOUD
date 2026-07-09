"use client";

import { cn } from "@/lib/utils";

interface ConfidenceMeterProps {
  value: number;
  label?: string;
  className?: string;
  showValue?: boolean;
}

export function ConfidenceMeter({ value, label, className, showValue = true }: ConfidenceMeterProps) {
  const clamped = Math.min(100, Math.max(0, value));
  let color = "bg-status-crit";
  if (clamped >= 80) color = "bg-status-ok";
  else if (clamped >= 50) color = "bg-status-warn";

  return (
    <div className={cn("space-y-1.5", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between text-caption">
          {label && <span className="text-ink-400">{label}</span>}
          {showValue && (
            <span className={cn("font-medium", color.replace("bg-", "text-"))}>
              {clamped.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
