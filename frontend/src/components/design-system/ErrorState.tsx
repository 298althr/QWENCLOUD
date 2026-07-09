"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this data. Try again or check your connection.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-status-crit/30 bg-status-crit/10 px-6 py-10 text-center",
        className
      )}
    >
      <AlertCircle className="mb-3 h-8 w-8 text-status-crit" />
      <h3 className="text-card-title text-ink-100">{title}</h3>
      <p className="mt-1 max-w-sm text-caption text-ink-400">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="mt-4 gap-2 border-ink-700 text-ink-200 hover:border-gold-500 hover:text-gold-400"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  );
}
