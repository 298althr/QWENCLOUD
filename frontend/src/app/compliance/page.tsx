"use client";

import { useState } from "react";
import { PageHeader, SectionCard, StatusPill } from "@/components/design-system";
import { Shield, FileText, Lock, ScrollText, Database, Server, AlertTriangle, CheckCircle } from "lucide-react";

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState("overview");

  const policies = [
    {
      title: "Data Retention Policy",
      icon: Database,
      status: "implemented",
      description: "Audit logs are stored in PostgreSQL with immutable triggers. Logs are retained indefinitely for the hackathon. In production, a cron job would purge logs older than 90 days.",
      details: [
        "audit_log table has triggers preventing UPDATE and DELETE",
        "pending_approvals are retained until resolved",
        "terminal_logs are persisted in Postgres",
        "Memory layers M1-M7 are stored in Postgres with no automatic expiry",
      ],
    },
    {
      title: "Access Control",
      icon: Lock,
      status: "implemented",
      description: "API key authentication via x-api-key header. SAF enforces role-based access (admin, operator). All actions are attributed to a user or agent.",
      details: [
        "API key configured via ALTHR_API_KEY environment variable",
        "SAF L2 (Identity and Authority) checks user role on every action",
        "Public endpoints: /api/health, /api/deployments/webhook (GitHub only)",
        "WebSocket connections inherit API key auth from HTTP handshake",
      ],
    },
    {
      title: "Audit Trail",
      icon: ScrollText,
      status: "implemented",
      description: "Every agent action is logged with actor, target, reasoning, confidence, SAF result, and outcome. Logs are immutable.",
      details: [
        "audit() function called on every execute, block, and approve action",
        "SAF L5 (Immutable Logging) enforces audit trail",
        "Audit entries include: operation, actor, target, reasoning, confidence, safResult, result",
        "Terminal logs capture all AI and human commands with exit codes",
      ],
    },
    {
      title: "Command Whitelist",
      icon: Shield,
      status: "implemented",
      description: "SAF L4 enforces a command whitelist. Only approved commands can be executed. Forbidden patterns (rm -rf /, fork bombs, mkfs) are blocked regardless of whitelist.",
      details: [
        "Allowed commands: ls, ps, docker, git, systemctl, npm, node, kill, etc.",
        "Forbidden: rm -rf /, fork bombs, mkfs, dd to disk devices, shutdown, reboot",
        "Read-only tools (get_server_health, list_processes) are inherently allowed",
        "Whitelist is configurable in backend/src/config/allowed-commands.js",
      ],
    },
    {
      title: "Human-in-the-Loop Governance",
      icon: FileText,
      status: "implemented",
      description: "SAF L7 (Governance) requires human approval for high-risk or low-confidence actions. Pending approvals are stored in Postgres and displayed on the dashboard.",
      details: [
        "Actions with risk_level != 'low' or confidence < 0.85 require approval",
        "Approvals are persisted in pending_approvals table",
        "Dashboard shows pending approvals with plan, confidence, and risk level",
        "Human can approve or reject via WebSocket or REST API",
      ],
    },
    {
      title: "Secret Management",
      icon: Lock,
      status: "implemented",
      description: "Secrets are stored as environment variables on the ECS instance. They are never committed to GitHub. The .gitignore excludes .env files.",
      details: [
        ".env and .env.dev are in .gitignore",
        ".env.example has blank values only",
        "Real keys are set via SSH on the ECS instance",
        "Docker Compose reads from .env at runtime",
        "Frontend uses SecretField component with hide/reveal toggle",
      ],
    },
    {
      title: "Incident Response",
      icon: AlertTriangle,
      status: "partial",
      description: "The monitoring loop detects anomalies (CPU, RAM, disk, network) and triggers AI diagnosis. Remediation actions go through SAF. However, there is no formal escalation procedure.",
      details: [
        "Monitor detects CPU spikes (sustained 5 min), RAM pressure, disk pressure",
        "Network latency and error rate anomalies are detected",
        "AI diagnosis streams reasoning to dashboard via WebSocket",
        "Remediation goes through certainty pipeline and SAF",
        "Telegram notifications for critical anomalies",
        "Gap: No formal escalation matrix or on-call rotation",
      ],
    },
    {
      title: "Data Residency",
      icon: Server,
      status: "documented",
      description: "All data is stored on the Alibaba Cloud ECS instance in the region where it was provisioned. No data crosses international borders.",
      details: [
        "PostgreSQL: althr-postgres container on ECS",
        "Redis: althr-redis container on ECS",
        "File storage: althr_files volume on ECS disk",
        "No external data services (no S3, no managed DB)",
        "Qwen API calls send diagnostic text to DashScope (Alibaba Cloud)",
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance and Security"
        description="Regulatory protocols, security framework, and audit trail documentation"
        badge={<StatusPill variant="ok">SAF Active</StatusPill>}
      />

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "overview" ? "bg-gold-500/20 text-gold-400 border border-gold-500/30" : "bg-ink-900 text-ink-400 border border-ink-800"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("saf")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "saf" ? "bg-gold-500/20 text-gold-400 border border-gold-500/30" : "bg-ink-900 text-ink-400 border border-ink-800"
          }`}
        >
          7-Layer SAF
        </button>
        <button
          onClick={() => setActiveTab("policies")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "policies" ? "bg-gold-500/20 text-gold-400 border border-gold-500/30" : "bg-ink-900 text-ink-400 border border-ink-800"
          }`}
        >
          Policies
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          {policies.map((p, i) => {
            const Icon = p.icon;
            return (
              <SectionCard key={i} title={p.title} delay={i * 0.05}>
                <div className="flex items-start gap-3">
                  <Icon className="h-5 w-5 text-gold-500 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {p.status === "implemented" && <span className="text-xs px-2 py-0.5 rounded bg-status-ok/15 text-status-ok">Implemented</span>}
                      {p.status === "partial" && <span className="text-xs px-2 py-0.5 rounded bg-status-warn/15 text-status-warn">Partial</span>}
                      {p.status === "documented" && <span className="text-xs px-2 py-0.5 rounded bg-info/15 text-info">Documented</span>}
                    </div>
                    <p className="text-sm text-ink-400">{p.description}</p>
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}

      {activeTab === "saf" && (
        <SectionCard title="7-Layer Security by Architecture Framework (SAF)" description="Every agent action passes through all 7 layers before execution">
          <div className="space-y-3">
            {[
              { layer: "L1", name: "Asset Classification", desc: "Classifies target as critical, important, or non-critical. Critical assets block high-risk actions." },
              { layer: "L2", name: "Identity and Authority", desc: "Verifies user role is admin or operator. Blocks unauthorized users." },
              { layer: "L3", name: "Network Segmentation", desc: "Verifies execution is local to the managed server. No remote execution." },
              { layer: "L4", name: "Policy Enforcement", desc: "Checks command against whitelist. Forbidden patterns (rm -rf /, fork bombs) are blocked." },
              { layer: "L5", name: "Immutable Logging", desc: "Ensures action will be logged in immutable audit_log table." },
              { layer: "L6", name: "Containment", desc: "Verifies blast radius. High risk on critical or important assets is blocked." },
              { layer: "L7", name: "Governance", desc: "High risk or low confidence requires human approval. Creates pending approval in Postgres." },
            ].map((l) => (
              <div key={l.layer} className="flex items-start gap-3 rounded-lg border border-ink-800 bg-ink-950/30 p-3">
                <span className="text-xs font-mono font-bold text-gold-500 shrink-0 w-8">{l.layer}</span>
                <div>
                  <p className="text-sm font-medium text-ink-200">{l.name}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{l.desc}</p>
                </div>
                <CheckCircle className="h-4 w-4 text-status-ok shrink-0 ml-auto" />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {activeTab === "policies" && (
        <div className="space-y-4">
          {policies.map((p, i) => {
            const Icon = p.icon;
            return (
              <SectionCard key={i} title={p.title} delay={i * 0.05}>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 text-gold-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-ink-400">{p.description}</p>
                  </div>
                  <ul className="space-y-1 ml-8">
                    {p.details.map((d, j) => (
                      <li key={j} className="text-xs text-ink-500 flex items-start gap-2">
                        <span className="text-status-ok shrink-0">-</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
