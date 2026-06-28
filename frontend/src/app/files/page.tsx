"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export default function FilesPage() {
  const [path, setPath] = useState(".");
  const [entries, setEntries] = useState<any[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

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

  useEffect(() => { list("."); }, []);

  const openFile = async (name: string) => {
    const fullPath = path === "." ? name : `${path}/${name}`;
    setSelectedFile(fullPath);
    setSaveMsg("");
    try {
      const r = await api.readFile(fullPath);
      setFileContent(r.content || "");
    } catch (e: any) {
      setFileContent(`Error: ${e.message}`);
    }
  };

  const saveFile = async () => {
    if (!selectedFile || fileContent === null) return;
    setSaving(true);
    setSaveMsg("");
    try {
      await api.writeFile(selectedFile, fileContent);
      setSaveMsg("Saved successfully.");
    } catch (e: any) {
      setSaveMsg(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gold-400">File Manager</h1>
        <p className="text-sm text-ink-500">Browse and edit files on the server.</p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Directory browser */}
        <section className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">Browser</h2>
            <span className="font-mono text-xs text-gold-400">{path}</span>
            <button onClick={() => list(".")} className="ml-auto text-xs text-gold-400 hover:text-gold-300">Home</button>
          </div>
          {error && <p className="text-sm text-accent-crit">{error}</p>}
          <div className="space-y-1 text-sm">
            {entries.map((e, i) => (
              <button
                key={i}
                onClick={() => e.type === "dir" ? list(e.path || e.name) : openFile(e.name)}
                className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-ink-800"
              >
                <span>{e.type === "dir" ? "📁" : "📄"}</span>
                <span className="text-ink-200">{e.name}</span>
              </button>
            ))}
            {entries.length === 0 && <p className="text-ink-600">Empty directory</p>}
          </div>
        </section>

        {/* File viewer / editor */}
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-500">
              {selectedFile || "File Viewer"}
            </h2>
            {selectedFile && (
              <button
                onClick={saveFile}
                disabled={saving}
                className="rounded-md bg-gold-500 px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-gold-400 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            )}
          </div>
          {selectedFile ? (
            <textarea
              value={fileContent || ""}
              onChange={(e) => setFileContent(e.target.value)}
              className="h-96 w-full rounded-lg border border-ink-700 bg-ink-950/50 p-3 font-mono text-xs text-ink-300 focus:border-gold-500 focus:outline-none"
              spellCheck={false}
            />
          ) : (
            <p className="text-sm text-ink-600">Select a file to view or edit its content.</p>
          )}
          {saveMsg && <p className="mt-2 text-xs text-accent-ok">{saveMsg}</p>}
        </section>
      </div>
    </div>
  );
}
