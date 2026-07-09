"use client";

import { cn } from "@/lib/utils";

interface SkeletonGridProps {
  rows?: number;
  columns?: number;
  className?: string;
  itemHeight?: string;
}

export function SkeletonGrid({
  rows = 3,
  columns = 1,
  className,
  itemHeight = "h-24",
}: SkeletonGridProps) {
  return (
    <div
      className={cn(
        "grid gap-md",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 md:grid-cols-2",
        columns === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {Array.from({ length: rows * columns }).map((_, i) => (
        <div key={i} className={cn("skeleton", itemHeight)} />
      ))}
    </div>
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-4"
          style={{ width: `${100 - (i % 3) * 20}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("card p-lg space-y-md", className)}>
      <div className="skeleton h-4 w-1/3" />
      <div className="skeleton h-8 w-1/2" />
      <div className="skeleton h-4 w-2/3" />
    </div>
  );
}
