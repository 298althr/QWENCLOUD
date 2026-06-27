"use client";

import AgentConsole from "@/components/AgentConsole";
import ApprovalCard from "@/components/ApprovalCard";

export default function AgentPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gold-400">Agent Console</h1>
        <p className="text-sm text-ink-500">
          Send natural-language commands. Watch the Qwen reasoning chain stream live.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AgentConsole />
        </div>
        <div className="space-y-4">
          <ApprovalCard />
        </div>
      </div>
    </div>
  );
}
