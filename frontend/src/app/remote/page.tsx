"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Server, Terminal, FolderOpen, FileText, Container, Cpu, Network, Home, Save, Play, RefreshCw, Power, Square, RotateCw, ScrollText, Eye } from "lucide-react";
import { toast } from "sonner";

interface RemoteHost {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
}

export default function RemotePage() {
  const [hosts, setHosts] = useState<RemoteHost[]>([]);
  const [selectedHost, setSelectedHost] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Host creation
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newHost, setNewHost] = useState({ id: "", name: "", host: "", port: 22, user: "", privateKey: "" });

  // Terminal
  const [command, setCommand] = useState("");
  const [commandOutput, setCommandOutput] = useState<string | null>(null);

  // Files
  const [filePath, setFilePath] = useState(".");
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Docker
  const [containers, setContainers] = useState<any[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<any | null>(null);
  const [containerLogs, setContainerLogs] = useState<string | null>(null);
  const [containerInspect, setContainerInspect] = useState<any | null>(null);
  const [containerAction, setContainerAction] = useState<"start" | "stop" | "restart" | null>(null);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [inspectDialogOpen, setInspectDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // Processes
  const [processes, setProcesses] = useState<any[]>([]);

  // Ports
  const [ports, setPorts] = useState<any[]>([]);

  const [error, setError] = useState("");

  useEffect(() => {
    loadHosts();
  }, []);

  useEffect(() => {
    if (selectedHost) {
      loadFiles(".");
      loadContainers();
      loadProcesses();
      loadPorts();
    }
  }, [selectedHost]);

  async function loadHosts() {
    try {
      const r = await api.remoteHosts();
      const list = (r.hosts || []) as RemoteHost[];
      setHosts(list);
      if (list.length > 0 && !selectedHost) {
        setSelectedHost(list[0].id);
      }
      setError("");
    } catch (e: any) {
      setError(e.message);
      setHosts([]);
    }
  }

  async function createHost() {
    if (!newHost.id || !newHost.name || !newHost.host || !newHost.user) {
      toast.error("ID, name, host, and user are required");
      return;
    }
    setLoading(true);
    try {
      await api.createRemoteHost(newHost);
      toast.success(`Host ${newHost.name} created`);
      setCreateDialogOpen(false);
      setNewHost({ id: "", name: "", host: "", port: 22, user: "", privateKey: "" });
      await loadHosts();
    } catch (e: any) {
      toast.error(`Failed to create host: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteHost(id: string) {
    if (!confirm("Are you sure you want to delete this host?")) return;
    setLoading(true);
    try {
      await api.deleteRemoteHost(id);
      toast.success(`Host deleted`);
      if (selectedHost === id) setSelectedHost("");
      await loadHosts();
    } catch (e: any) {
      toast.error(`Failed to delete host: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function assertHost(): string {
    if (!selectedHost) {
      toast.error("Select a remote host first");
      throw new Error("no host selected");
    }
    return selectedHost;
  }

  async function runCommand() {
    const hostId = assertHost();
    if (!command.trim()) return;
    setLoading(true);
    setCommandOutput(null);
    try {
      const r = await api.remoteCommand(hostId, command.trim());
      setCommandOutput(
        `exit code: ${r.exit_code}\ntime: ${r.time_ms}ms\n\n${r.stdout || ""}${r.stderr ? "\n--- stderr ---\n" + r.stderr : ""}`
      );
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadFiles(path: string) {
    const hostId = assertHost();
    setError("");
    try {
      const r = await api.remoteListFiles(hostId, path);
      setEntries(r.entries || []);
      setFilePath(r.path || path);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function openFile(name: string) {
    const hostId = assertHost();
    const fullPath = filePath === "." ? name : `${filePath}/${name}`;
    setSelectedFile(fullPath);
    try {
      const r = await api.remoteReadFile(hostId, fullPath);
      setFileContent(r.content || "");
    } catch (e: any) {
      setFileContent(`Error: ${e.message}`);
    }
  }

  async function saveFile() {
    const hostId = assertHost();
    if (!selectedFile || fileContent === null) return;
    setSaving(true);
    try {
      await api.remoteWriteFile(hostId, selectedFile, fileContent);
      toast.success(`Saved ${selectedFile}`);
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function loadContainers() {
    const hostId = assertHost();
    try {
      const r = await api.remoteContainers(hostId);
      setContainers(r.containers || []);
    } catch (e: any) {
      setContainers([]);
    }
  }

  async function loadContainerLogs(c: any) {
    const hostId = assertHost();
    setSelectedContainer(c);
    setContainerLogs(null);
    setLogDialogOpen(true);
    try {
      const r = await api.remoteContainerLogs(hostId, c.id || c.name);
      setContainerLogs(r.stdout || r.stderr || "No logs");
    } catch (e: any) {
      setContainerLogs(`Error: ${e.message}`);
    }
  }

  async function loadContainerInspect(c: any) {
    const hostId = assertHost();
    setSelectedContainer(c);
    setContainerInspect(null);
    setInspectDialogOpen(true);
    try {
      const r = await api.remoteContainerInspect(hostId, c.id || c.name);
      setContainerInspect(r.data || r);
    } catch (e: any) {
      setContainerInspect({ error: e.message });
    }
  }

  function confirmAction(c: any, action: "start" | "stop" | "restart") {
    setSelectedContainer(c);
    setContainerAction(action);
    setConfirmDialogOpen(true);
  }

  async function runContainerAction() {
    if (!selectedContainer || !containerAction) return;
    const hostId = assertHost();
    const id = selectedContainer.id || selectedContainer.name;
    setLoading(true);
    try {
      let r;
      if (containerAction === "start") r = await api.remoteContainerStart(hostId, id);
      else if (containerAction === "stop") r = await api.remoteContainerStop(hostId, id);
      else r = await api.remoteContainerRestart(hostId, id);
      if (r.ok) toast.success(`${containerAction} ${id}`);
      else toast.error(`${containerAction} failed: ${r.stderr || r.error}`);
      await loadContainers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
      setConfirmDialogOpen(false);
      setContainerAction(null);
    }
  }

  async function loadProcesses() {
    const hostId = assertHost();
    try {
      const r = await api.remoteProcesses(hostId);
      setProcesses(r.processes || []);
    } catch (e: any) {
      setProcesses([]);
    }
  }

  async function loadPorts() {
    const hostId = assertHost();
    try {
      const r = await api.remotePorts(hostId);
      setPorts(r.ports || []);
    } catch (e: any) {
      setPorts([]);
    }
  }

  const selectedHostInfo = hosts.find((h) => h.id === selectedHost);

  const processColumns: Column<any>[] = [
    { key: "pid", header: "PID", render: (r) => <span className="font-mono text-ink-400">{r.pid}</span> },
    { key: "name", header: "Name" },
    {
      key: "cpu",
      header: "CPU %",
      render: (r) => <span className={r.cpu > 50 ? "text-status-warn" : "text-ink-300"}>{typeof r.cpu === "number" ? r.cpu.toFixed(1) : "—"}</span>,
    },
    {
      key: "mem",
      header: "MEM %",
      render: (r) => <span className={r.mem > 50 ? "text-status-warn" : "text-ink-300"}>{typeof r.mem === "number" ? r.mem.toFixed(1) : "—"}</span>,
    },
  ];

  const portColumns: Column<any>[] = [
    {
      key: "port",
      header: "Port",
      render: (r) => <span className="font-mono text-gold-400">{r.port}</span>,
    },
    { key: "process", header: "Process", render: (r) => r.process || "—" },
    { key: "protocol", header: "Protocol", render: (r) => r.protocol || "tcp" },
    { key: "localAddress", header: "Local", render: (r) => <span className="font-mono text-xs">{r.localAddress}</span> },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Server className="h-6 w-6 text-gold-400" />
          <div>
            <h1 className="text-xl font-semibold text-gold-400">Remote Servers</h1>
            <p className="text-sm text-ink-500">SSH into managed servers and control containers, files, and processes.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedHost} onValueChange={setSelectedHost}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select host" />
            </SelectTrigger>
            <SelectContent>
              {hosts.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name} ({h.host})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Server className="mr-2 h-3.5 w-3.5" /> Add Host
          </Button>
          <Button variant="outline" size="icon" onClick={loadHosts} title="Refresh hosts">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {selectedHostInfo && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-400">
          <Badge variant="outline">{selectedHostInfo.user}@{selectedHostInfo.host}:{selectedHostInfo.port}</Badge>
          <span className="text-ink-600">Connected via SSH key</span>
        </div>
      )}

      {error && <p className="text-sm text-status-crit">{error}</p>}

      {hosts.length === 0 && !error && (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-ink-500">
              No remote servers configured. Add a server to <code>REMOTE_HOSTS</code> in your environment and restart the backend.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedHost && (
        <Tabs defaultValue="terminal">
          <TabsList>
            <TabsTrigger value="terminal"><Terminal className="mr-2 h-4 w-4" /> Terminal</TabsTrigger>
            <TabsTrigger value="files"><FolderOpen className="mr-2 h-4 w-4" /> Files</TabsTrigger>
            <TabsTrigger value="docker"><Container className="mr-2 h-4 w-4" /> Docker</TabsTrigger>
            <TabsTrigger value="processes"><Cpu className="mr-2 h-4 w-4" /> Processes</TabsTrigger>
            <TabsTrigger value="ports"><Network className="mr-2 h-4 w-4" /> Ports</TabsTrigger>
          </TabsList>

          <TabsContent value="terminal" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Remote Terminal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="Enter command (e.g. docker ps, systemctl status nginx)"
                    onKeyDown={(e) => e.key === "Enter" && runCommand()}
                    className="font-mono"
                  />
                  <Button onClick={runCommand} disabled={loading}>
                    {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                    Run
                  </Button>
                </div>
                {commandOutput !== null && (
                  <pre className="max-h-96 overflow-auto rounded bg-ink-950 p-3 font-mono text-xs text-ink-300">{commandOutput}</pre>
                )}
                {!commandOutput && <p className="text-sm text-ink-600">Run a whitelisted command on the selected host. Subject to SAF.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle>Browser</CardTitle>
                    <span className="font-mono text-xs text-gold-400">{filePath}</span>
                    <Button variant="ghost" size="sm" className="ml-auto" onClick={() => loadFiles(".")}>
                      <Home className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {entries.map((e, i) => (
                      <button
                        key={i}
                        onClick={() => (e.type === "directory" ? loadFiles(e.path) : openFile(e.name))}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-ink-800 transition-colors"
                      >
                        {e.type === "directory" ? (
                          <FolderOpen className="h-4 w-4 text-gold-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-ink-500" />
                        )}
                        <span className="text-ink-200">{e.name}</span>
                        {e.type === "file" && e.size > 0 && (
                          <span className="ml-auto text-xs text-ink-600">{e.size} B</span>
                        )}
                      </button>
                    ))}
                    {entries.length === 0 && <p className="text-sm text-ink-600">Empty directory</p>}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{selectedFile || "File Viewer"}</CardTitle>
                    {selectedFile && (
                      <Button variant="outline" size="sm" onClick={saveFile} disabled={saving}>
                        <Save className="mr-2 h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="docker" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Docker Containers</CardTitle>
                  <Button variant="outline" size="sm" onClick={loadContainers}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {containers.length === 0 && <p className="text-sm text-ink-600">No containers running</p>}
                  {containers.map((c, i) => (
                    <Card key={i} className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-gold-400">{c.name || c.id?.slice(0, 12)}</span>
                        <Badge variant={c.status?.includes("Up") ? "success" : "critical"}>{c.status || "unknown"}</Badge>
                      </div>
                      {c.image && <p className="mt-2 text-xs text-ink-600">{c.image}</p>}
                      {c.ports && <p className="mt-1 font-mono text-xs text-ink-500">{c.ports}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => loadContainerLogs(c)}>
                          <ScrollText className="mr-1 h-3.5 w-3.5" /> Logs
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => loadContainerInspect(c)}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> Inspect
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => confirmAction(c, "start")} disabled={c.status?.includes("Up")}>
                          <Power className="mr-1 h-3.5 w-3.5" /> Start
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => confirmAction(c, "stop")} disabled={!c.status?.includes("Up")}>
                          <Square className="mr-1 h-3.5 w-3.5" /> Stop
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => confirmAction(c, "restart")}>
                          <RotateCw className="mr-1 h-3.5 w-3.5" /> Restart
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="processes" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Top Processes</CardTitle>
                  <Button variant="outline" size="sm" onClick={loadProcesses}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={processColumns}
                  data={processes}
                  searchable
                  searchKeys={["name", "pid"]}
                  pageSize={15}
                  emptyMessage="No process data"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ports" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Listening Ports</CardTitle>
                  <Button variant="outline" size="sm" onClick={loadPorts}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable columns={portColumns} data={ports} pageSize={15} emptyMessage="No port data" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Logs: {selectedContainer?.name || selectedContainer?.id?.slice(0, 12)}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded bg-ink-950 p-3 font-mono text-xs text-ink-300">
            {containerLogs ?? "Loading..."}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={inspectDialogOpen} onOpenChange={setInspectDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Inspect: {selectedContainer?.name || selectedContainer?.id?.slice(0, 12)}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded bg-ink-950 p-3 font-mono text-xs text-ink-300">
            {containerInspect ? JSON.stringify(containerInspect, null, 2) : "Loading..."}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{containerAction} container?</DialogTitle>
            <DialogDescription>
              This will {containerAction} <span className="font-mono text-gold-400">{selectedContainer?.name || selectedContainer?.id?.slice(0, 12)}</span> on the production host.
              This action is audited and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
            <Button onClick={runContainerAction} disabled={loading}>
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm {containerAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Remote Host</DialogTitle>
            <DialogDescription>
              Configure a new SSH host for remote management. The private key will be stored securely in the database.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Host ID</label>
                <Input
                  placeholder="e.g., homelab-01"
                  value={newHost.id}
                  onChange={(e) => setNewHost({ ...newHost, id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name</label>
                <Input
                  placeholder="e.g., Home Lab Server"
                  value={newHost.name}
                  onChange={(e) => setNewHost({ ...newHost, name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Hostname/IP</label>
              <Input
                placeholder="e.g., 192.168.1.50"
                value={newHost.host}
                onChange={(e) => setNewHost({ ...newHost, host: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">SSH Port</label>
                <Input
                  type="number"
                  placeholder="22"
                  value={newHost.port}
                  onChange={(e) => setNewHost({ ...newHost, port: parseInt(e.target.value) || 22 })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">SSH User</label>
                <Input
                  placeholder="e.g., althr-agent"
                  value={newHost.user}
                  onChange={(e) => setNewHost({ ...newHost, user: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Private Key (Optional)</label>
              <Textarea
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                value={newHost.privateKey}
                onChange={(e) => setNewHost({ ...newHost, privateKey: e.target.value })}
                className="font-mono text-xs"
                rows={6}
              />
              <p className="text-xs text-ink-500">
                Leave empty to use environment variable configuration. The key will be stored encrypted in the database.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={createHost} disabled={loading}>
              {loading ? "Creating..." : "Add Host"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
