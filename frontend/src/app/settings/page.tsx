"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader, SectionCard, MetricCard, StatusPill, ConfidenceMeter } from "@/components/design-system";
import { SlidersHorizontal, DollarSign, Gauge, Zap, RefreshCw, Cpu, FlaskConical, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [model, setModel] = useState("qwen3.7-plus");
  const [monitorInterval, setMonitorInterval] = useState(30);
  const [autoExecute, setAutoExecute] = useState(true);
  const [usage, setUsage] = useState<any>(null);
  const [usageWindow, setUsageWindow] = useState("day");
  const [dailyBudget, setDailyBudget] = useState(5);
  const [monthlyBudget, setMonthlyBudget] = useState(50);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(false);
  const [sandboxLoading, setSandboxLoading] = useState(false);

  const fetchUsage = useCallback(async (window?: string) => {
    setLoadingUsage(true);
    try {
      const data = await api.getUsage(window || usageWindow);
      setUsage(data);
      if (data.budgets) {
        setDailyBudget(data.budgets.daily);
        setMonthlyBudget(data.budgets.monthly);
      }
    } catch (e: any) {
      toast.error(`Failed to load usage: ${e.message}`);
    } finally {
      setLoadingUsage(false);
    }
  }, [usageWindow]);

  useEffect(() => {
    fetchUsage();
    const interval = setInterval(() => fetchUsage(), 30000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  useEffect(() => {
    api.getSandboxMode().then((data) => setSandboxMode(data.active)).catch(() => {});
  }, []);

  const toggleSandbox = async (active: boolean) => {
    setSandboxLoading(true);
    try {
      await api.setSandboxMode(active);
      setSandboxMode(active);
      toast.success(active ? "Sandbox mode activated" : "Sandbox mode deactivated");
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally {
      setSandboxLoading(false);
    }
  };

  const resetSandbox = async () => {
    setSandboxLoading(true);
    try {
      await api.resetSandbox();
      toast.success("Sandbox volume reset");
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    } finally {
      setSandboxLoading(false);
    }
  };

  const save = () => {
    toast.success("Settings saved");
  };

  const saveBudgets = async () => {
    try {
      await api.saveBudgets(dailyBudget, monthlyBudget);
      toast.success("Budgets updated");
      fetchUsage();
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    }
  };

  const resetGuardrails = async () => {
    try {
      await api.resetGuardrails();
      toast.success("Guardrails reset");
      fetchUsage();
    } catch (e: any) {
      toast.error(`Failed: ${e.message}`);
    }
  };

  const budgetStatus = (used: number, limit: number) => used >= limit * 0.9 ? "crit" : used >= limit * 0.7 ? "warn" : "ok";
  const dailyStatus = usage?.budgets ? budgetStatus(usage.budgets.dailyUsed, usage.budgets.daily) : "ok";
  const monthlyStatus = usage?.budgets ? budgetStatus(usage.budgets.monthlyUsed, usage.budgets.monthly) : "ok";

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Settings"
        description="Agent configuration, thresholds, and AI usage costs"
        badge={<StatusPill variant="ok">System online</StatusPill>}
      />

      <Tabs defaultValue="agent">
        <TabsList>
          <TabsTrigger value="agent"><SlidersHorizontal className="mr-2 h-4 w-4" /> Agent Config</TabsTrigger>
          <TabsTrigger value="usage"><DollarSign className="mr-2 h-4 w-4" /> AI Usage & Costs</TabsTrigger>
        </TabsList>

        <TabsContent value="agent" className="mt-4">
          <SectionCard
            title="Agent Configuration"
            description="Runtime behavior and thresholds"
            delay={0.1}
            headerActions={<Button onClick={save} size="sm">Save Settings</Button>}
          >
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <label className="text-ink-300">Auto-Execute Confidence Threshold</label>
                  <span className="font-mono text-gold-700">{confidenceThreshold}%</span>
                </div>
                <p className="mb-2 text-xs text-ink-600">Actions with confidence above this threshold auto-execute. Below require human approval.</p>
                <ConfidenceMeter value={confidenceThreshold} showValue={false} />
                <input type="range" min="50" max="100" value={confidenceThreshold} onChange={(e) => setConfidenceThreshold(Number(e.target.value))} className="w-full accent-gold-500 mt-3" />
              </div>

              <div>
                <label className="text-sm text-ink-300">Qwen Model</label>
                <p className="mb-2 text-xs text-ink-600">Primary model for intent parsing and diagnosis.</p>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qwen3.7-max">Qwen 3.7 Max (complex diagnosis)</SelectItem>
                    <SelectItem value="qwen3.7-plus">Qwen 3.7 Plus (balanced)</SelectItem>
                    <SelectItem value="qwen3.6-flash">Qwen 3.6 Flash (fast checks)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm">
                  <label className="text-ink-300">Monitoring Interval</label>
                  <span className="font-mono text-gold-700">{monitorInterval}s</span>
                </div>
                <p className="mb-2 text-xs text-ink-600">How often the monitoring loop polls server health.</p>
                <input type="range" min="10" max="300" step="10" value={monitorInterval} onChange={(e) => setMonitorInterval(Number(e.target.value))} className="w-full accent-gold-500" />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-950/30 p-4">
                <div>
                  <label className="text-sm text-ink-300">Auto-Execute Enabled</label>
                  <p className="text-xs text-ink-600">Allow the agent to execute safe actions automatically.</p>
                </div>
                <Switch checked={autoExecute} onCheckedChange={setAutoExecute} />
              </div>

              <div className={cn("rounded-lg border p-4", sandboxMode ? "border-status-warn/40 bg-status-warn/5" : "border-ink-800 bg-ink-950/30")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className={cn("h-4 w-4", sandboxMode ? "text-status-warn" : "text-ink-500")} />
                    <div>
                      <label className="text-sm text-ink-300">Sandbox Mode</label>
                      <p className="text-xs text-ink-600">Run commands in disposable containers. SAF is relaxed. Files route to isolated volume.</p>
                    </div>
                  </div>
                  <Switch checked={sandboxMode} onCheckedChange={toggleSandbox} disabled={sandboxLoading} />
                </div>
                {sandboxMode && (
                  <div className="mt-3 flex items-center gap-3">
                    <Badge variant="warning" className="animate-pulse">SANDBOX ACTIVE</Badge>
                    <Button variant="outline" size="sm" onClick={resetSandbox} disabled={sandboxLoading}>
                      <RefreshCw className={cn("h-3 w-3", sandboxLoading && "animate-spin")} /> Reset Sandbox Volume
                    </Button>
                  </div>
                )}
                {!sandboxMode && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-ink-600">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>When activated, terminal commands run inside disposable Alpine containers with network isolation and resource limits. File operations route to a separate sandbox volume. This is the safe demo mode.</span>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
          {usage && (
            <div className="space-y-4">
              {/* Cost Summary Cards */}
              <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard title="Total Cost" value={`$${usage.totalCostUSD?.toFixed(4) || "0.00"}`} subtitle={`Window: ${usage.window}`} icon={<DollarSign className="h-5 w-5" />} status="info" />
                <MetricCard title="API Calls" value={usage.callCount || 0} subtitle="Total requests" icon={<Zap className="h-5 w-5" />} status="info" />
                <MetricCard title="Input Tokens" value={(usage.totalInputTokens || 0).toLocaleString()} subtitle="Prompts" icon={<Gauge className="h-5 w-5" />} status="ok" />
                <MetricCard title="Output + Thinking" value={((usage.totalOutputTokens || 0) + (usage.totalThinkingTokens || 0)).toLocaleString()} subtitle="Generated tokens" icon={<Cpu className="h-5 w-5" />} status="warn" />
              </section>

              {/* Budget Status */}
              <SectionCard
                title="Budget Limits"
                description="Daily and monthly spending caps"
                delay={0.15}
                headerActions={
                  <div className="flex items-center gap-2">
                    <Select value={usageWindow} onValueChange={(v) => { setUsageWindow(v); fetchUsage(v); }}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hour">Last hour</SelectItem>
                        <SelectItem value="day">Last 24h</SelectItem>
                        <SelectItem value="week">Last 7 days</SelectItem>
                        <SelectItem value="month">Last 30 days</SelectItem>
                        <SelectItem value="all">All time</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => fetchUsage()} disabled={loadingUsage}>
                      <RefreshCw className={cn("h-3 w-3", loadingUsage && "animate-spin")} /> Refresh
                    </Button>
                  </div>
                }
              >
                <div className="space-y-4">
                  {usage.budgets && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-ink-500">Daily</span>
                          <StatusPill variant={dailyStatus}>{`$${usage.budgets.dailyUsed.toFixed(4)} / $${usage.budgets.daily}`}</StatusPill>
                        </div>
                        <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", dailyStatus === "crit" ? "bg-status-crit" : dailyStatus === "warn" ? "bg-status-warn" : "bg-gold-500")}
                            style={{ width: `${Math.min((usage.budgets.dailyUsed / usage.budgets.daily) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-ink-500">Monthly</span>
                          <StatusPill variant={monthlyStatus}>{`$${usage.budgets.monthlyUsed.toFixed(4)} / $${usage.budgets.monthly}`}</StatusPill>
                        </div>
                        <div className="h-2 rounded-full bg-ink-800 overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", monthlyStatus === "crit" ? "bg-status-crit" : monthlyStatus === "warn" ? "bg-status-warn" : "bg-gold-500")}
                            style={{ width: `${Math.min((usage.budgets.monthlyUsed / usage.budgets.monthly) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-xs text-ink-600">Daily Budget (USD)</label>
                      <input type="number" step="0.5" min="0" value={dailyBudget} onChange={(e) => setDailyBudget(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-200" />
                    </div>
                    <div>
                      <label className="text-xs text-ink-600">Monthly Budget (USD)</label>
                      <input type="number" step="1" min="0" value={monthlyBudget} onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                        className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-200" />
                    </div>
                  </div>
                  <Button onClick={saveBudgets} size="sm">Save Budgets</Button>
                </div>
              </SectionCard>

              {/* Guardrail Status */}
              {usage.guardrails && (
                <SectionCard
                  title="Guardrails"
                  description="Rate limiting, circuit breaker, and safety configuration"
                  delay={0.2}
                  headerActions={
                    <Button variant="outline" size="sm" onClick={resetGuardrails}>
                      <RefreshCw className="h-3 w-3" /> Reset
                    </Button>
                  }
                >
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="flex items-center gap-2 rounded-lg border border-ink-800 bg-ink-950/30 p-3">
                      <span className={cn("h-2 w-2 rounded-full", usage.guardrails.circuitBreaker.tripped ? "bg-status-crit" : "bg-status-ok")} />
                      <span className="text-xs text-ink-400">Circuit Breaker</span>
                      <Badge variant={usage.guardrails.circuitBreaker.tripped ? "critical" : "success"} className="ml-auto text-[10px]">
                        {usage.guardrails.circuitBreaker.tripped ? "TRIPPED" : "OK"}
                      </Badge>
                    </div>
                    <div className="rounded-lg border border-ink-800 bg-ink-950/30 p-3 text-xs text-ink-400">
                      Failures: <span className="text-ink-200">{usage.guardrails.circuitBreaker.consecutiveFailures}</span>
                    </div>
                    <div className="rounded-lg border border-ink-800 bg-ink-950/30 p-3 text-xs text-ink-400">
                      Rate Limit: <span className="text-ink-200">{usage.guardrails.config.rateLimitPerMinute}/min</span>
                    </div>
                    <div className="rounded-lg border border-ink-800 bg-ink-950/30 p-3 text-xs text-ink-400">
                      Max Input: <span className="text-ink-200">{usage.guardrails.config.maxInputTokens} tokens</span>
                    </div>
                  </div>
                  {usage.guardrails.rateLimits && Object.keys(usage.guardrails.rateLimits).length > 0 && (
                    <div className="mt-4 space-y-1">
                      <p className="text-xs text-ink-600 mb-1">Rate limit windows (calls/min):</p>
                      {Object.entries(usage.guardrails.rateLimits).map(([mod, info]: any) => (
                        <div key={mod} className="flex items-center gap-2 text-xs">
                          <span className="text-ink-400 w-24 truncate">{mod}</span>
                          <div className="h-1.5 flex-1 rounded-full bg-ink-800 overflow-hidden">
                            <div className="h-full bg-status-info rounded-full" style={{ width: `${Math.min((info.callsInLastMinute / info.limit) * 100, 100)}%` }} />
                          </div>
                          <span className="text-ink-500 w-16 text-right">{info.callsInLastMinute}/{info.limit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              )}

              {/* Per-Model Breakdown */}
              {usage.byModel && Object.keys(usage.byModel).length > 0 && (
                <SectionCard title="Cost by Model" description="Token usage and spend per model" delay={0.25}>
                  <div className="space-y-2">
                    {Object.entries(usage.byModel).map(([model, info]: any) => (
                      <div key={model} className="flex items-center justify-between border-b border-ink-800/50 py-2 text-sm">
                        <div>
                          <span className="text-ink-200">{model}</span>
                          <span className="ml-2 text-xs text-ink-600">{info.calls} calls</span>
                        </div>
                        <div className="text-right">
                          <span className="text-gold-700">${info.costUSD.toFixed(4)}</span>
                          <span className="ml-2 text-xs text-ink-600">{(info.inputTokens + info.outputTokens + info.thinkingTokens).toLocaleString()} tok</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Per-Module Breakdown */}
              {usage.byModule && Object.keys(usage.byModule).length > 0 && (
                <SectionCard title="Cost by Module" description="Token usage and spend per pipeline module" delay={0.3}>
                  <div className="space-y-2">
                    {Object.entries(usage.byModule).map(([mod, info]: any) => (
                      <div key={mod} className="flex items-center justify-between border-b border-ink-800/50 py-2 text-sm">
                        <div>
                          <span className="text-ink-200">{mod}</span>
                          <span className="ml-2 text-xs text-ink-600">{info.calls} calls</span>
                        </div>
                        <div className="text-right">
                          <span className="text-gold-700">${info.costUSD.toFixed(4)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}
          {!usage && (
            <SectionCard title="AI Usage & Costs" description="No usage data available">
              <p className="text-sm text-ink-600">{loadingUsage ? "Loading usage data..." : "No usage data available. Make some API calls to see metrics."}</p>
            </SectionCard>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
