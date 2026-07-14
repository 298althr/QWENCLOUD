"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lightbulb, Send, Terminal as TerminalIcon, Loader2, AlertCircle, Bot, Zap, User } from "lucide-react";
import { onTerminalLog, type TerminalLogEntry } from "@/lib/websocket";
import { toast } from "sonner";

interface CommandEntry {
  id: string;
  command: string;
  output: string;
  exitCode: number | null;
  timestamp: number;
  source: string;
  explanation?: string;
  nextStep?: string;
  explaining?: boolean;
  error?: string;
}

function sourceLabel(source: string) {
  if (source === "ai") return "AI";
  if (source === "simulate") return "SIM";
  if (source === "user") return "YOU";
  return "SYS";
}

export default function Terminal() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<CommandEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // Load persistent logs from Redis on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.getTerminalLogs(100);
        if (cancelled || !result.logs) return;
        const entries: CommandEntry[] = result.logs.map((log: TerminalLogEntry) => ({
          id: log.id,
          command: log.command,
          output: log.output,
          exitCode: log.exitCode,
          timestamp: log.timestamp,
          source: log.source || "user",
        }));
        setHistory(entries);
        setLoaded(true);
        setTimeout(scrollToBottom, 100);
      } catch (e) {
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [scrollToBottom]);

  // Listen for real-time terminal_log events (AI commands, simulations, user commands from other sessions)
  useEffect(() => {
    const off = onTerminalLog((data) => {
      setHistory((prev) => {
        if (prev.some((e) => e.id === data.id)) return prev;
        const entry: CommandEntry = {
          id: data.id,
          command: data.command,
          output: data.output,
          exitCode: data.exitCode,
          timestamp: data.timestamp,
          source: data.source || "system",
        };
        return [...prev, entry];
      });
    });
    return () => { off(); };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [history, scrollToBottom]);

  const runCommand = async () => {
    const cmd = input.trim();
    if (!cmd || running) return;

    const id = `cmd-${++idCounter.current}`;
    setInput("");
    setRunning(true);

    const entry: CommandEntry = {
      id,
      command: cmd,
      output: "",
      exitCode: null,
      timestamp: Date.now(),
      source: "user",
    };
    setHistory((prev) => [...prev, entry]);

    try {
      const result = await api.runCommand(cmd, 15000);
      const output = result.stdout || result.stderr || result.output || "(no output)";
      const exitCode = result.exit_code ?? result.exitCode ?? null;
      setHistory((prev) =>
        prev.map((e) => (e.id === id ? { ...e, output, exitCode } : e))
      );
    } catch (err: any) {
      setHistory((prev) =>
        prev.map((e) => (e.id === id ? { ...e, output: e.output || `Error: ${err.message}`, exitCode: -1, error: err.message } : e))
      );
      toast.error(`Command failed: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  const explainCommand = async (entryId: string) => {
    const entry = history.find((e) => e.id === entryId);
    if (!entry || entry.explaining || entry.explanation) return;

    setHistory((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, explaining: true } : e))
    );

    try {
      const result = await api.explainCommand(entry.command, entry.output, entry.exitCode ?? undefined);
      setHistory((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, explanation: result.explanation, nextStep: result.nextStep, explaining: false }
            : e
        )
      );
    } catch (err: any) {
      setHistory((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, explaining: false, error: err.message } : e))
      );
      toast.error(`Explain failed: ${err.message}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runCommand();
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-200 bg-stone-50">
        <TerminalIcon className="h-4 w-4 text-stone-600" />
        <span className="text-sm font-medium text-stone-900">Terminal</span>
        <span className="text-xs text-stone-400 ml-auto">
          {history.length} {history.length === 1 ? "entry" : "entries"}
          {!loaded && " · loading..."}
        </span>
      </div>

      {/* Output area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-950 min-h-[300px] max-h-[500px]">
        {history.length === 0 && loaded && (
          <div className="text-stone-500 text-sm font-mono">
            $ Type a command and press Enter. Click the lightbulb icon to get an AI explanation of the result.
            AI commands and simulated incidents will also appear here automatically.
          </div>
        )}
        {history.map((entry) => (
          <div key={entry.id} className="space-y-1">
            {/* Command line with source badge */}
            <div className="flex items-start gap-2">
              <span className="text-green-400 font-mono text-sm shrink-0">$</span>
              <span className="text-stone-100 font-mono text-sm break-all flex-1">{entry.command}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                entry.source === "ai" ? "bg-[#4A5D23]/30 text-[#6B7E3C]" :
                entry.source === "simulate" ? "bg-amber-900/40 text-amber-400" :
                "bg-stone-800 text-stone-400"
              }`}>
                {sourceLabel(entry.source)}
              </span>
            </div>
            {/* Output */}
            {entry.output && (
              <pre className="text-stone-300 font-mono text-xs whitespace-pre-wrap pl-4 break-all">
                {entry.output}
              </pre>
            )}
            {/* Exit code badge */}
            {entry.exitCode !== null && (
              <div className="pl-4">
                <span className={`text-xs font-mono ${entry.exitCode === 0 ? "text-green-500" : "text-red-400"}`}>
                  [exit {entry.exitCode}]
                </span>
              </div>
            )}
            {/* Explain button */}
            {entry.exitCode !== null && !entry.explanation && !entry.explaining && (
              <button
                onClick={() => explainCommand(entry.id)}
                className="flex items-center gap-1.5 ml-4 mt-1 px-3 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-medium transition-colors border border-emerald-500/30"
              >
                <Lightbulb className="h-3 w-3" />
                Explain
              </button>
            )}
            {/* Explaining spinner */}
            {entry.explaining && (
              <div className="flex items-center gap-2 ml-4 mt-1 text-stone-400 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Getting explanation...
              </div>
            )}
            {/* Explanation */}
            {entry.explanation && (
              <div className="ml-4 mt-1 p-3 rounded-lg bg-stone-900 border border-stone-700">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-stone-200 text-xs leading-relaxed">{entry.explanation}</p>
                    {entry.nextStep && (
                      <p className="text-emerald-400 text-xs font-medium">
                        Next: {entry.nextStep}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Error */}
            {entry.error && !entry.explanation && (
              <div className="flex items-center gap-1.5 ml-4 mt-1 text-red-400 text-xs">
                <AlertCircle className="h-3 w-3" />
                {entry.error}
              </div>
            )}
          </div>
        ))}
        {running && (
          <div className="flex items-center gap-2 text-stone-400 text-sm font-mono">
            <Loader2 className="h-3 w-3 animate-spin" />
            running...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-stone-200 bg-stone-50">
        <span className="text-stone-500 font-mono text-sm shrink-0">$</span>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          disabled={running}
          className="font-mono text-sm border-stone-300 bg-white focus:border-stone-900"
        />
        <Button
          onClick={runCommand}
          disabled={running || !input.trim()}
          size="sm"
          className="shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
          Run
        </Button>
      </div>
    </div>
  );
}
