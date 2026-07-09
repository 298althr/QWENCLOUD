"use client";

import { cn } from "@/lib/utils";
import { StatusPill, StatusVariant } from "./StatusPill";
import { formatDistanceToNow } from "date-fns";

export interface ActivityItem {
  id: string;
  type: StatusVariant | "ai";
  title: string;
  description?: string;
  timestamp: number | Date;
  metadata?: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  className?: string;
  emptyMessage?: string;
  maxHeight?: string;
}

export function ActivityFeed({
  items,
  className,
  emptyMessage = "No recent activity",
  maxHeight = "max-h-[420px]",
}: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-8 text-caption text-ink-500", className)}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1 overflow-y-auto pr-1", maxHeight, className)}>
      {items.map((item, index) => {
        const statusVariant = item.type === "ai" ? "ai" : item.type;
        return (
          <div
            key={item.id}
            className={cn(
              "group flex items-start gap-3 rounded-lg p-3 transition-micro hover:bg-ink-800",
              index !== items.length - 1 && "border-b border-ink-800/50"
            )}
          >
            <div className="mt-0.5 shrink-0">
              <StatusPill variant={statusVariant} className="text-[10px]">
                {item.type.toUpperCase()}
              </StatusPill>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink-200">{item.title}</div>
              {item.description && (
                <div className="mt-0.5 text-caption text-ink-500 line-clamp-2">{item.description}</div>
              )}
              {item.metadata && (
                <div className="mt-1.5 font-mono text-[11px] text-ink-600">{item.metadata}</div>
              )}
            </div>
            <div className="shrink-0 text-[11px] text-ink-600">
              {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
