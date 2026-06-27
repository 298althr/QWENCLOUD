export default function Placeholder({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gold-400">{title}</h1>
        <p className="text-sm text-ink-500">{blurb}</p>
      </header>
      <div className="card-glow p-6">
        <p className="text-sm text-ink-600">
          This section is wired in its corresponding build phase. See{" "}
          <code className="text-gold-400">
            docs/TRACK4-BUILD-PLAN.md
          </code>{" "}
          for the schedule.
        </p>
      </div>
    </div>
  );
}
