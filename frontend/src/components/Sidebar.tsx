"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview", icon: "🏠" },
  { href: "/agent", label: "Agent Console", icon: "🤖" },
  { href: "/monitoring", label: "Monitoring", icon: "📊" },
  { href: "/deployments", label: "Deployments", icon: "🚀" },
  { href: "/files", label: "File Manager", icon: "📁" },
  { href: "/security", label: "Security", icon: "🔒" },
  { href: "/memory", label: "Memory & Learning", icon: "🧠" },
  { href: "/analytics", label: "Analytics", icon: "📈" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 h-screen w-60 shrink-0 border-r border-ink-800 bg-ink-900/70 backdrop-blur">
      <div className="flex h-16 items-center gap-2 border-b border-ink-800 px-5">
        <div className="h-8 w-8 rounded-md bg-gradient-to-br from-gold-400 to-gold-600 shadow-glow" />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide text-gold-400">
            ALTHR
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-500">
            Autopilot
          </div>
        </div>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${active ? "nav-link-active" : ""}`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-5 py-4 text-[10px] text-ink-600">
        Track 4 · Qwen Cloud · v0.1
      </div>
    </aside>
  );
}
