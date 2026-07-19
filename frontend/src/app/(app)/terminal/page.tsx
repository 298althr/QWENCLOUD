"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader, SectionCard, PageLoader } from "@/components/design-system";
import { Lightbulb, Send, Terminal as TerminalIcon, Loader2, AlertCircle, Trash2, History, Clock, CheckCircle, XCircle, FlaskConical } from "lucide-react";
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

function sourceColor(source: string) {
  if (source === "ai") return "bg-emerald-500/20 text-emerald-400";
  if (source === "simulate") return "bg-amber-500/20 text-amber-400";
  if (source === "user") return "bg-blue-500/20 text-blue-400";
  return "bg-stone-700 text-stone-400";
}

export default function TerminalPage() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<CommandEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [sandboxActive, setSandboxActive] = useState(false);

  const scrollToBottom = useCallback(() => {
    const el = document.getElementById("terminal-output");
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await api.getTerminalLogs(200);
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
      } catch {
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [scrollToBottom]);

  useEffect(() => {
    api.getSandboxMode().then((data) => setSandboxActive(data.active)).catch(() => {});
    const interval = setInterval(() => {
      api.getSandboxMode().then((data) => setSandboxActive(data.active)).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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

    const id = `cmd-${Date.now()}`;
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

  const clearHistory = async () => {
    try {
      await api.clearTerminalLogs();
      setHistory([]);
      toast.success("Terminal history cleared");
    } catch (e: any) {
      toast.error(`Clear failed: ${e.message}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runCommand();
    }
  };

  const filteredHistory = filter === "all"
    ? history
    : history.filter((e) => e.source === filter);

  const successCount = history.filter((e) => e.exitCode === 0).length;
  const failCount = history.filter((e) => e.exitCode !== null && e.exitCode !== 0).length;
  const aiCount = history.filter((e) => e.source === "ai").length;

  if (!loaded) {
    return <PageLoader variant="terminal" title="Loading terminal..." />;
  }

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Terminal"
        description="Run commands, view history, and get AI explanations. All commands are checked by SAF guardrails."
        badge={sandboxActive ? (
          <span className="flex items-center gap-1.5 rounded-full bg-status-warn/20 px-3 py-1 text-xs font-medium text-status-warn animate-pulse">
            <FlaskConical className="h-3 w-3" /> SANDBOX MODE
          </span>
        ) : undefined}
      />

      {/* Stats bar */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-ink-800 bg-ink-900 p-3">
          <div className="text-xs text-ink-500 uppercase">Total Commands</div>
          <div className="text-2xl font-semibold text-ink-100 mt-1">{history.length}</div>
        </div>
        <div className="rounded-lg border border-ink-800 bg-ink-900 p-3">
          <div className="text-xs text-ink-500 uppercase">Succeeded</div>
          <div className="text-2xl font-semibold text-emerald-400 mt-1">{successCount}</div>
        </div>
        <div className="rounded-lg border border-ink-800 bg-ink-900 p-3">
          <div className="text-xs text-ink-500 uppercase">Failed</div>
          <div className="text-2xl font-semibold text-red-400 mt-1">{failCount}</div>
        </div>
        <div className="rounded-lg border border-ink-800 bg-ink-900 p-3">
          <div className="text-xs text-ink-500 uppercase">AI Commands</div>
          <div className="text-2xl font-semibold text-blue-400 mt-1">{aiCount}</div>
        </div>
      </section>

      {/* Terminal and side panel */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Terminal - takes 2 columns */}
        <div className="lg:col-span-2 flex flex-col rounded-lg border border-stone-700 bg-stone-950 overflow-hidden">
          {/* Terminal header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-stone-700 bg-stone-900">
            <TerminalIcon className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-medium text-stone-200">Terminal</span>
            <div className="ml-auto flex items-center gap-2">
              {/* Filter buttons */}
              <button
                onClick={() => setFilter("all")}
                className={`text-xs px-2 py-0.5 rounded ${filter === "all" ? "bg-stone-700 text-stone-200" : "text-stone-500 hover:text-stone-300"}`}
              >All</button>
              <button
                onClick={() => setFilter("user")}
                className={`text-xs px-2 py-0.5 rounded ${filter === "user" ? "bg-stone-700 text-stone-200" : "text-stone-500 hover:text-stone-300"}`}
              >You</button>
              <button
                onClick={() => setFilter("ai")}
                className={`text-xs px-2 py-0.5 rounded ${filter === "ai" ? "bg-stone-700 text-stone-200" : "text-stone-500 hover:text-stone-300"}`}
              >AI</button>
              <button
                onClick={() => setFilter("simulate")}
                className={`text-xs px-2 py-0.5 rounded ${filter === "simulate" ? "bg-stone-700 text-stone-200" : "text-stone-500 hover:text-stone-300"}`}
              >SIM</button>
              <button
                onClick={clearHistory}
                className="text-xs px-2 py-0.5 rounded text-stone-500 hover:text-red-400 flex items-center gap-1"
                title="Clear all terminal history"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </button>
            </div>
          </div>

          {/* Output area */}
          <div id="terminal-output" className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-950 min-h-[400px] max-h-[600px]">
            {filteredHistory.length === 0 && loaded && (
              <div className="text-stone-500 text-sm font-mono">
                $ Type a command and press Enter. Click the lightbulb icon to get an AI explanation.
                AI commands and simulated incidents will also appear here automatically.
              </div>
            )}
            {filteredHistory.map((entry) => (
              <div key={entry.id} className="space-y-1">
                {/* Command line with source badge */}
                <div className="flex items-start gap-2">
                  <span className="text-green-400 font-mono text-sm shrink-0">$</span>
                  <span className="text-stone-100 font-mono text-sm break-all flex-1">{entry.command}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${sourceColor(entry.source)}`}>
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
                  <div className="pl-4 flex items-center gap-2">
                    {entry.exitCode === 0 ? (
                      <span className="flex items-center gap-1 text-xs font-mono text-green-400">
                        <CheckCircle className="h-3 w-3" /> exit 0
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-mono text-red-400">
                        <XCircle className="h-3 w-3" /> exit {entry.exitCode}
                      </span>
                    )}
                  </div>
                )}
                {/* Explain button - light green for better contrast on dark background */}
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
                  <div className="ml-4 mt-1 p-3 rounded-lg bg-stone-900 border border-emerald-800/50">
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
          <div className="flex items-center gap-2 px-4 py-3 border-t border-stone-700 bg-stone-900">
            <span className="text-emerald-400 font-mono text-sm shrink-0">$</span>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter command... (SAF guardrails active)"
              disabled={running}
              className="font-mono text-sm border-stone-700 bg-stone-950 text-stone-100 focus:border-emerald-500"
            />
            <Button
              onClick={runCommand}
              disabled={running || !input.trim()}
              size="sm"
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
            >
              <Send className="h-3.5 w-3.5" />
              Run
            </Button>
          </div>
        </div>

        {/* Command history side panel */}
        <div className="space-y-4">
          <SectionCard
            title="Command History"
            description="Recent commands run on this server"
            delay={0.1}
          >
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {history.slice(-30).reverse().map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 rounded border border-ink-800/50 px-2 py-1.5 hover:bg-ink-800/30 cursor-pointer"
                  onClick={() => setInput(entry.command)}
                >
                  <span className={`text-[9px] font-mono px-1 py-0.5 rounded shrink-0 ${sourceColor(entry.source)}`}>
                    {sourceLabel(entry.source)}
                  </span>
                  <span className="text-xs text-ink-300 font-mono truncate flex-1">{entry.command}</span>
                  {entry.exitCode === 0 ? (
                    <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
                  ) : entry.exitCode !== null ? (
                    <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                  ) : null}
                </div>
              ))}
              {history.length === 0 && (
                <p className="text-sm text-ink-600">No commands yet. Run something above.</p>
              )}
            </div>
            <p className="mt-2 text-xs text-ink-600">Click any command to reuse it.</p>
          </SectionCard>

          <SectionCard
            title="Process Logs"
            description="Commands run by the AI and system"
            delay={0.15}
          >
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {history.filter((e) => e.source !== "user").slice(-20).reverse().map((entry) => (
                <div key={entry.id} className="rounded border border-ink-800/50 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-mono px-1 py-0.5 rounded shrink-0 ${sourceColor(entry.source)}`}>
                      {sourceLabel(entry.source)}
                    </span>
                    <span className="text-xs text-ink-300 font-mono truncate flex-1">{entry.command}</span>
                  </div>
                  {entry.output && (
                    <pre className="text-[10px] text-ink-500 font-mono mt-1 truncate">{entry.output.slice(0, 80)}</pre>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-ink-600 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    {entry.exitCode === 0 ? (
                      <span className="text-[10px] text-emerald-400">success</span>
                    ) : entry.exitCode !== null ? (
                      <span className="text-[10px] text-red-400">failed</span>
                    ) : null}
                  </div>
                </div>
              ))}
              {history.filter((e) => e.source !== "user").length === 0 && (
                <p className="text-sm text-ink-600">No AI or system commands yet.</p>
              )}
            </div>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
