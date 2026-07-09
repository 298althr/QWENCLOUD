"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader, SectionCard } from "@/components/design-system";
import { Search, BookOpen } from "lucide-react";
import { toast } from "sonner";

const LAYERS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7"];
const LAYER_NAMES: Record<string, string> = {
  M1: "Raw Events", M2: "Structured Data", M3: "Operational (SOPs)",
  M4: "Execution", M5: "Decision", M6: "Learning", M7: "Strategic",
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
    } catch (e: any) {
      toast.error(`Search failed: ${e.message}`);
    }
  };

  const loadLessons = async () => {
    try {
      const r = await api.lessons(20);
      setLessons(r.lessons || []);
    } catch {}
  };

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Memory"
        description="7 memory layers with semantic search via text-embedding-v4"
      />

      <div className="flex flex-wrap gap-2">
        {LAYERS.map((l) => (
          <Button key={l} variant={layer === l ? "default" : "outline"} size="sm" onClick={() => loadLayer(l)}>
            {l} · {LAYER_NAMES[l]}
          </Button>
        ))}
      </div>

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">{layer} Entries</TabsTrigger>
          <TabsTrigger value="search">Semantic Search</TabsTrigger>
          <TabsTrigger value="lessons">Learned Lessons</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="mt-4">
          <SectionCard title={`${layer} Recent Entries`} delay={0.1}>
            <div className="space-y-2">
              {entries.map((e, i) => (
                <div key={i} className="border-b border-ink-800/30 py-2 text-sm">
                  <div className="text-ink-300">
                    {e.improvement_note || e.description || e.action_detail || e.chosen_action || e.content || e.sop_name || JSON.stringify(e).slice(0, 80)}
                  </div>
                  <div className="mt-1 text-xs text-ink-600">{new Date(e.timestamp).toLocaleString()}</div>
                </div>
              ))}
              {entries.length === 0 && <p className="text-sm text-ink-600">No entries. Click a layer to load.</p>}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="search" className="mt-4">
          <SectionCard title="Semantic Search (M6/M7)" delay={0.1}>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="e.g. CPU problems, disk full, memory leak" className="flex-1" />
                <Button onClick={search}>Search</Button>
              </div>
              <div className="space-y-2">
                {searchResults.map((r, i) => (
                  <div key={i} className="border-b border-ink-800/30 py-2 text-sm">
                    <div className="text-ink-300">{r.content?.slice(0, 80)}</div>
                    <div className="mt-1 flex gap-3 text-xs">
                      <Badge variant="outline">{r.layer}</Badge>
                      <span className="text-ink-600">similarity: {(r.similarity * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
                {searchResults.length === 0 && <p className="text-sm text-ink-600">Search results appear here.</p>}
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="lessons" className="mt-4">
          <SectionCard
            title="Learned Lessons (M6)"
            delay={0.1}
            headerActions={<Button variant="outline" size="sm" onClick={loadLessons}>Load</Button>}
          >
            <div className="space-y-2">
              {lessons.map((l, i) => (
                <div key={i} className="border-b border-ink-800/30 py-2 text-sm">
                  <div className="text-ink-300">{l.improvement_note}</div>
                  <div className="mt-1 flex gap-2 text-xs">
                    <Badge variant="outline">{l.error_type || "—"}</Badge>
                    <span className="text-ink-600">count: {l.reinforcement_count}</span>
                  </div>
                </div>
              ))}
              {lessons.length === 0 && <p className="text-sm text-ink-600">Click Load to view learned lessons.</p>}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
