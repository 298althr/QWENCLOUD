"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [model, setModel] = useState("qwen3.7-plus");
  const [monitorInterval, setMonitorInterval] = useState(30);

  const models = [
    { id: "qwen3.7-max", name: "Qwen 3.7 Max (complex diagnosis)" },
    { id: "qwen3.7-plus", name: "Qwen 3.7 Plus (balanced)" },
    { id: "qwen3.6-flash", name: "Qwen 3.6 Flash (fast checks)" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gold-400">Settings</h1>
        <p className="text-sm text-ink-500">Agent configuration and thresholds.</p>
      </header>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-500">Agent Configuration</h2>

        {/* Confidence threshold */}
        <div className="mb-6">
          <label className="text-sm text-ink-300">Auto-Execute Confidence Threshold: {confidenceThreshold}%</label>
          <p className="mb-2 text-xs text-ink-600">Actions with confidence above this threshold auto-execute. Below require human approval.</p>
          <input
            type="range"
            min="50"
            max="100"
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
            className="w-full accent-gold-500"
          />
        </div>

        {/* Model selection */}
        <div className="mb-6">
          <label className="text-sm text-ink-300">Qwen Model</label>
          <p className="mb-2 text-xs text-ink-600">Primary model for intent parsing and diagnosis.</p>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-200 focus:border-gold-500 focus:outline-none"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Monitor interval */}
        <div className="mb-6">
          <label className="text-sm text-ink-300">Monitoring Interval: {monitorInterval}s</label>
          <p className="mb-2 text-xs text-ink-600">How often the monitoring loop polls server health.</p>
          <input
            type="range"
            min="10"
            max="300"
            step="10"
            value={monitorInterval}
            onChange={(e) => setMonitorInterval(Number(e.target.value))}
            className="w-full accent-gold-500"
          />
        </div>

        <button className="rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 px-6 py-2.5 text-sm font-semibold text-ink-950 hover:from-gold-400 hover:to-gold-500 transition-all">
          Save Settings
        </button>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">API Keys</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-ink-600">DASHSCOPE_API_KEY</label>
            <input
              type="password"
              placeholder="sk-••••••••••••"
              disabled
              className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950/50 px-3 py-2 text-sm text-ink-500"
            />
          </div>
          <div>
            <label className="text-xs text-ink-600">TELEGRAM_BOT_TOKEN</label>
            <input
              type="password"
              placeholder="••••••••••••"
              disabled
              className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950/50 px-3 py-2 text-sm text-ink-500"
            />
          </div>
          <p className="text-xs text-ink-600">API keys are configured via environment variables (.env file).</p>
        </div>
      </section>
    </div>
  );
}
