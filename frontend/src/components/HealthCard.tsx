"use client";

import { useEffect, useState } from "react";

type Props = {
  title: string;
  endpoint: string;
};

type HealthState = {
  status: "loading" | "ok" | "down";
  detail?: string;
};

export default function HealthCard({ title, endpoint }: Props) {
  const [state, setState] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        const ok =
          data.status === "ok" ||
          data.processes ||
          data.containers ||
          data.cpu !== undefined;
        setState({
          status: ok ? "ok" : "down",
          detail: ok ? "reachable" : "unexpected payload",
        });
      } catch (e) {
        if (cancelled) return;
        setState({ status: "down", detail: (e as Error).message });
      }
    }
    check();
    const id = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [endpoint]);

  const pill =
    state.status === "ok"
      ? "pill-ok"
      : state.status === "down"
      ? "pill-crit"
      : "pill-warn";

  const label =
    state.status === "ok"
      ? "Online"
      : state.status === "down"
      ? "Offline"
      : "Checking…";

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-ink-500">{title}</h3>
        <span className={pill}>{label}</span>
      </div>
      <div className="mt-3 font-mono text-xs text-ink-600">
        {endpoint}
        {state.detail ? ` · ${state.detail}` : ""}
      </div>
    </div>
  );
}
