"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, SectionCard, StatusPill, PageLoader } from "@/components/design-system";
import { CheckCircle2, XCircle, Clock, RefreshCw, ShieldCheck, AlertTriangle, FileText, Cpu } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PendingItem = {
  action_id: string;
  plan: any[];
  confidence: number;
  risk_level: string;
  status: string;
  actor: string;
  source: string;
  createdAt: string;
  decisionContext?: any;
};

type HistoryItem = {
  action_id: string;
  plan: any[];
  confidence: number;
  risk_level: string;
  status: string;
  actor: string;
  source: string;
  createdAt: string;
  executedAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
  decisionContext?: any;
};

export default function ApprovalsPage() {
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [p, h] = await Promise.all([api.pendingApprovals(), api.approvalHistory(50)]);
      setPending(p.pending || []);
      setHistory(h.history || []);
    } catch (e: any) {
      toast.error(`Failed to load approvals: ${e.message}`);
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(() => fetchAll(), 10000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleApprove = async (actionId: string) => {
    setActionLoading(actionId);
    try {
      await api.approve(actionId);
      toast.success("Action approved and executed");
      await fetchAll();
    } catch (e: any) {
      toast.error(`Approve failed: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    setActionLoading(rejectDialog);
    try {
      await api.reject(rejectDialog, rejectReason);
      toast.info("Action rejected");
      setRejectDialog(null);
      setRejectReason("");
      await fetchAll();
    } catch (e: any) {
      toast.error(`Reject failed: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  const getActionLabel = (plan: any[]) => {
    if (!plan || plan.length === 0) return "unknown";
    return plan.map((s) => s.name || s.tool || "action").join(" → ");
  };

  const getRiskVariant = (risk: string): "critical" | "warning" | "success" =>
    risk === "high" ? "critical" : risk === "medium" ? "warning" : "success";

  if (!dataLoaded) {
    return <PageLoader variant="list" title="Loading approvals..." />;
  }

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Approvals"
        description="Human-in-the-loop checkpoint for AI actions requiring authorization"
        badge={
          pending.length > 0
            ? <StatusPill variant="warn" pulse>{pending.length} pending</StatusPill>
            : <StatusPill variant="ok"><ShieldCheck className="h-3 w-3" /> All clear</StatusPill>
        }
      />

      {/* Pending Approvals */}
      <SectionCard
        title="Pending Actions"
        description="AI actions awaiting human review"
        delay={0.1}
        headerActions={
          <Button variant="outline" size="sm" onClick={() => fetchAll()} disabled={loading}>
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
          </Button>
        }
      >
        {pending.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-ink-600 py-4">
            <CheckCircle2 className="h-4 w-4 text-status-ok" />
            No pending approvals. AI actions requiring human review will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((item) => {
              const ctx = item.decisionContext || {};
              const di = ctx.decision_mass || {};
              const dre = ctx.dre || {};
              const drev = ctx.drev || {};
              const crds = ctx.crds || {};
              const degradations = ctx.degradations || [];

              return (
                <div
                  key={item.action_id}
                  className="rounded-lg border border-status-warn/30 bg-status-warn/5 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Action header */}
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-status-warn shrink-0" />
                        <span className="text-sm font-medium text-ink-200 truncate">
                          {getActionLabel(item.plan)}
                        </span>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mb-2">
                        <Badge variant="outline">
                          {(item.confidence * 100).toFixed(0)}% conf
                        </Badge>
                        <Badge variant={getRiskVariant(item.risk_level)}>
                          {item.risk_level} risk
                        </Badge>
                        {di.tier && (
                          <Badge variant="info">DI: {di.tier}</Badge>
                        )}
                        {di.di != null && (
                          <Badge variant="outline">DI={di.di.toFixed(2)}</Badge>
                        )}
                        {crds.rrs != null && (
                          <Badge variant={crds.rrs < -50 ? "critical" : crds.rrs < 0 ? "warning" : "success"}>
                            RRS={crds.rrs}
                          </Badge>
                        )}
                        {crds.vetoed && (
                          <Badge variant="critical">CRDS VETOED</Badge>
                        )}
                        <Badge variant="outline">{item.source}</Badge>
                      </div>

                      {/* Plan details */}
                      {item.plan && item.plan.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {item.plan.map((step, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-ink-500">
                              <span className="font-mono text-gold-700">{i + 1}.</span>
                              <span className="text-ink-300">{step.name || step.tool}</span>
                              {step.args && Object.keys(step.args).length > 0 && (
                                <span className="text-ink-600 truncate">
                                  {JSON.stringify(step.args).slice(0, 120)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* DRE/DREV context */}
                      {drev.winner && (
                        <div className="mt-2 text-xs text-ink-500">
                          DREV Winner: <span className="text-gold-700">{drev.winner.approach}</span>
                          {drev.reserve && <span className="text-ink-600"> · Reserve: {drev.reserve.approach}</span>}
                          {drev.cr != null && <span className="text-ink-600"> · CR: {drev.cr.toFixed(2)}</span>}
                        </div>
                      )}
                      {(dre.candidates?.length ?? 0) > 0 && (
                        <div className="mt-0.5 text-xs text-ink-600">
                          DRE: {dre.candidates.length} candidates
                          {dre.coverage && ` · Coverage: ${(dre.coverage.coverage * 100).toFixed(0)}%`}
                        </div>
                      )}

                      {/* Degradations */}
                      {degradations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {degradations.map((d: string, i: number) => (
                            <Badge key={i} variant="warning">
                              <AlertTriangle className="h-3 w-3" /> {d}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="mt-2 text-xs text-ink-600">
                        {formatTime(item.createdAt)} · {item.actor}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="text-status-ok hover:bg-status-ok/10"
                        onClick={() => handleApprove(item.action_id)}
                        disabled={actionLoading === item.action_id}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-status-crit hover:bg-status-crit/10"
                        onClick={() => { setRejectDialog(item.action_id); setRejectReason(""); }}
                        disabled={actionLoading === item.action_id}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Reject Dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRejectDialog(null)}>
          <div className="rounded-lg border border-ink-700 bg-ink-900 p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium text-ink-200 mb-3">Reject Action</h3>
            <p className="text-xs text-ink-600 mb-3">Provide a reason for rejecting this action (optional):</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-200 min-h-[80px] resize-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRejectDialog(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleReject} disabled={actionLoading === rejectDialog}>
                {actionLoading === rejectDialog ? "Rejecting..." : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <SectionCard
        title="Approval History"
        description="Recently approved or rejected actions"
        delay={0.15}
      >
        {history.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-ink-600 py-4">
            <FileText className="h-4 w-4" />
            No approval history yet.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.action_id}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3",
                  item.status === "approved"
                    ? "border-status-ok/20 bg-status-ok/5"
                    : "border-status-crit/20 bg-status-crit/5"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {item.status === "approved" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-status-ok shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-status-crit shrink-0" />
                    )}
                    <span className="text-sm text-ink-200 truncate">{getActionLabel(item.plan)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-ink-600">
                    <Badge variant="outline">{(item.confidence * 100).toFixed(0)}% conf</Badge>
                    <Badge variant={getRiskVariant(item.risk_level)}>{item.risk_level}</Badge>
                    <span>{item.status === "approved" ? formatTime(item.executedAt || "") : formatTime(item.rejectedAt || "")}</span>
                    {item.rejectReason && <span className="text-status-crit">· {item.rejectReason}</span>}
                  </div>
                </div>
                <Badge variant={item.status === "approved" ? "success" : "critical"} className="shrink-0">
                  {item.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* HITL Info */}
      <SectionCard
        title="How Human-in-the-Loop Works"
        description="The approval system that governs AI actions"
        delay={0.2}
      >
        <div className="space-y-3 text-sm text-ink-400">
          <div className="flex items-start gap-3">
            <Cpu className="h-4 w-4 text-gold-700 shrink-0 mt-0.5" />
            <div>
              <span className="text-ink-200">Auto-execute:</span> Low-risk, high-confidence actions
              (&ge;85% confidence, low risk) run automatically after passing SAF 7-layer security.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-4 w-4 text-status-warn shrink-0 mt-0.5" />
            <div>
              <span className="text-ink-200">Human approval:</span> Medium-risk or lower-confidence
              actions (50-85% confidence) pause here for human review before execution.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-status-crit shrink-0 mt-0.5" />
            <div>
              <span className="text-ink-200">Blocked:</span> High-risk actions on critical assets or
              very low confidence (&lt;50%) are blocked and escalated.
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-4 w-4 text-status-ok shrink-0 mt-0.5" />
            <div>
              <span className="text-ink-200">SAF re-check:</span> Even after human approval, actions
              pass through SAF again with humanApproved=true. SAF can still block if the action
              violates hard safety constraints.
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
