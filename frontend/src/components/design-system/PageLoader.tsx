"use client";

import { cn } from "@/lib/utils";

type Variant = "dashboard" | "list" | "detail" | "grid" | "chat" | "settings" | "terminal";

interface PageLoaderProps {
  variant?: Variant;
  title?: string;
  className?: string;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-6 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-6 space-y-3">
            <div className="skeleton h-4 w-24" />
            <div className="skeleton h-10 w-16" />
            <div className="skeleton h-2 w-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-6 space-y-3">
            <div className="skeleton h-5 w-32" />
            <div className="skeleton h-40 w-full" />
          </div>
        ))}
      </div>
      <div className="card p-6 space-y-3">
        <div className="skeleton h-5 w-28" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton h-4 w-4 rounded-full" />
            <div className="skeleton h-4 flex-1" />
            <div className="skeleton h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-9 w-28 rounded-lg" />
      </div>
      <div className="card p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-ink-800 last:border-0">
            <div className="skeleton h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton h-3 w-1/2" />
            </div>
            <div className="skeleton h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-56" />
        <div className="flex gap-2">
          <div className="skeleton h-9 w-24 rounded-lg" />
          <div className="skeleton h-9 w-24 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-6 space-y-3 lg:col-span-1">
          <div className="skeleton h-5 w-20" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-16" />
            </div>
          ))}
        </div>
        <div className="card p-6 space-y-3 lg:col-span-2">
          <div className="skeleton h-5 w-28" />
          <div className="skeleton h-48 w-full" />
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="space-y-6 w-full">
      <div className="skeleton h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-6 space-y-3">
            <div className="flex items-center gap-2">
              <div className="skeleton h-5 w-5 rounded" />
              <div className="skeleton h-4 w-24" />
            </div>
            <div className="skeleton h-8 w-20" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatSkeleton() {
  return (
    <div className="space-y-6 w-full">
      <div className="skeleton h-8 w-48" />
      <div className="card p-6 space-y-4 flex-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="skeleton h-8 w-8 rounded-full flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="skeleton h-4 w-1/4" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-12 flex-1 rounded-lg" />
        <div className="skeleton h-12 w-24 rounded-lg" />
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6 w-full">
      <div className="skeleton h-8 w-40" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-6 space-y-4">
            <div className="skeleton h-5 w-28" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-6 w-12 rounded-full" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function TerminalSkeleton() {
  return (
    <div className="space-y-6 w-full">
      <div className="skeleton h-8 w-40" />
      <div className="card p-6 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <div className="skeleton h-4 w-4" />
            <div className="skeleton h-4" style={{ width: `${60 + (i % 3) * 15}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-10 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

const VARIANTS: Record<Variant, () => JSX.Element> = {
  dashboard: DashboardSkeleton,
  list: ListSkeleton,
  detail: DetailSkeleton,
  grid: GridSkeleton,
  chat: ChatSkeleton,
  settings: SettingsSkeleton,
  terminal: TerminalSkeleton,
};

export function PageLoader({ variant = "list", title, className }: PageLoaderProps) {
  const Skeleton = VARIANTS[variant];
  return (
    <div className={cn("flex flex-col items-center justify-start py-8", className)}>
      {title && (
        <div className="mb-6 flex items-center gap-2 text-sm text-ink-500">
          <span className="inline-block h-2 w-2 rounded-full bg-gold-400 animate-pulse" />
          {title}
        </div>
      )}
      <div className="w-full">
        <Skeleton />
      </div>
    </div>
  );
}
