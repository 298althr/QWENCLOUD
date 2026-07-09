"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, SectionCard } from "@/components/design-system";
import { FolderOpen, FileText, Home, Save } from "lucide-react";
import { toast } from "sonner";

export default function FilesPage() {
  const [path, setPath] = useState("/var/althr-volumes/files");
  const [entries, setEntries] = useState<any[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const list = async (p: string) => {
    setError("");
    try {
      const r = await api.listFiles(p);
      setEntries(r.entries || []);
      setPath(p);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { list("/var/althr-volumes/files"); }, []);

  const openFile = async (name: string) => {
    const fullPath = `${path}/${name}`;
    setSelectedFile(fullPath);
    try {
      const r = await api.readFile(fullPath);
      setFileContent(r.content || "");
    } catch (e: any) {
      setFileContent(`Error: ${e.message}`);
    }
  };

  const navigateToDir = (name: string) => {
    list(`${path}/${name}`);
  };

  const navigateUp = () => {
    if (path === "/var/althr-volumes/files") return;
    const parentPath = path.split("/").filter(Boolean).slice(0, -1).join("/") || "var/althr-volumes/files";
    list("/" + parentPath);
  };

  const saveFile = async () => {
    if (!selectedFile || fileContent === null) return;
    setSaving(true);
    try {
      await api.writeFile(selectedFile, fileContent);
      toast.success(`Saved ${selectedFile}`);
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Files"
        description="Browse and edit files on the server"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Browser"
          description={path}
          delay={0.1}
          headerActions={
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={navigateUp} disabled={path === "/var/althr-volumes/files"} title="Go up">
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => list("/var/althr-volumes/files")} title="Go to root">
                <Home className="h-3.5 w-3.5" />
              </Button>
            </div>
          }
        >
          {error && <p className="text-sm text-status-crit mb-2">{error}</p>}
          <div className="space-y-1">
            {entries.map((e, i) => (
              <button
                key={i}
                onClick={() => e.type === "dir" ? navigateToDir(e.name) : openFile(e.name)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-ink-800 transition-colors"
              >
                {e.type === "dir" ? <FolderOpen className="h-4 w-4 text-gold-500" /> : <FileText className="h-4 w-4 text-ink-500" />}
                <span className="text-ink-200">{e.name}</span>
              </button>
            ))}
            {entries.length === 0 && <p className="text-sm text-ink-600">Empty directory</p>}
          </div>
        </SectionCard>

        <SectionCard
          title={selectedFile || "File Viewer"}
          delay={0.15}
          headerActions={
            selectedFile && (
              <Button variant="outline" size="sm" onClick={saveFile} disabled={saving}>
                <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
              </Button>
            )
          }
        >
          {selectedFile ? (
            <Textarea value={fileContent || ""} onChange={(e) => setFileContent(e.target.value)} className="h-96 font-mono text-xs" spellCheck={false} />
          ) : (
            <p className="text-sm text-ink-600">Select a file to view or edit its content.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
