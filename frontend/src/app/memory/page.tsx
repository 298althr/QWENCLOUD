"use client";

import { useState } from "react";
import { api } from "@/lib/api";

const LAYERS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7"];
const LAYER_NAMES: Record<string, string> = {
  M1: "Raw Events",
  M2: "Structured Data",
  M3: "Operational (SOPs)",
  M4: "Execution",
  M5: "Decision",
  M6: "Learning",
  M7: "Strategic",
};

export default function MemoryPage() {
  const [layer, setLayer] = useState("M6");
  const [entries, setEntries] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);

  const loadLayer = async (l: string) => {
    setLayer(l);
    try {
      const r = await api.memory(l, 20);
      setEntries(r.rows || []);
    } catch {}
  };

  const search = async () => {
    if (!searchQuery.trim()) return;
    try {
      const r = await api.searchMemory(searchQuery, "M6,M7", 10);
      setSearchResults(r.results || []);
    } catch {}
  };

  const loadLessons = async () => {
    try {
      const r = await api.lessons(20);
      setLessons(r.lessons || []);
    } catch {}
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gold-400">Memory & Learning</h1>
        <p className="text-sm text-ink-500">7-layer PML (Performance Memory Layer) with semantic search via text-embedding-v4.</p>
      </header>

      {/* Layer selector */}
      <section className="flex flex-wrap gap-2">
        {LAYERS.map((l) => (
          <button
            key={l}
            onClick={() => loadLayer(l)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              layer === l ? "bg-gold-500 text-ink-950" : "bg-ink-800 text-ink-400 hover:bg-ink-700"
            }`}
          >
            {l} · {LAYER_NAMES[l]}
          </button>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Layer entries */}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">{layer} Recent Entries</h2>
          <div className="space-y-2 text-xs">
            {entries.map((e, i) => (
              <div key={i} className="border-b border-ink-800/30 py-2">
                <div className="text-ink-300">
                  {e.improvement_note || e.description || e.action_detail || e.chosen_action || e.content || e.sop_name || JSON.stringify(e).slice(0, 80)}
                </div>
                <div className="mt-1 text-ink-600">{new Date(e.timestamp).toLocaleString()}</div>
              </div>
            ))}
            {entries.length === 0 && <p className="text-ink-600">No entries. Click a layer to load.</p>}
          </div>
        </section>

        {/* Semantic search */}
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-500">Semantic Search (M6/M7)</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="e.g. CPU problems, disk full, memory leak"
              className="flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-ink-200 placeholder-ink-600 focus:border-gold-500 focus:outline-none"
            />
            <button onClick={search} className="rounded-lg bg-gold-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-gold-400">Search</button>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            {searchResults.map((r, i) => (
              <div key={i} className="border-b border-ink-800/30 py-2">
                <div className="text-ink-300">{r.content?.slice(0, 80)}</div>
                <div className="mt-1 flex gap-3 text-ink-600">
                  <span>layer={r.layer}</span>
                  <span>similarity={(r.similarity * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
            {searchResults.length === 0 && <p className="text-ink-600">Search results appear here.</p>}
          </div>
        </section>
      </div>

      {/* Learned lessons */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Learned Lessons (M6)</h2>
          <button onClick={loadLessons} className="text-xs text-gold-400 hover:text-gold-300">Load</button>
        </div>
        <div className="space-y-2 text-xs">
          {lessons.map((l, i) => (
            <div key={i} className="border-b border-ink-800/30 py-2">
              <div className="text-ink-300">{l.improvement_note}</div>
              <div className="mt-1 flex gap-3 text-ink-600">
                <span>type={l.error_type || "—"}</span>
                <span>count={l.reinforcement_count}</span>
              </div>
            </div>
          ))}
          {lessons.length === 0 && <p className="text-ink-600">Click Load to view learned lessons.</p>}
        </div>
      </section>
    </div>
  );
}
