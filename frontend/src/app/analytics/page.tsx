"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gold-400">Analytics</h1>
        <p className="text-sm text-ink-500">Decision Quality (DQ) scores and agent performance metrics.</p>
      </header>

      {/* Summary cards */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <h3 className="text-sm font-medium text-ink-500">Avg DQ Score (30d)</h3>
          <div className="mt-2 text-3xl font-bold text-gold-400">{avgDQ}</div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-medium text-ink-500">Data Points</h3>
          <div className="mt-2 text-3xl font-bold text-gold-400">{dqTrend.length}</div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-medium text-ink-500">Total Decisions</h3>
          <div className="mt-2 text-3xl font-bold text-gold-400">
            {dqTrend.reduce((sum, d) => sum + d.decision_count, 0)}
          </div>
        </div>
      </section>

      {/* DQ trend chart */}
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-500">DQ Score Trend</h2>
        {loading ? (
          <p className="text-sm text-ink-600">Loading…</p>
        ) : dqTrend.length === 0 ? (
          <p className="text-sm text-ink-600">No DQ data yet. Run agent actions to populate the trend.</p>
        ) : (
          <div className="space-y-2">
            {dqTrend.map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-24 text-xs text-ink-600">{d.date}</span>
                <div className="flex-1 h-6 overflow-hidden rounded bg-ink-800">
                  <div
                    className="h-full bg-gradient-to-r from-gold-500 to-gold-600 transition-all"
                    style={{ width: `${Math.min(Number(d.dq_score), 100)}%` }}
                  />
                </div>
                <span className="w-12 text-right text-xs text-gold-400">{d.dq_score}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
