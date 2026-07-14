"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

type Props = {
  text: string;
  label?: string;
};

export function CopyButton({ text, label }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`Copied ${label || "text"}`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1 rounded p-1 text-ink-600 hover:text-gold-700 transition-colors"
      aria-label={`Copy ${label || "text"}`}
    >
      {copied ? <Check className="h-3 w-3 text-status-ok" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
