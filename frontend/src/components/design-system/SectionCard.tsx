"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  headerActions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  glow?: boolean;
  delay?: number;
}

export function SectionCard({
  title,
  description,
  children,
  headerActions,
  footer,
  className,
  contentClassName,
  glow = false,
  delay = 0,
}: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "overflow-hidden",
        glow ? "card-glow" : "card",
        className
      )}
    >
      {(title || headerActions) && (
        <div className="flex items-center justify-between border-b border-ink-700/60 px-lg py-4">
          <div className="space-y-xs">
            {title && <h2 className="text-card-title text-ink-200">{title}</h2>}
            {description && <p className="text-caption text-ink-500">{description}</p>}
          </div>
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </div>
      )}
      <div className={cn("p-lg", contentClassName)}>{children}</div>
      {footer && (
        <div className="border-t border-ink-700/60 bg-ink-900/50 px-lg py-3 text-caption text-ink-500">
          {footer}
        </div>
      )}
    </motion.div>
  );
}
