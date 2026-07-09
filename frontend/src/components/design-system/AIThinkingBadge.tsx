"use client";

import { cn } from "@/lib/utils";

interface AIThinkingBadgeProps {
  text?: string;
  className?: string;
  variant?: "compact" | "expanded";
}

export function AIThinkingBadge({
  text = "AI thinking",
  className,
  variant = "compact",
}: AIThinkingBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-pill bg-status-ai/15 px-3 py-1.5 text-caption font-medium text-status-ai",
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-ai opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-status-ai" />
      </span>
      {variant === "expanded" && (
        <span className="flex gap-0.5">
          <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
          <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
          <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
        </span>
      )}
      <span>{text}</span>
    </div>
  );
}
