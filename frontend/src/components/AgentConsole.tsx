"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { sendAgentMessage, onReasoningStream, onResponseStream, onActionUpdate, onServerMetrics } from "@/lib/websocket";
import { useAgentStore } from "@/stores/agent-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard, ConfidenceMeter, RiskBadge, StatusPill, AIThinkingBadge } from "@/components/design-system";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Brain, Cog, ShieldCheck, CheckCircle2, AlertTriangle, Loader2,
  ChevronDown, ChevronRight, Sparkles, History, Cpu, MemoryStick,
  HardDrive, MessageSquare, Lightbulb, X,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

const STAGE_ICONS: Record<string, React.ReactNode> = {
  intent: <Brain className="h-3.5 w-3.5" />,
  saf_result: <ShieldCheck className="h-3.5 w-3.5" />,
  decision_mass: <Cog className="h-3.5 w-3.5" />,
  complete: <CheckCircle2 className="h-3.5 w-3.5" />,
  error: <AlertTriangle className="h-3.5 w-3.5" />,
};

const SUGGESTIONS = [
  "show server health",
  "the API is slow",
  "list top CPU processes",
  "run security scan",
  "restart nginx",
  "check memory pressure",
];

function getStatus(value: number | null, warn: number, crit: number): "ok" | "warn" | "crit" {
  if (value === null || value === undefined) return "ok";
  if (value >= crit) return "crit";
  if (value >= warn) return "warn";
  return "ok";
}

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export default function AgentConsole() {
  const [input, setInput] = useState("");
  const [thinkingText, setThinkingText] = useState("");
  const [responseText, setResponseText] = useState("");
  const [showThinking, setShowThinking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [metrics, setMetrics] = useState<{ cpu: number; ram: number; disk: number | null } | null>(null);
  const [activeTab, setActiveTab] = useState<"stream" | "history">("stream");
  const [actions, setActions] = useState<any[]>([]);
  const [isListening, setIsListening] = useState(false);
  const { isProcessing, approvals, setProcessing, clearConsole } = useAgentStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const off1 = onReasoningStream((d) => {
      if (!isListening) return;
      setThinkingText((prev) => prev + d.chunk);
      setIsThinking(true);
    });
    const off2 = onResponseStream((d) => {
      if (!isListening) return;
      setResponseText((prev) => prev + d.chunk);
      setIsThinking(false);
    });
    const off3 = onActionUpdate((d) => {
      if (!isListening) return;
      setActions((prev) => [...prev.slice(-50), { ...d, timestamp: Date.now() }]);
      if (d.stage === "diagnosis_complete" || d.stage === "complete" || d.stage === "error" || d.stage === "remediated") {
        setProcessing(false);
        setIsThinking(false);
        setIsListening(false);
      }
    });
    const off4 = onServerMetrics((m) => setMetrics({ cpu: m.cpu, ram: m.ram, disk: m.disk }));
    return () => { off1(); off2(); off3(); off4(); };
  }, [isListening, setProcessing]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [responseText, actions, showThinking, activeTab, history]);

  const autoResize = () => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    }
  };

  const send = (cmd?: string) => {
    const message = (cmd || input).trim();
    if (!message) return;
    setProcessing(true);
    setThinkingText("");
    setResponseText("");
    setActions([]);
    setShowThinking(false);
    setIsThinking(true);
    setIsListening(true);
    clearConsole();
    setHistory((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: message, timestamp: Date.now() }]);
    sendAgentMessage(message);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const hasThinking = thinkingText.length > 0;
  const hasResponse = responseText.length > 0;

  const latestAction = actions[actions.length - 1];
  const confidence = latestAction?.confidence ?? 0;
  const riskLevel = latestAction?.risk_level ?? "medium";
  const riskBadgeLevel: "low" | "medium" | "high" = riskLevel === "high" ? "high" : riskLevel === "low" ? "low" : "medium";

  const cpu = metrics?.cpu ?? 0;
  const ram = metrics?.ram ?? 0;
  const disk = metrics?.disk ?? null;
  const cpuStatus = getStatus(cpu, 60, 85);
  const ramStatus = getStatus(ram, 70, 90);
  const diskStatus = getStatus(disk, 70, 85);

  const historyList = useMemo(() => {
    const agentResponses: ChatMessage[] = hasResponse
      ? [{ id: `a-${Date.now()}`, role: "agent", text: responseText, timestamp: Date.now() }]
      : [];
    return [...history, ...agentResponses].slice(-50);
  }, [history, responseText, hasResponse]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:h-[calc(100vh-180px)] min-h-[70vh]">
      {/* Left pane — History */}
      <SectionCard
        title="History"
        description="Previous commands"
        className="hidden lg:flex flex-col"
        contentClassName="flex-1 p-0"
        delay={0.1}
      >
        <ScrollArea className="h-full">
          {history.length === 0 ? (
            <div className="p-4 text-sm text-ink-600">No commands yet.</div>
          ) : (
            <div className="space-y-1 p-2">
              {history.map((h) => (
                <button
                  key={h.id}
                  onClick={() => { setInput(h.text); autoResize(); }}
                  className="w-full text-left rounded-lg p-2 text-sm text-ink-400 hover:bg-ink-800 hover:text-ink-200 transition-micro"
                >
                  <div className="flex items-center gap-2">
                    {h.role === "user" ? <MessageSquare className="h-3.5 w-3.5 text-gold-400" /> : <Sparkles className="h-3.5 w-3.5 text-status-ai" />}
                    <span className="truncate">{h.text}</span>
                  </div>
                  <div className="mt-1 text-[10px] text-ink-600">{formatRelativeTime(h.timestamp)}</div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </SectionCard>

      {/* Center pane — Chat stream */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        <SectionCard
          className="flex-1 flex flex-col p-0"
          contentClassName="flex-1 flex flex-col p-0"
          delay={0.15}
          headerActions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("stream")}
                className={cn("rounded-md px-2 py-1 text-xs transition-micro", activeTab === "stream" ? "bg-ink-800 text-gold-400" : "text-ink-500 hover:text-ink-300")}
              >
                Stream
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={cn("rounded-md px-2 py-1 text-xs transition-micro lg:hidden", activeTab === "history" ? "bg-ink-800 text-gold-400" : "text-ink-500 hover:text-ink-300")}
              >
                History
              </button>
              <button
                onClick={() => {
                  clearConsole();
                  setThinkingText("");
                  setResponseText("");
                  setActions([]);
                  setIsListening(false);
                  setIsThinking(false);
                }}
                className="rounded-md p-1 text-ink-500 hover:text-ink-200 transition-micro"
                title="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          }
        >
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeTab === "history" ? (
              <div className="space-y-1 lg:hidden">
                {historyList.map((h) => (
                  <div key={h.id} className="rounded-lg border border-ink-800 p-3 text-sm">
                    <div className={cn("font-medium", h.role === "user" ? "text-gold-400" : "text-status-ai")}>
                      {h.role === "user" ? "You" : "Agent"}
                    </div>
                    <div className="mt-1 text-ink-300 whitespace-pre-wrap">{h.text}</div>
                    <div className="mt-1 text-[10px] text-ink-600">{formatRelativeTime(h.timestamp)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {!hasThinking && !hasResponse && !isProcessing && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-ink-800 bg-ink-900/50 p-4 text-sm text-ink-500">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="h-4 w-4 text-gold-400" />
                        <span className="font-medium text-ink-300">Suggested commands</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {SUGGESTIONS.map((s) => (
                          <button
                            key={s}
                            onClick={() => send(s)}
                            className="rounded-full border border-ink-700 bg-ink-950 px-3 py-1 text-xs text-ink-400 hover:border-gold-500 hover:text-gold-400 transition-micro"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-ink-600">Type a natural-language command below. The agent&apos;s reasoning chain will stream here in real-time.</p>
                  </div>
                )}

                {/* Collapsible Thinking Pad */}
                {hasThinking && (
                  <div className="rounded-lg border border-ink-800 bg-ink-950/50 overflow-hidden">
                    <button
                      onClick={() => setShowThinking((v) => !v)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-ink-900/50 transition-colors"
                    >
                      {showThinking ? (
                        <ChevronDown className="h-4 w-4 text-ink-600 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-ink-600 shrink-0" />
                      )}
                      <Brain className={cn("h-4 w-4 shrink-0", isThinking ? "text-gold-400 animate-pulse" : "text-ink-600")} />
                      <span className="text-xs font-medium text-ink-400">
                        {isThinking ? "Thinking..." : "Thought process"}
                      </span>
                      {isThinking ? (
                        <AIThinkingBadge className="ml-auto" />
                      ) : (
                        <span className="ml-auto text-[10px] text-ink-600">
                          {thinkingText.length > 1000 ? `${(thinkingText.length / 1000).toFixed(1)}k chars` : `${thinkingText.length} chars`}
                        </span>
                      )}
                    </button>
                    {showThinking && (
                      <div className="border-t border-ink-800 px-3 py-2 max-h-[400px] overflow-y-auto">
                        <div className="font-mono text-xs leading-relaxed text-ink-500 whitespace-pre-wrap">
                          {thinkingText}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action stages */}
                {actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {actions.map((a, i) => (
                      <Badge
                        key={`a${i}`}
                        variant={a.stage === "error" ? "critical" : a.stage === "complete" || a.stage === "diagnosis_complete" ? "success" : "outline"}
                        className="text-[10px] gap-1"
                      >
                        {STAGE_ICONS[a.stage] || <Cog className="h-3 w-3" />}
                        {a.stage}
                        {a.confidence != null && <span className="opacity-70">{(a.confidence * 100).toFixed(0)}%</span>}
                        {a.risk_level && <span className="opacity-70">{a.risk_level}</span>}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Final Response */}
                {hasResponse && (
                  <div className="rounded-lg border border-gold-700/30 bg-gold-900/10 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-gold-400" />
                      <span className="text-xs uppercase tracking-wider text-gold-500 font-medium">Response</span>
                    </div>
                    <div className="text-sm text-gold-200">
                      <ReactMarkdown
                        components={{
                          code({ node, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || "");
                            return match ? (
                              <SyntaxHighlighter style={atomDark} language={match[1]} PreTag="div" className="rounded-lg !bg-ink-950 !text-xs">
                                {String(children).replace(/\n$/, "")}
                              </SyntaxHighlighter>
                            ) : (
                              <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-xs text-gold-400" {...props}>{children}</code>
                            );
                          },
                        }}
                      >
                        {responseText}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-ink-800 p-3 flex gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="e.g. show server health, kill the top CPU process, deploy https://github.com/user/repo"
              rows={1}
              className="flex-1 rounded-lg border border-ink-700 bg-ink-950 px-4 py-2.5 text-sm text-ink-200 placeholder-ink-600 focus:border-gold-500 focus:outline-none resize-none"
            />
            <Button onClick={() => send()} disabled={isProcessing} className="self-end">
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="ml-2">{isProcessing ? "Processing" : "Send"}</span>
            </Button>
          </div>
        </SectionCard>
      </div>

      {/* Right pane — Context */}
      <div className="space-y-4">
        <SectionCard title="Agent Status" description="Current reasoning context" delay={0.2}>
          <div className="space-y-4">
            {isProcessing ? (
              <div className="flex items-center gap-2 text-sm text-ink-400">
                <Loader2 className="h-4 w-4 animate-spin text-gold-400" />
                Processing request...
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-ink-500">
                <History className="h-4 w-4" />
                {actions.length} pipeline events
              </div>
            )}
            <ConfidenceMeter value={confidence * 100} label="Confidence" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-400">Risk level</span>
              <RiskBadge level={riskBadgeLevel} />
            </div>
            {latestAction?.degradations && latestAction.degradations.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs uppercase text-ink-500">Degradations</span>
                {latestAction.degradations.map((d: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-status-warn">
                    <AlertTriangle className="h-3 w-3" /> {d}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Server Metrics" description="Live context" delay={0.25}>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-400 flex items-center gap-2"><Cpu className="h-4 w-4" /> CPU</span>
              <StatusPill variant={cpuStatus} pulse={cpuStatus !== "ok"}>{cpu.toFixed(1)}%</StatusPill>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-400 flex items-center gap-2"><MemoryStick className="h-4 w-4" /> RAM</span>
              <StatusPill variant={ramStatus} pulse={ramStatus !== "ok"}>{ram.toFixed(1)}%</StatusPill>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-400 flex items-center gap-2"><HardDrive className="h-4 w-4" /> Disk</span>
              <StatusPill variant={diskStatus} pulse={diskStatus !== "ok"}>{disk != null ? `${disk.toFixed(1)}%` : "—"}</StatusPill>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Suggestions" description="Quick actions" delay={0.3}>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-ink-700 bg-ink-950 px-3 py-1 text-xs text-ink-400 hover:border-gold-500 hover:text-gold-400 transition-micro"
              >
                {s}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Pending Approvals" description="Human-in-the-loop" delay={0.35}>
          {approvals.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <CheckCircle2 className="h-4 w-4 text-status-ok" />
              No approvals pending
            </div>
          ) : (
            <div className="space-y-2">
              {approvals.slice(0, 3).map((a) => (
                <div key={a.action_id} className="rounded-lg border border-ink-800 bg-ink-950/50 p-2 text-sm">
                  <div className="text-ink-300 truncate">{a.action}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-500">
                    <span>{(a.confidence * 100).toFixed(0)}% conf</span>
                    <span>·</span>
                    <span className={a.risk_level === "high" ? "text-status-crit" : "text-ink-500"}>{a.risk_level} risk</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
