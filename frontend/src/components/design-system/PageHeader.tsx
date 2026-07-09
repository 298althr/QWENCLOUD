"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  badge?: ReactNode;
}

export function PageHeader({ title, description, children, className, badge }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={cn("page-header", className)}
    >
      <div className="space-y-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-display text-ink-100">{title}</h1>
          {badge && <div>{badge}</div>}
        </div>
        {description && (
          <p className="text-body text-ink-400 max-w-2xl">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </motion.div>
  );
}
