"use client";

import { useState } from "react";
import { approveAction, rejectAction } from "@/lib/websocket";
import { useAgentStore } from "@/stores/agent-store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function ApprovalCard() {
  const { approvals, removeApproval } = useAgentStore();
  const [confirm, setConfirm] = useState<{ action_id: string; action: "approve" | "reject" } | null>(null);

  const handleConfirm = () => {
    if (!confirm) return;
    if (confirm.action === "approve") {
      approveAction(confirm.action_id);
      toast.success("Action approved");
    } else {
      rejectAction(confirm.action_id);
      toast.info("Action rejected");
    }
    removeApproval(confirm.action_id);
    setConfirm(null);
  };

  if (approvals.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Pending Approvals</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-ink-600">
            <CheckCircle2 className="h-4 w-4 text-status-ok" />
            No pending approvals. Actions requiring human review will appear here.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-status-warn" />
            Pending Approvals ({approvals.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {approvals.map((a) => (
            <div key={a.action_id} className="rounded-lg border border-status-warn/30 bg-status-warn/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-ink-200">{a.action}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <Badge variant="outline">{(a.confidence * 100).toFixed(0)}% conf</Badge>
                    <Badge variant={a.risk_level === "high" ? "critical" : a.risk_level === "medium" ? "warning" : "success"}>
                      {a.risk_level} risk
                    </Badge>
                    {a.di_tier && (
                      <Badge variant="info">DI: {a.di_tier}</Badge>
                    )}
                    {a.di_score != null && (
                      <Badge variant="outline">DI={a.di_score.toFixed(2)}</Badge>
                    )}
                    {a.rrs != null && (
                      <Badge variant={a.rrs < -50 ? "critical" : a.rrs < 0 ? "warning" : "success"}>
                        RRS={a.rrs}
                      </Badge>
                    )}
                    {a.crds_vetoed && (
                      <Badge variant="critical">CRDS VETOED</Badge>
                    )}
                  </div>
                  {a.drev_winner && (
                    <div className="mt-1 text-xs text-ink-500">
                      DREV Winner: <span className="text-gold-400">{a.drev_winner}</span>
                      {a.drev_reserve && <span className="text-ink-600"> · Reserve: {a.drev_reserve}</span>}
                      {a.drev_cr != null && <span className="text-ink-600"> · CR: {a.drev_cr.toFixed(2)}</span>}
                      {a.drev_robustness != null && <span className="text-ink-600"> · Robustness: {(a.drev_robustness * 100).toFixed(0)}%</span>}
                    </div>
                  )}
                  {(a.dre_candidates ?? 0) > 0 && (
                    <div className="mt-0.5 text-xs text-ink-600">
                      DRE: {a.dre_candidates} candidates · Coverage: {a.dre_coverage != null ? (a.dre_coverage * 100).toFixed(0) : "—"}% · Contradiction: {a.dre_contradiction != null ? (a.dre_contradiction * 100).toFixed(0) : "—"}%
                    </div>
                  )}
                  {(a.degradations?.length ?? 0) > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {a.degradations!.map((d: string, i: number) => (
                        <Badge key={i} variant="warning"><AlertTriangle className="h-3 w-3" /> {d}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-status-ok hover:bg-status-ok/10"
                    onClick={() => setConfirm({ action_id: a.action_id, action: "approve" })}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-status-crit hover:bg-status-crit/10"
                    onClick={() => setConfirm({ action_id: a.action_id, action: "reject" })}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {confirm?.action}</DialogTitle>
            <DialogDescription>
              Are you sure you want to {confirm?.action} this action? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant={confirm?.action === "approve" ? "default" : "destructive"}
              onClick={handleConfirm}
            >
              {confirm?.action === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
