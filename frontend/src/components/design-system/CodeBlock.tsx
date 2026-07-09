"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/CopyButton";

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
  showLineNumbers?: boolean;
  title?: string;
}

export function CodeBlock({
  code,
  language = "bash",
  className,
  showLineNumbers = false,
  title,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("rounded-input border border-ink-700 bg-ink-900/80 overflow-hidden", className)}>
      {(title || language) && (
        <div className="flex items-center justify-between border-b border-ink-700/60 bg-ink-950 px-3 py-2">
          <div className="flex items-center gap-2">
            {title && <span className="text-caption text-ink-400">{title}</span>}
            {language && !title && (
              <span className="rounded-pill bg-ink-800 px-2 py-0.5 text-[10px] uppercase text-ink-500">
                {language}
              </span>
            )}
          </div>
          <CopyButton text={code} />
        </div>
      )}
      <div className="max-h-96 overflow-auto p-3">
        <pre className="font-mono text-[13px] leading-relaxed text-ink-200">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              {showLineNumbers && (
                <span className="w-8 shrink-0 select-none text-right text-ink-600 pr-3">
                  {i + 1}
                </span>
              )}
              <span className="whitespace-pre">{line || " "}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
