import HealthCard from "@/components/HealthCard";

export default function HomePage() {
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
        <div className="card-glow lg:col-span-2 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
            Active Agent Sessions
          </h2>
          <p className="text-sm text-ink-600">
            Agent console wiring lands in Phase 2. The reasoning-chain stream
            (Qwen <code className="text-gold-400">reasoning_content</code>) will
            appear here live.
          </p>
        </div>
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">
            Pending Approvals
          </h2>
          <p className="text-sm text-ink-600">
            Human-in-the-loop approvals (Telegram + dashboard) appear here once
            the Certainty Pipeline is wired (Day 3).
          </p>
        </div>
      </section>
    </div>
  );
}
