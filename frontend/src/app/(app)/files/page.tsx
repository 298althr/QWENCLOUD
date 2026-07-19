"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, SectionCard, PageLoader } from "@/components/design-system";
import {
  FolderOpen, FileText, Home, Save, FolderPlus, FilePlus,
  Copy, Scissors, ClipboardPaste, Trash2, Download, Upload,
  Edit3, ChevronRight, RefreshCw, X, Check, FlaskConical
} from "lucide-react";
import { toast } from "sonner";

const ROOT_PATH = "/var/althr-volumes/files";

type Entry = {
  name: string;
  type: string;
  size?: number;
};

type ClipboardItem = {
  path: string;
  name: string;
  isDir: boolean;
  mode: "copy" | "cut";
};

export default function FilesPage() {
  const [path, setPath] = useState(ROOT_PATH);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: Entry } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [sandboxActive, setSandboxActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const list = useCallback(async (p: string) => {
    setError("");
    setLoading(true);
    try {
      const r = await api.listFiles(p);
      setEntries(r.entries || []);
      setPath(p);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => { list(ROOT_PATH); }, [list]);

  useEffect(() => {
    api.getSandboxMode().then((data) => setSandboxActive(data.active)).catch(() => {});
    const interval = setInterval(() => {
      api.getSandboxMode().then((data) => setSandboxActive(data.active)).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Close context menu on click anywhere
  useEffect(() => {
    const handler = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handler);
      return () => document.removeEventListener("click", handler);
    }
  }, [contextMenu]);

  const openFile = async (name: string) => {
    const fullPath = `${path}/${name}`;
    setSelectedFile(fullPath);
    setRenaming(null);
    try {
      const r = await api.readFile(fullPath);
      setFileContent(r.content || "");
    } catch (e: any) {
      setFileContent(`Error: ${e.message}`);
    }
  };

  const navigateToDir = (name: string) => {
    setRenaming(null);
    list(`${path}/${name}`);
  };

  const navigateUp = () => {
    if (path === ROOT_PATH) return;
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    const parentPath = "/" + parts.join("/");
    list(parentPath || ROOT_PATH);
  };

  const navigateToBreadcrumb = (idx: number) => {
    const parts = path.split("/").filter(Boolean);
    const target = "/" + parts.slice(0, idx + 1).join("/");
    list(target || ROOT_PATH);
  };

  const breadcrumbs = path.split("/").filter(Boolean);

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

  const createFile = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const fullPath = `${path}/${newName.trim()}`;
      await api.writeFile(fullPath, "");
      toast.success(`Created ${newName.trim()}`);
      setNewName("");
      list(path);
    } catch (e: any) {
      toast.error(`Create file failed: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const createFolder = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const fullPath = `${path}/${newName.trim()}`;
      await api.mkdir(fullPath);
      toast.success(`Created folder ${newName.trim()}`);
      setNewName("");
      list(path);
    } catch (e: any) {
      toast.error(`Create folder failed: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const deleteEntry = async (name: string) => {
    const fullPath = `${path}/${name}`;
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.deleteFile(fullPath);
      toast.success(`Deleted ${name}`);
      list(path);
      if (selectedFile === fullPath) {
        setSelectedFile(null);
        setFileContent(null);
      }
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    }
  };

  const copyEntry = (name: string, isDir: boolean) => {
    const fullPath = `${path}/${name}`;
    setClipboard({ path: fullPath, name, isDir, mode: "copy" });
    toast.success(`Copied ${name}`);
  };

  const cutEntry = (name: string, isDir: boolean) => {
    const fullPath = `${path}/${name}`;
    setClipboard({ path: fullPath, name, isDir, mode: "cut" });
    toast.success(`Cut ${name}`);
  };

  const pasteEntry = async () => {
    if (!clipboard) return;
    const dest = `${path}/${clipboard.name}`;
    try {
      if (clipboard.mode === "copy") {
        await api.copyFile(clipboard.path, dest);
        toast.success(`Pasted (copied) ${clipboard.name}`);
      } else {
        await api.moveFile(clipboard.path, dest);
        toast.success(`Pasted (moved) ${clipboard.name}`);
        setClipboard(null);
      }
      list(path);
    } catch (e: any) {
      toast.error(`Paste failed: ${e.message}`);
    }
  };

  const startRename = (name: string) => {
    setRenaming(name);
    setRenameValue(name);
    setContextMenu(null);
  };

  const confirmRename = async () => {
    if (!renaming || !renameValue.trim()) return;
    const fullPath = `${path}/${renaming}`;
    try {
      await api.renameFile(fullPath, renameValue.trim());
      toast.success(`Renamed to ${renameValue.trim()}`);
      setRenaming(null);
      setRenameValue("");
      list(path);
    } catch (e: any) {
      toast.error(`Rename failed: ${e.message}`);
    }
  };

  const downloadEntry = (name: string) => {
    const fullPath = `${path}/${name}`;
    window.open(`${API_BASE}/file/download?path=${encodeURIComponent(fullPath)}`, "_blank");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        const content = await file.text();
        await api.uploadFile(path, file.name, content);
        toast.success(`Uploaded ${file.name}`);
      } catch (err: any) {
        toast.error(`Upload failed for ${file.name}: ${err.message}`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    list(path);
  };

  const handleContextMenu = (e: React.MouseEvent, entry: Entry) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const toggleSelect = (name: string) => {
    setSelectedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const formatSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (initialLoad) {
    return <PageLoader variant="list" title="Loading files..." />;
  }

  return (
    <div className="space-y-xl">
      <PageHeader
        title="Files"
        description="Browse, edit, copy, move, delete, upload, and download files on the server"
        badge={sandboxActive ? (
          <span className="flex items-center gap-1.5 rounded-full bg-status-warn/20 px-3 py-1 text-xs font-medium text-status-warn animate-pulse">
            <FlaskConical className="h-3 w-3" /> SANDBOX MODE
          </span>
        ) : undefined}
      />

      {sandboxActive && (
        <div className="flex items-center gap-3 rounded-lg border border-status-warn/30 bg-status-warn/5 px-4 py-2.5">
          <FlaskConical className="h-4 w-4 text-status-warn" />
          <span className="text-sm text-status-warn">File operations are routed to the isolated sandbox volume.</span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={async () => {
            try { await api.resetSandbox(); toast.success("Sandbox volume reset"); list(path); } catch (e: any) { toast.error(`Failed: ${e.message}`); }
          }}>
            <RefreshCw className="h-3 w-3" /> Reset Sandbox
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* File Browser */}
        <SectionCard
          title="Browser"
          description=""
          delay={0.1}
          headerActions={
            <div className="flex gap-1 items-center flex-wrap">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New name..."
                className="rounded border border-ink-700 bg-ink-950 px-2 py-1 text-xs text-ink-200 placeholder-ink-600 focus:border-gold-500 focus:outline-none w-28"
                onKeyDown={(e) => { if (e.key === "Enter") createFile(); }}
              />
              <Button variant="ghost" size="sm" onClick={createFile} disabled={creating || !newName.trim()} title="New file">
                <FilePlus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={createFolder} disabled={creating || !newName.trim()} title="New folder">
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} title="Upload file">
                <Upload className="h-3.5 w-3.5" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleUpload}
              />
              {clipboard && (
                <Button variant="ghost" size="sm" onClick={pasteEntry} title={`Paste ${clipboard.name}`}>
                  <ClipboardPaste className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => list(path)} title="Refresh">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={navigateUp} disabled={path === ROOT_PATH} title="Go up">
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => list(ROOT_PATH)} title="Go to root">
                <Home className="h-3.5 w-3.5" />
              </Button>
            </div>
          }
        >
          {/* Breadcrumbs */}
          <div className="flex items-center gap-0.5 mb-3 text-xs text-ink-500 flex-wrap">
            {breadcrumbs.map((part, idx) => (
              <span key={idx} className="flex items-center gap-0.5">
                {idx > 0 && <ChevronRight className="h-3 w-3 text-ink-700" />}
                <button
                  onClick={() => navigateToBreadcrumb(idx)}
                  className="hover:text-gold-500 transition-colors"
                >
                  {part}
                </button>
              </span>
            ))}
          </div>

          {/* Clipboard indicator */}
          {clipboard && (
            <div className="mb-2 flex items-center gap-2 text-xs text-ink-400 bg-ink-900/50 rounded px-2 py-1">
              <span className="flex items-center gap-1">
                {clipboard.mode === "copy" ? <Copy className="h-3 w-3" /> : <Scissors className="h-3 w-3" />}
                {clipboard.mode === "copy" ? "Copied" : "Cut"}: {clipboard.name}
              </span>
              <button
                onClick={() => setClipboard(null)}
                className="ml-auto text-ink-600 hover:text-status-crit"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {error && <p className="text-sm text-status-crit mb-2">{error}</p>}

          <div className="space-y-0.5 max-h-[450px] overflow-y-auto">
            {entries.map((e, i) => {
              const isDir = e.type === "dir" || e.type === "directory";
              const isSelected = selectedEntries.has(e.name);
              const isRenaming = renaming === e.name;
              return (
                <div
                  key={i}
                  className={`group flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-ink-800 transition-colors cursor-pointer ${isSelected ? "bg-ink-800" : ""}`}
                  onClick={() => isDir ? navigateToDir(e.name) : openFile(e.name)}
                  onContextMenu={(ev) => handleContextMenu(ev, e)}
                >
                  {isDir ? (
                    <FolderOpen className="h-4 w-4 text-gold-700 shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-ink-500 shrink-0" />
                  )}
                  {isRenaming ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(ev) => setRenameValue(ev.target.value)}
                        onClick={(ev) => ev.stopPropagation()}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") confirmRename();
                          if (ev.key === "Escape") setRenaming(null);
                        }}
                        className="flex-1 rounded border border-gold-500 bg-ink-950 px-1.5 py-0.5 text-xs text-ink-200 focus:outline-none"
                        autoFocus
                      />
                      <button onClick={(ev) => { ev.stopPropagation(); confirmRename(); }} className="text-status-ok hover:text-status-ok">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={(ev) => { ev.stopPropagation(); setRenaming(null); }} className="text-status-crit">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-ink-200 flex-1 truncate">{e.name}</span>
                  )}
                  {!isRenaming && (
                    <span className="text-xs text-ink-600 shrink-0">{formatSize(e.size)}</span>
                  )}
                  {/* Action buttons (visible on hover) */}
                  {!isRenaming && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(ev) => { ev.stopPropagation(); copyEntry(e.name, isDir); }}
                        className="p-1 rounded hover:bg-ink-700 text-ink-400 hover:text-ink-100"
                        title="Copy"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); cutEntry(e.name, isDir); }}
                        className="p-1 rounded hover:bg-ink-700 text-ink-400 hover:text-ink-100"
                        title="Cut"
                      >
                        <Scissors className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); startRename(e.name); }}
                        className="p-1 rounded hover:bg-ink-700 text-ink-400 hover:text-ink-100"
                        title="Rename"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                      {!isDir && (
                        <button
                          onClick={(ev) => { ev.stopPropagation(); downloadEntry(e.name); }}
                          className="p-1 rounded hover:bg-ink-700 text-ink-400 hover:text-ink-100"
                          title="Download"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        onClick={(ev) => { ev.stopPropagation(); deleteEntry(e.name); }}
                        className="p-1 rounded hover:bg-ink-700 text-ink-400 hover:text-status-crit"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {entries.length === 0 && !loading && (
              <p className="text-sm text-ink-600 py-4 text-center">Empty directory</p>
            )}
            {loading && (
              <p className="text-sm text-ink-600 py-4 text-center">Loading...</p>
            )}
          </div>
        </SectionCard>

        {/* File Viewer / Editor */}
        <SectionCard
          title={selectedFile ? selectedFile.split("/").pop() || "File Viewer" : "File Viewer"}
          delay={0.15}
          headerActions={
            selectedFile && (
              <Button variant="outline" size="sm" onClick={saveFile} disabled={saving}>
                <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
              </Button>
            )
          }
        >
          {selectedFile ? (
            <Textarea
              value={fileContent || ""}
              onChange={(e) => setFileContent(e.target.value)}
              className="h-96 font-mono text-xs"
              spellCheck={false}
            />
          ) : (
            <p className="text-sm text-ink-600">Select a file to view or edit its content.</p>
          )}
        </SectionCard>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-ink-900 border border-ink-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              if (contextMenu.entry.type === "dir" || contextMenu.entry.type === "directory")
                navigateToDir(contextMenu.entry.name);
              else
                openFile(contextMenu.entry.name);
              setContextMenu(null);
            }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-800"
          >
            {contextMenu.entry.type === "dir" || contextMenu.entry.type === "directory" ? <FolderOpen className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            Open
          </button>
          <button
            onClick={() => { copyEntry(contextMenu.entry.name, contextMenu.entry.type === "dir" || contextMenu.entry.type === "directory"); setContextMenu(null); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-800"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          <button
            onClick={() => { cutEntry(contextMenu.entry.name, contextMenu.entry.type === "dir" || contextMenu.entry.type === "directory"); setContextMenu(null); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-800"
          >
            <Scissors className="h-3.5 w-3.5" /> Cut
          </button>
          <button
            onClick={() => { startRename(contextMenu.entry.name); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-800"
          >
            <Edit3 className="h-3.5 w-3.5" /> Rename
          </button>
          {contextMenu.entry.type !== "dir" && contextMenu.entry.type !== "directory" && (
            <button
              onClick={() => { downloadEntry(contextMenu.entry.name); setContextMenu(null); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-800"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          )}
          <div className="border-t border-ink-700 my-1" />
          <button
            onClick={() => { deleteEntry(contextMenu.entry.name); setContextMenu(null); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-status-crit hover:bg-ink-800"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
