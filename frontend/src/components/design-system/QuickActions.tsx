"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "outline" | "ghost";
}

interface QuickActionsProps {
  actions: QuickAction[];
  className?: string;
  title?: string;
}

export function QuickActions({ actions, className, title }: QuickActionsProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {title && <span className="text-label uppercase text-ink-500">{title}</span>}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              variant={action.variant || "outline"}
              size="sm"
              onClick={action.onClick}
              className="btn-press gap-2 border-ink-700 bg-ink-900 text-ink-300 hover:border-gold-500 hover:text-gold-400"
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
