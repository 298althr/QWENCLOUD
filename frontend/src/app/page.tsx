"use client";

import { useEffect } from "react";
import HealthCard from "@/components/HealthCard";
import ServerHealth from "@/components/ServerHealth";
import ApprovalCard from "@/components/ApprovalCard";
import { onAnomalyAlert, onApprovalNeeded } from "@/lib/websocket";
import { useAgentStore } from "@/stores/agent-store";

export default function HomePage() {
  const { addAlert, addApproval } = useAgentStore();

  useEffect(() => {
    const off1 = onAnomalyAlert((a) => addAlert(a));
    const off2 = onApprovalNeeded((a: any) => addApproval({ action_id: a.anomalyId || a.action_id, action: a.action || "unknown", confidence: Number(a.confidence) || 0, risk_level: a.risk_level || "medium", timestamp: new Date().toISOString() }));
    return () => { off1(); off2(); };
  }, [addAlert, addApproval]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gold-400">Overview</h1>
          <p className="text-sm text-ink-500">
            AI-Native Server Operations Agent — powered by Qwen Cloud
          </p>
        </div>
        <span className="pill-info">Track 4 · Autopilot Agent</span>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HealthCard title="API Gateway" endpoint="/api/health" />
        <HealthCard title="Server Health" endpoint="/api/health/server" />
        <HealthCard title="Processes" endpoint="/api/processes" />
        <HealthCard title="Docker" endpoint="/api/docker/containers" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ServerHealth />
        </div>
        <ApprovalCard />
      </section>
    </div>
  );
}
