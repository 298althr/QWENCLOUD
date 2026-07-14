"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type SecretFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  className?: string;
};

export function SecretField({
  label,
  value,
  placeholder,
  onChange,
  readOnly = false,
  className,
}: SecretFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const maskedValue = value ? "•".repeat(Math.min(value.length, 32)) : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs text-ink-600">{label}</label>
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleCopy}
              className="text-ink-600 hover:text-ink-300 transition-colors"
              title="Copy"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-status-ok" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setRevealed(!revealed)}
            className="text-ink-600 hover:text-ink-300 transition-colors"
            title={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div className="relative">
        <input
          type={revealed ? "text" : "password"}
          value={revealed ? value : (value ? maskedValue : "")}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly || !onChange}
          placeholder={placeholder}
          className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm font-mono text-ink-200 focus:border-gold-700 focus:outline-none"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

type SecretTextProps = {
  label: string;
  value: string;
  className?: string;
};

export function SecretText({ label, value, className }: SecretTextProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const maskedValue = value ? "•".repeat(Math.min(value.length, 24)) : "not set";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className={cn("flex items-center justify-between rounded-md border border-ink-800 bg-ink-950/30 px-3 py-2", className)}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-xs text-ink-600 shrink-0">{label}</span>
        <span className="text-xs font-mono text-ink-300 truncate">
          {revealed ? (value || "not set") : maskedValue}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {value && (
          <button
            type="button"
            onClick={handleCopy}
            className="text-ink-600 hover:text-ink-300 transition-colors"
            title="Copy"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-status-ok" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => setRevealed(!revealed)}
          className="text-ink-600 hover:text-ink-300 transition-colors"
          title={revealed ? "Hide" : "Reveal"}
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
