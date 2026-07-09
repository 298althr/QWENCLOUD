"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { KPICard } from "@/components/charts/KPICard";
import { AreaChart } from "@/components/charts/AreaChart";
import { PageHeader, SectionCard } from "@/components/design-system";
import { TrendingUp, BarChart3, Layers } from "lucide-react";

export default function AnalyticsPage() {
  const [dqTrend, setDqTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dqTrend(30).then((r) => {
      setDqTrend(r.scores || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const avgDQ = dqTrend.length > 0
    ? (dqTrend.reduce((sum, d) => sum + Number(d.dq_score), 0) / dqTrend.length).toFixed(1)
    : "—";

  const totalDecisions = dqTrend.reduce((sum, d) => sum + d.decision_count, 0);

  const chartData = dqTrend.map((d) => ({ time: d.date, value: Number(d.dq_score) }));

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Performance"
        description="Decision quality scores and agent performance metrics"
      />

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {loading ? (
          [1,2,3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)
        ) : (
          <>
            <KPICard label="Avg Decision Score (30d)" value={avgDQ} status="info" icon={<TrendingUp className="h-4 w-4" />} />
            <KPICard label="Data Points" value={dqTrend.length} status="info" icon={<BarChart3 className="h-4 w-4" />} />
            <KPICard label="Total Decisions" value={totalDecisions} status="info" icon={<Layers className="h-4 w-4" />} />
          </>
        )}
      </section>

      <SectionCard title="Decision Score Trend" description="Decision quality over the last 30 days" delay={0.1}>
        {loading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : dqTrend.length === 0 ? (
          <p className="text-sm text-ink-600">No decision data yet. Run agent actions to populate the trend.</p>
        ) : (
          <AreaChart data={chartData} color="#d4af5f" label="Decision Score" height={250} />
        )}
      </SectionCard>
    </div>
  );
}
