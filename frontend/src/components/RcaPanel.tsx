"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { onRcaResult, type RcaResult } from "@/lib/websocket";
import { SectionCard } from "@/components/design-system";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, CheckCircle, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RcaPanel() {
  const [rcaResults, setRcaResults] = useState<RcaResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationResult, setCalibrationResult] = useState<any>(null);

  useEffect(() => {
    const unsub = onRcaResult((data) => {
      setRcaResults((prev) => [data, ...prev].slice(0, 10));
    });
    return unsub;
  }, []);

  const runAnalysis = async (type: string, severity: string, message: string) => {
    setAnalyzing(true);
    try {
      const result = await api.rcaAnalyze({ type, severity, message });
      setRcaResults((prev) => [result, ...prev].slice(0, 10));
    } catch (e) {
      console.error("[rca] analyze failed:", e);
    } finally {
      setAnalyzing(false);
    }
  };

  const runCalibration = async () => {
    setCalibrating(true);
    try {
      const result = await api.rcaCalibrate();
      setCalibrationResult(result);
    } catch (e) {
      console.error("[rca] calibrate failed:", e);
    } finally {
      setCalibrating(false);
    }
  };

  return (
    <SectionCard
      title="Root Cause Analyst"
      description="Bayesian causal inference over infrastructure digital twin"
      delay={0.3}
      headerActions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runCalibration}
            disabled={calibrating}
            className="gap-1"
          >
            {calibrating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            {calibrating ? "Running..." : "Calibrate"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Quick trigger buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runAnalysis("cpu_spike", "warning", "CPU spike detected — 92% usage")}
            disabled={analyzing}
            className="gap-1"
          >
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
            Test CPU Spike
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runAnalysis("ram_pressure", "critical", "RAM pressure — 95% usage, OOM risk")}
            disabled={analyzing}
            className="gap-1"
          >
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            Test RAM Pressure
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runAnalysis("container_crash", "critical", "Container CrashLoopBackOff — exit code 137")}
            disabled={analyzing}
            className="gap-1"
          >
            {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            Test Crash
          </Button>
        </div>

        {/* Calibration results */}
        {calibrationResult && (
          <div className="rounded-lg border border-ink-700 bg-ink-850 p-3">
            <div className="text-sm font-medium text-ink-200 mb-2">Calibration Results</div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div>
                <span className="text-ink-500">Pass Rate: </span>
                <span className={cn("font-mono", calibrationResult.summary.passed >= 4 ? "text-status-ok" : "text-status-warn")}>
                  {calibrationResult.summary.pass_rate}
                </span>
              </div>
              <div>
                <span className="text-ink-500">Avg Confidence: </span>
                <span className="font-mono text-ink-300">{(calibrationResult.summary.avg_confidence * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-ink-500">Avg Time: </span>
                <span className="font-mono text-ink-300">{calibrationResult.summary.avg_analysis_time_ms}ms</span>
              </div>
              <div>
                <span className="text-ink-500">False Positive: </span>
                <span className="font-mono text-ink-300">{calibrationResult.summary.false_positive_rate}</span>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {calibrationResult.results.map((r: any) => (
                <div key={r.test_id} className="flex items-center gap-2 text-xs">
                  {r.passed ? (
                    <CheckCircle className="h-3 w-3 text-status-ok" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-status-warn" />
                  )}
                  <span className="text-ink-400">{r.test_id}:</span>
                  <span className="text-ink-300 truncate">{r.scenario}</span>
                  <span className="ml-auto font-mono text-ink-500">
                    {r.actual_confidence ? `${(r.actual_confidence * 100).toFixed(0)}%` : "N/A"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RCA Results */}
        {rcaResults.length === 0 ? (
          <div className="text-sm text-ink-600 py-4 text-center">
            No RCA analyses yet. Trigger an anomaly or run a test scenario above.
          </div>
        ) : (
          <div className="space-y-2">
            {rcaResults.map((rca) => (
              <div key={rca.incident_id} className="rounded-lg border border-ink-800 bg-ink-850/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-ink-500">{rca.incident_id}</span>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      rca.governance_status === "approved"
                        ? "bg-status-ok/10 text-status-ok"
                        : "bg-status-warn/10 text-status-warn"
                    )}>
                      {rca.governance_status}
                    </span>
                  </div>
                  <span className={cn(
                    "text-sm font-mono font-bold",
                    rca.confidence_score >= 0.85 ? "text-status-ok" : rca.confidence_score >= 0.6 ? "text-status-warn" : "text-status-crit"
                  )}>
                    {(rca.confidence_score * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="text-sm text-ink-300 mb-2">{rca.symptom}</div>

                {/* Causal chain */}
                {rca.causal_chain && rca.causal_chain.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap text-xs mb-2">
                    {rca.causal_chain.map((node, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className={cn(
                          "rounded px-2 py-1 border",
                          node.level === "symptom" ? "border-status-crit/30 bg-status-crit/5 text-status-crit" :
                          node.level === "intermediate" ? "border-status-warn/30 bg-status-warn/5 text-status-warn" :
                          "border-status-ok/30 bg-status-ok/5 text-status-ok"
                        )}>
                          <span className="font-medium">{node.node}</span>
                          <span className="ml-1 font-mono opacity-60">{(node.confidence * 100).toFixed(0)}%</span>
                        </div>
                        {i < rca.causal_chain.length - 1 && <span className="text-ink-600">{'->'}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Causal explanation */}
                {rca.causal_explanation && (
                  <div className="text-xs text-ink-400 mb-2 line-clamp-2">{rca.causal_explanation}</div>
                )}

                {/* Recommended actions */}
                {rca.recommended_actions && rca.recommended_actions.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs text-ink-500 uppercase">Recommended Actions</div>
                    {rca.recommended_actions.slice(0, 3).map((action, i) => (
                      <div key={i} className="text-xs text-ink-300 flex items-start gap-1">
                        <span className="text-ink-600 mt-0.5">{i + 1}.</span>
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Blast radius */}
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="text-ink-500">Blast radius: <span className="text-ink-300 font-mono">{rca.blast_radius}</span></span>
                  <span className="text-ink-500">Analysis time: <span className="text-ink-300 font-mono">{rca.analysis_time_ms}ms</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
