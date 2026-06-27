"use client";

import { approveAction, rejectAction } from "@/lib/websocket";
import { useAgentStore } from "@/stores/agent-store";

export default function ApprovalCard() {
  const { approvals, removeApproval } = useAgentStore();

  if (approvals.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">Pending Approvals</h2>
        <p className="text-sm text-ink-600">No pending approvals. Actions requiring human review will appear here.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
        Pending Approvals ({approvals.length})
      </h2>
      <div className="space-y-3">
        {approvals.map((a) => (
          <div key={a.action_id} className="rounded-lg border border-accent-warn/30 bg-accent-warn/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm text-ink-200">{a.action}</p>
                <div className="mt-1 flex gap-3 text-xs text-ink-600">
                  <span>conf={(a.confidence * 100).toFixed(0)}%</span>
                  <span>risk={a.risk_level}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { approveAction(a.action_id); removeApproval(a.action_id); }}
                  className="rounded-md bg-accent-ok/20 px-3 py-1.5 text-xs font-medium text-accent-ok hover:bg-accent-ok/30"
                >
                  Approve
                </button>
                <button
                  onClick={() => { rejectAction(a.action_id); removeApproval(a.action_id); }}
                  className="rounded-md bg-accent-crit/20 px-3 py-1.5 text-xs font-medium text-accent-crit hover:bg-accent-crit/30"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
