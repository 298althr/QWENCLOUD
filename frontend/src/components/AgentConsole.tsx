"use client";

import { useState, useEffect, useRef } from "react";
import { sendAgentMessage, onReasoningStream, onResponseStream, onActionUpdate } from "@/lib/websocket";
import { useAgentStore } from "@/stores/agent-store";

export default function AgentConsole() {
  const [input, setInput] = useState("");
  const { reasoning, actions, isProcessing, lastResponse, addReasoning, addAction, setProcessing, setLastResponse, clearConsole } = useAgentStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off1 = onReasoningStream((d) => addReasoning("reasoning", d.chunk));
    const off2 = onResponseStream((d) => addReasoning("response", d.chunk));
    const off3 = onActionUpdate((d) => {
      addAction(d);
      if (d.stage === "diagnosis_complete" || d.stage === "complete") setProcessing(false);
      if (d.stage === "error") setProcessing(false);
    });
    return () => { off1(); off2(); off3(); };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [reasoning]);

  const send = () => {
    if (!input.trim()) return;
    setProcessing(true);
    clearConsole();
    sendAgentMessage(input.trim());
    setInput("");
  };

  return (
    <div className="card-glow flex flex-col p-5" style={{ minHeight: "70vh" }}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Agent Console</h2>
        <div className="flex items-center gap-2">
          {isProcessing && <span className="pill-warn animate-pulse">Processing…</span>}
          <button onClick={clearConsole} className="text-xs text-ink-600 hover:text-gold-400">Clear</button>
        </div>
      </div>

      {/* Reasoning chain */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-lg bg-ink-950/50 p-4 font-mono text-xs" style={{ minHeight: "300px" }}>
        {reasoning.length === 0 && !isProcessing && (
          <p className="text-ink-600">Type a natural-language command below. The agent&apos;s reasoning chain will stream here in real-time.</p>
        )}
        {reasoning.map((entry, i) => (
          <div key={i} className={entry.type === "reasoning" ? "text-ink-500" : "text-gold-400"}>
            {entry.type === "reasoning" ? <span className="text-ink-700">[think] </span> : <span className="text-accent-info">[response] </span>}
            {entry.text}
          </div>
        ))}
        {actions.map((a, i) => (
          <div key={`a${i}`} className="mt-2 text-accent-info">
            [action] stage={a.stage} {a.action ? `· ${a.action}` : ""} {a.confidence ? `· conf=${(a.confidence * 100).toFixed(0)}%` : ""}
          </div>
        ))}
      </div>

      {/* Last response summary */}
      {lastResponse && (
        <div className="mt-3 rounded-lg border border-gold-700/30 bg-gold-900/10 p-3 text-sm text-gold-300">
          <span className="text-xs uppercase text-gold-500">Response: </span>{lastResponse}
        </div>
      )}

      {/* Input bar */}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="e.g. show server health, kill the top CPU process, deploy https://github.com/user/repo"
          className="flex-1 rounded-lg border border-ink-700 bg-ink-950 px-4 py-2.5 text-sm text-ink-200 placeholder-ink-600 focus:border-gold-500 focus:outline-none"
        />
        <button
          onClick={send}
          disabled={isProcessing}
          className="rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-50 hover:from-gold-400 hover:to-gold-500 transition-all"
        >
          Send
        </button>
      </div>
    </div>
  );
}
