"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Gauge } from "@/components/charts/Gauge";
import { RadarChart } from "@/components/charts/RadarChart";
import { BarChart } from "@/components/charts/BarChart";
import { PageHeader, SectionCard, MetricCard, StatusPill, RiskBadge, ConfidenceMeter, SkeletonGrid } from "@/components/design-system";
import { Search, GitCompare, Gauge as GaugeIcon, Lightbulb, ShieldCheck, Activity, AlertCircle, CheckCircle2, TrendingDown } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FRAMEWORKS = [
  { name: "DRE", label: "Research Causes", icon: Search },
  { name: "DREV", label: "Verify Best Fix", icon: GitCompare },
  { name: "CRDS", label: "Predict Side Effects", icon: GaugeIcon },
  { name: "DQS", label: "Measure Decision Weight", icon: Activity },
  { name: "Critique", label: "Quality Guardrail", icon: ShieldCheck },
];

export default function DecisionsPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [researchInput, setResearchInput] = useState("");
  const [researchData, setResearchData] = useState<any>(null);
  const [verifyData, setVerifyData] = useState<any>(null);
  const [reactionData, setReactionData] = useState<any>(null);
  const [massData, setMassData] = useState<any>(null);
  const [calibrationData, setCalibrationData] = useState<any>(null);

  const runResearch = async () => {
    if (!researchInput.trim()) return;
    setLoading("research");
    try {
      const r = await api.research(researchInput);
      setResearchData(r);
      toast.success("Research complete");
    } catch (e: any) {
      toast.error(`Research failed: ${e.message}`);
    } finally { setLoading(null); }
  };

  const runVerification = async () => {
    setLoading("verify");
    try {
      const candidates = researchData?.candidates || [];
      const r = await api.verify(candidates);
      setVerifyData(r);
      toast.success("Verification complete");
    } catch (e: any) {
      toast.error(`Verification failed: ${e.message}`);
    } finally { setLoading(null); }
  };

  const runReaction = async () => {
    setLoading("reaction");
    try {
      const r = await api.scoreReaction("restart nginx", {});
      setReactionData(r);
      toast.success("Reaction scored");
    } catch (e: any) {
      toast.error(`Reaction scoring failed: ${e.message}`);
    } finally { setLoading(null); }
  };

  const runMass = async () => {
    setLoading("mass");
    try {
      const r = await api.mass();
      setMassData(r);
      toast.success("Decision mass calculated");
    } catch (e: any) {
      toast.error(`Mass calculation failed: ${e.message}`);
    } finally { setLoading(null); }
  };

  const loadCalibration = async () => {
    setLoading("calibration");
    try {
      const r = await api.calibration();
      setCalibrationData(r);
      toast.success("Calibration loaded");
    } catch (e: any) {
      toast.error(`Calibration load failed: ${e.message}`);
    } finally { setLoading(null); }
  };

  const fbGrades = calibrationData?.feedbackGrades || calibrationData?.grades || [];
  const fbMap = Array.isArray(fbGrades) ? {} : fbGrades;
  const feedbackRadarData = [
    { axis: "Accuracy", value: fbMap?.accuracy ?? 0 },
    { axis: "Timeliness", value: fbMap?.timeliness ?? 0 },
    { axis: "Actionability", value: fbMap?.actionability ?? 0 },
    { axis: "Completeness", value: fbMap?.completeness ?? 0 },
    { axis: "Novelty", value: fbMap?.novelty ?? 0 },
  ];

  const reactionBarData = reactionData?.dimensions
    ? Object.entries(reactionData.dimensions).map(([key, dim]: [string, any]) => ({ name: key.replace(/_/g, ' '), value: dim.value }))
    : reactionData?.breakdown?.map((b: any) => ({ name: b.dimension, value: b.score })) || [];

  const rrsValue = reactionData?.rrs ?? reactionData?.score ?? 0;
  const rrsColor = rrsValue > 60 ? "#ff5c5c" : rrsValue > 30 ? "#f5b342" : "#3ddc84";
  const rrsStatus = rrsValue > 60 ? "crit" : rrsValue > 30 ? "warn" : "ok";

  const frameworkStatus = (name: string) => {
    if (name === "DRE" && researchData) return "active";
    if (name === "DREV" && verifyData) return "active";
    if (name === "CRDS" && reactionData) return "active";
    if (name === "DQS" && massData) return "active";
    if (name === "Critique" && calibrationData) return "active";
    return "idle";
  };

  const activeCount = FRAMEWORKS.filter((f) => frameworkStatus(f.name) === "active").length;

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Decision Engine"
        description="Research causes, verify the best fix, predict side effects, measure decision weight, and guard against overconfidence."
        badge={<StatusPill variant={activeCount > 0 ? "ai" : "info"} pulse={activeCount > 0}>{activeCount} of {FRAMEWORKS.length} active</StatusPill>}
      />

      {/* Framework status bar */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {FRAMEWORKS.map((f, i) => {
          const Icon = f.icon;
          const active = frameworkStatus(f.name) === "active";
          return (
            <MetricCard
              key={f.name}
              title={f.label}
              value={active ? "ON" : "IDLE"}
              subtitle={f.name}
              icon={<Icon className="h-5 w-5" />}
              status={active ? "ok" : "info"}
              delay={i * 0.05}
            />
          );
        })}
      </section>

      {/* Research Causes Panel */}
      <SectionCard
        title="Research Causes"
        description="Explore multiple diagnosis candidates with coverage and contradiction analysis"
        delay={0.1}
        headerActions={
          <Button onClick={runResearch} disabled={loading === "research"} size="sm">
            {loading === "research" ? "Researching…" : "Research Causes"}
          </Button>
        }
      >
        <div className="flex gap-2">
          <Input
            value={researchInput}
            onChange={(e) => setResearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runResearch()}
            placeholder="e.g. API response time increased 3x"
            className="flex-1"
          />
        </div>
        {loading === "research" && <SkeletonGrid className="mt-4" />}
        {researchData && !loading && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-ink-900/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-500">Coverage</div>
                <div className="mt-1 text-metric text-gold-400">{((researchData.coverage?.coverage ?? researchData.coverage ?? 0) * 100).toFixed(0)}%</div>
              </div>
              <div className="rounded-lg bg-ink-900/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-500">Contradiction</div>
                <div className="mt-1 text-metric text-gold-400">{((researchData.contradiction_score ?? researchData.contradiction?.contradiction_score ?? 0) * 100).toFixed(0)}%</div>
              </div>
              <div className="rounded-lg bg-ink-900/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-500">Candidates</div>
                <div className="mt-1 text-metric text-gold-400">{researchData.candidates?.length || 0}</div>
              </div>
            </div>
            {researchData.candidates?.map((c: any, i: number) => (
              <div key={i} className="rounded-lg border border-ink-800 bg-ink-950/30 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-200 font-medium">{c.description || c.diagnosis || c.label || `Candidate ${i + 1}`}</span>
                  <Badge variant="outline">{(c.confidence * 100).toFixed(0)}%</Badge>
                </div>
                {c.reasoning && <p className="mt-1 text-xs text-ink-500">{c.reasoning}</p>}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Verify Best Fix Panel */}
        <SectionCard
          title="Verify Best Fix"
          description="Compare candidates head-to-head to find the robust winner"
          delay={0.15}
          headerActions={
            <Button variant="outline" onClick={runVerification} disabled={loading === "verify" || !researchData} size="sm">
              {loading === "verify" ? "Verifying…" : "Verify Best Fix"}
            </Button>
          }
        >
          {loading === "verify" && <SkeletonGrid />}
          {verifyData && !loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-status-ok" />
                <span className="text-sm text-ink-200">
                  Winner: <span className="text-gold-400 font-medium">{verifyData.winner?.description || verifyData.winner?.diagnosis || verifyData.winner?.label || "—"}</span>
                </span>
              </div>
              {verifyData.reserve && (
                <div className="text-xs text-ink-500">Reserve: {verifyData.reserve?.description || verifyData.reserve?.diagnosis || verifyData.reserve?.label || "—"}</div>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-ink-900/50 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink-500">CR (Contrast Ratio)</div>
                  <div className="mt-1 text-metric text-gold-400">{verifyData.cr?.toFixed(2) || "—"}</div>
                </div>
                <div className="rounded-lg bg-ink-900/50 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-ink-500">Regime</div>
                  <div className="mt-1 text-metric text-gold-400">{verifyData.regime || "—"}</div>
                </div>
              </div>
              <ConfidenceMeter value={verifyData.robustness ? verifyData.robustness * 100 : 0} label="Robustness" />
            </div>
          )}
          {!verifyData && !loading && (
            <p className="text-sm text-ink-600">Research causes first, then verify candidates to find the robust winner.</p>
          )}
        </SectionCard>

        {/* Predict Side Effects */}
        <SectionCard
          title="Predict Side Effects"
          description="Score the predicted impact of an action before it runs"
          delay={0.2}
          headerActions={
            <Button variant="outline" onClick={runReaction} disabled={loading === "reaction"} size="sm">
              {loading === "reaction" ? "Predicting…" : "Predict Side Effects"}
            </Button>
          }
        >
          {loading === "reaction" && <SkeletonGrid />}
          {reactionData && !loading && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <Gauge value={rrsValue} max={100} label="Impact" color={rrsColor} />
                {reactionData.vetoed && <Badge variant="critical"><AlertCircle className="h-3 w-3" /> VETOED</Badge>}
                <RiskBadge level={rrsValue > 60 ? "high" : rrsValue > 30 ? "medium" : "low"} />
              </div>
              {reactionBarData.length > 0 && <BarChart data={reactionBarData} height={150} />}
            </div>
          )}
          {!reactionData && !loading && (
            <p className="text-sm text-ink-600">Predict the side effects of a proposed action before execution.</p>
          )}
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Measure Decision Weight */}
        <SectionCard
          title="Measure Decision Weight"
          description="Quantify decision size, risk, complexity, and confidence"
          delay={0.25}
          headerActions={
            <Button variant="outline" onClick={runMass} disabled={loading === "mass"} size="sm">
              {loading === "mass" ? "Measuring…" : "Measure Decision Weight"}
            </Button>
          }
        >
          {loading === "mass" && <SkeletonGrid />}
          {massData && !loading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-400">Decision Index</span>
                <span className="text-metric text-gold-400">{massData.di?.toFixed(2) || "—"}</span>
              </div>
              <Progress value={Math.min((massData.di || 0) * 10, 100)} />
              <Badge variant={massData.tier === "mission_critical" ? "critical" : massData.tier === "critical" ? "warning" : "info"}>
                {massData.tier || "—"}
              </Badge>
              {massData.variables && (
                <div className="space-y-2 text-xs">
                  {massData.variables.map((v: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-ink-500">{v.name}</span>
                      <span className="text-ink-200">{v.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {!massData && !loading && (
            <p className="text-sm text-ink-600">Measure the decision weight to determine the required authorization level.</p>
          )}
        </SectionCard>

        {/* Explainability Panel */}
        <SectionCard title="Explainability" description="Key drivers, would-change, and missing evidence" delay={0.3}>
          {verifyData || massData ? (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-label uppercase text-ink-500">Key Drivers</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(verifyData?.drivers || massData?.variables || []).map((d: any, i: number) => (
                    <Badge key={i} variant="outline">{d.name || d.label}: {(d.weight || d.value || 0).toFixed(2)}</Badge>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <span className="text-label uppercase text-ink-500">Would Change If</span>
                <p className="mt-1 text-ink-400 text-xs">{verifyData?.wouldChange || "More evidence were collected from alternative sources"}</p>
              </div>
              <Separator />
              <div>
                <span className="text-label uppercase text-ink-500">Missing Evidence</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(verifyData?.missingEvidence || ["Historical baseline data", "Cross-server comparison"]).map((e: string, i: number) => (
                    <Badge key={i} variant="warning">{e}</Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-600">Run verification or mass calculation to see explainability breakdown.</p>
          )}
        </SectionCard>
      </section>

      {/* Quality Guardrail */}
      <SectionCard
        title="Quality Guardrail"
        description="Feedback grades, calibration, and decision score"
        delay={0.35}
        headerActions={
          <Button variant="outline" onClick={loadCalibration} disabled={loading === "calibration"} size="sm">
            {loading === "calibration" ? "Loading…" : "Load Quality Data"}
          </Button>
        }
      >
        {loading === "calibration" && <SkeletonGrid />}
        {calibrationData && !loading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col items-center">
              <Gauge value={calibrationData?.dqScore ?? calibrationData?.metrics?.mean_brier ? (1 - calibrationData.metrics.mean_brier) * 10 : 0} max={10} label="Decision Score" color="#d4af5f" size={140} />
              {calibrationData?.inflationDetected && <Badge variant="critical" className="mt-2"><AlertCircle className="h-3 w-3" /> Inflation Detected</Badge>}
            </div>
            <div className="md:col-span-2">
              <RadarChart data={feedbackRadarData} height={220} />
            </div>
            <div className="md:col-span-3 grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg bg-ink-900/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-500">Calibration Error</div>
                <div className="mt-1 text-metric text-gold-400">{(calibrationData?.ece ?? calibrationData?.metrics?.ece)?.toFixed(3) || "—"}</div>
              </div>
              <div className="rounded-lg bg-ink-900/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-500">Samples</div>
                <div className="mt-1 text-metric text-gold-400">{calibrationData?.n ?? calibrationData?.metrics?.count ?? "—"}</div>
              </div>
              <div className="rounded-lg bg-ink-900/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-ink-500">Avg Quality</div>
                <div className="mt-1 text-metric text-gold-400">{(calibrationData?.avgQuality ?? (calibrationData?.metrics?.success_rate ? calibrationData.metrics.success_rate * 100 : null))?.toFixed(2) || "—"}</div>
              </div>
            </div>
          </div>
        )}
        {!calibrationData && !loading && (
          <p className="text-sm text-ink-600">Load quality data to view the decision score, feedback grades, and radar chart.</p>
        )}
      </SectionCard>

      {/* Degradation Indicator */}
      <SectionCard title="Degradation Indicator" description="Framework health status — detects when decision quality is degrading" delay={0.4}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {FRAMEWORKS.map((f) => {
            const Icon = f.icon;
            const isDegraded = frameworkStatus(f.name) === "idle";
            return (
              <div key={f.name} className={cn("rounded-lg border p-3", isDegraded ? "border-ink-700 bg-ink-950/30" : "border-status-ok/30 bg-status-ok/5")}>
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", isDegraded ? "text-ink-600" : "text-status-ok")} />
                  <span className="text-xs font-medium text-ink-300">{f.label}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", isDegraded ? "bg-ink-600" : "bg-status-ok animate-pulse")} />
                  <span className="text-[10px] text-ink-600">{isDegraded ? "STANDBY" : "ACTIVE"}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 rounded-lg bg-ink-950/50 p-3 text-xs text-ink-500">
          <span className="text-ink-600">Overall System Status: </span>
          <span className="text-gold-400 font-medium">
            {activeCount === 0 ? "All frameworks standby — run a decision pipeline to activate" : "Frameworks active — monitoring decision quality"}
          </span>
        </div>
      </SectionCard>
    </div>
  );
}
