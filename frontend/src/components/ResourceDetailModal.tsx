"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Cpu, MemoryStick, HardDrive, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ResourceDetailModalProps {
  type: "cpu" | "ram" | "disk" | null;
  onClose: () => void;
}

export default function ResourceDetailModal({ type, onClose }: ResourceDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!type) return;
    setLoading(true);
    setError(null);
    const fn = type === "cpu" ? api.cpuDetail : type === "ram" ? api.ramDetail : api.diskDetail;
    fn()
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [type]);

  const open = type !== null;

  const titles: Record<string, string> = {
    cpu: "CPU Details - Top 10 Processes",
    ram: "RAM Details - Memory Breakdown",
    disk: "Disk Details - Storage Usage",
  };
  const icons: Record<string, React.ReactNode> = {
    cpu: <Cpu className="h-5 w-5" />,
    ram: <MemoryStick className="h-5 w-5" />,
    disk: <HardDrive className="h-5 w-5" />,
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-y-auto border border-ink-700 bg-ink-900 p-0 text-ink-200">
        <DialogHeader className="border-b border-ink-700/60 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-ink-100">
            {type && icons[type]}
            {type && titles[type]}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4">
          {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-ink-500" />
            <span className="ml-2 text-ink-400">Loading...</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-status-crit/30 bg-status-crit/5 p-4 text-sm text-status-crit">
            Error: {error}
          </div>
        )}

        {!loading && !error && type === "cpu" && data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-ink-800 p-3">
                <div className="text-xs text-ink-500 uppercase">Overall CPU</div>
                <div className="text-2xl font-mono text-ink-100 mt-1">{data.cpu_overall}%</div>
              </div>
              <div className="rounded-lg border border-ink-800 p-3">
                <div className="text-xs text-ink-500 uppercase">Cores</div>
                <div className="text-sm font-mono text-ink-300 mt-1">
                  {data.cpu_cores && data.cpu_cores.length > 0
                    ? data.cpu_cores.map((c: number, i: number) => (
                        <span key={i} className={cn("mr-2", c > 80 ? "text-status-crit" : c > 60 ? "text-status-warn" : "text-status-ok")}>
                          Core{i}: {c}%
                        </span>
                      ))
                    : "N/A"}
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-ink-200 mb-2">Top 10 CPU-Consuming Processes</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ink-500 text-xs uppercase border-b border-ink-800">
                    <th className="text-left py-2 pr-4">PID</th>
                    <th className="text-left py-2 pr-4">Name</th>
                    <th className="text-right py-2 pr-4">CPU %</th>
                    <th className="text-right py-2 pr-4">MEM %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_processes && data.top_processes.map((p: any) => (
                    <tr key={p.pid} className="border-b border-ink-800/50">
                      <td className="py-2 pr-4 font-mono text-ink-400">{p.pid}</td>
                      <td className="py-2 pr-4 text-ink-200 truncate max-w-[200px]">{p.name}</td>
                      <td className={cn("py-2 pr-4 text-right font-mono", p.cpu > 50 ? "text-status-warn" : "text-ink-300")}>{p.cpu}%</td>
                      <td className="py-2 pr-4 text-right font-mono text-ink-400">{p.mem}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && type === "ram" && data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-ink-800 p-3">
                <div className="text-xs text-ink-500 uppercase">Total</div>
                <div className="text-xl font-mono text-ink-100 mt-1">{data.total_mb} MB</div>
              </div>
              <div className="rounded-lg border border-ink-800 p-3">
                <div className="text-xs text-ink-500 uppercase">Used</div>
                <div className="text-xl font-mono text-status-warn mt-1">{data.used_mb} MB</div>
                <div className="text-xs text-ink-500">{data.used_percent}%</div>
              </div>
              <div className="rounded-lg border border-ink-800 p-3">
                <div className="text-xs text-ink-500 uppercase">Available</div>
                <div className="text-xl font-mono text-status-ok mt-1">{data.available_mb} MB</div>
                <div className="text-xs text-ink-500">{data.available_percent}%</div>
              </div>
              <div className="rounded-lg border border-ink-800 p-3">
                <div className="text-xs text-ink-500 uppercase">Buff/Cache</div>
                <div className="text-xl font-mono text-ink-300 mt-1">{data.buff_cache_mb} MB</div>
              </div>
            </div>
            {(data.swap_total_mb > 0) && (
              <div className="rounded-lg border border-ink-800 p-3 text-sm">
                <span className="text-ink-500">Swap: </span>
                <span className="font-mono text-ink-300">{data.swap_used_mb} / {data.swap_total_mb} MB</span>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-ink-200 mb-2">Top 20 Memory-Consuming Processes</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ink-500 text-xs uppercase border-b border-ink-800">
                    <th className="text-left py-2 pr-4">PID</th>
                    <th className="text-left py-2 pr-4">Name</th>
                    <th className="text-right py-2 pr-4">MEM %</th>
                    <th className="text-right py-2 pr-4">MEM MB</th>
                    <th className="text-right py-2 pr-4">CPU %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_processes && data.top_processes.map((p: any) => (
                    <tr key={p.pid} className="border-b border-ink-800/50">
                      <td className="py-2 pr-4 font-mono text-ink-400">{p.pid}</td>
                      <td className="py-2 pr-4 text-ink-200 truncate max-w-[180px]">{p.name}</td>
                      <td className={cn("py-2 pr-4 text-right font-mono", p.mem_percent > 10 ? "text-status-warn" : "text-ink-300")}>{p.mem_percent}%</td>
                      <td className="py-2 pr-4 text-right font-mono text-ink-400">{p.mem_mb}</td>
                      <td className="py-2 pr-4 text-right font-mono text-ink-400">{p.cpu}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && !error && type === "disk" && data && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-ink-800 p-3">
                <div className="text-xs text-ink-500 uppercase">Total</div>
                <div className="text-xl font-mono text-ink-100 mt-1">{data.total_size_gb} GB</div>
              </div>
              <div className="rounded-lg border border-ink-800 p-3">
                <div className="text-xs text-ink-500 uppercase">Used</div>
                <div className="text-xl font-mono text-status-warn mt-1">{data.total_used_gb} GB</div>
              </div>
              <div className="rounded-lg border border-ink-800 p-3">
                <div className="text-xs text-ink-500 uppercase">Available</div>
                <div className="text-xl font-mono text-status-ok mt-1">{data.total_available_gb} GB</div>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-ink-200 mb-2">Mount Points</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ink-500 text-xs uppercase border-b border-ink-800">
                    <th className="text-left py-2 pr-4">Mount</th>
                    <th className="text-left py-2 pr-4">Filesystem</th>
                    <th className="text-right py-2 pr-4">Size</th>
                    <th className="text-right py-2 pr-4">Used</th>
                    <th className="text-right py-2 pr-4">Avail</th>
                    <th className="text-right py-2 pr-4">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mounts && data.mounts.map((m: any) => (
                    <tr key={m.mount} className="border-b border-ink-800/50">
                      <td className="py-2 pr-4 font-mono text-ink-300">{m.mount}</td>
                      <td className="py-2 pr-4 font-mono text-ink-400">{m.fs}</td>
                      <td className="py-2 pr-4 text-right font-mono text-ink-300">{m.size_gb} GB</td>
                      <td className="py-2 pr-4 text-right font-mono text-status-warn">{m.used_gb} GB</td>
                      <td className="py-2 pr-4 text-right font-mono text-status-ok">{m.available_gb} GB</td>
                      <td className={cn("py-2 pr-4 text-right font-mono", m.percent > 85 ? "text-status-crit" : m.percent > 70 ? "text-status-warn" : "text-ink-300")}>{m.percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  </Dialog>
);
}
