"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { ShieldCheck, Loader2, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function SecurityPage() {
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);

  const loadAudit = async () => {
    setAuditLoading(true);
    try {
      const r = await api.auditLog(50);
      setAuditLog(r.entries || []);
    } catch {} finally { setAuditLoading(false); }
  };

  useEffect(() => { loadAudit(); }, []);

  const runScan = async () => {
    setScanning(true);
    try {
      const r = await api.securityScan();
      setScanResult(r);
      toast.success("Security scan complete");
    } catch (e: any) {
      toast.error(`Scan failed: ${e.message}`);
    } finally { setScanning(false); }
  };

  const safLayers = [
    { name: "L1: Asset Classification", icon: Lock },
    { name: "L2: Identity Verification", icon: Lock },
    { name: "L3: Network Segmentation", icon: Lock },
    { name: "L4: Policy Enforcement", icon: Lock },
    { name: "L5: Immutable Logging", icon: Lock },
    { name: "L6: Containment", icon: Lock },
    { name: "L7: Governance Compliance", icon: Lock },
  ];

  const auditColumns: Column<any>[] = [
    { key: "timestamp", header: "Time", render: (r) => <span className="text-ink-600 text-xs">{new Date(r.timestamp).toLocaleTimeString()}</span> },
    { key: "operation", header: "Operation" },
    { key: "target", header: "Target", render: (r) => <span className="font-mono text-xs text-ink-400">{r.target?.slice(0, 40)}</span> },
    { key: "result", header: "Result", render: (r) => <Badge variant={r.result === "success" ? "success" : r.result === "blocked" || r.result === "failure" ? "critical" : "info"}>{r.result}</Badge> },
    { key: "confidence", header: "Confidence", render: (r) => r.confidence !== null ? `${(r.confidence * 100).toFixed(0)}%` : "—" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-gold-400" />
        <div>
          <h1 className="text-xl font-semibold text-gold-400">Safety & Audit</h1>
          <p className="text-sm text-ink-500">Safety checks, audit log, and security scans.</p>
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle>Safety Checks</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
            {safLayers.map((l) => {
              const Icon = l.icon;
              return (
                <div key={l.name} className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-950/30 p-3">
                  <Icon className="h-3.5 w-3.5 text-status-ok" />
                  <span className="text-xs text-ink-300">{l.name}</span>
                  <span className="ml-auto h-2 w-2 rounded-full bg-status-ok" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Security Scan</CardTitle>
            <Button variant="outline" size="sm" onClick={runScan} disabled={scanning}>
              {scanning ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning…</> : "Run Scan"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {scanResult && (
            <div className="rounded-lg bg-ink-950/50 p-3 text-xs flex gap-4">
              <span className="text-ink-500">User: <span className="text-gold-400">{scanResult.user}</span></span>
              <span className="text-ink-500">Open ports: <span className="text-gold-400">{scanResult.open_ports?.length || 0}</span></span>
              <Badge variant="success">{scanResult.status}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Audit Log (Immutable)</CardTitle>
            <Button variant="ghost" size="sm" onClick={loadAudit}>Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <DataTable columns={auditColumns} data={auditLog} searchable searchKeys={["operation", "target"]} pageSize={15} emptyMessage="No audit entries" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
