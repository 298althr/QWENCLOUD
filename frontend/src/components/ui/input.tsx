import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border border-ink-700 bg-ink-950 px-4 py-2 text-sm text-ink-200 placeholder-ink-600 focus:border-gold-500 focus:outline-none focus:ring-1 focus:ring-gold-500 transition-colors",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
