import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex w-full rounded-lg border border-ink-700 bg-ink-950 px-4 py-2.5 text-sm text-ink-200 placeholder-ink-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500 transition-colors resize-none",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";
