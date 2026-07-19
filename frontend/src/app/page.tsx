"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Bot,
  ShieldCheck,
  Brain,
  Activity,
  Server,
  Lock,
  GitBranch,
  Terminal,
  CheckCircle2,
  Zap,
  Eye,
  Cpu,
  Network,
  ClipboardCheck,
  Rocket,
  Mail,
  Power,
} from "lucide-react";

type TabId = "overview" | "architecture" | "ai-engine" | "safety" | "demo" | "about";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "architecture", label: "Architecture" },
  { id: "ai-engine", label: "AI Engine" },
  { id: "safety", label: "Safety" },
  { id: "demo", label: "Demo" },
  { id: "about", label: "About" },
];

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="min-h-screen bg-ink-950">
      {/* Top nav bar */}
      <header className="sticky top-0 z-50 border-b border-ink-700/40 bg-ink-900/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-glow" />
            <div className="leading-tight">
              <div className="text-base font-semibold text-ink-100">ALTHR Autopilot</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-ink-500">Track 4 / Qwen Cloud</div>
            </div>
          </div>
          <Link href="/dashboard">
            <Button size="md" className="btn-press">
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="sticky top-[73px] z-40 border-b border-ink-700/40 bg-ink-900/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6 py-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-micro ${
                activeTab === tab.id
                  ? "bg-gold-500/15 text-gold-300"
                  : "text-ink-400 hover:bg-ink-800 hover:text-ink-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab content */}
      <main className="mx-auto max-w-6xl px-6 py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "architecture" && <ArchitectureTab />}
            {activeTab === "ai-engine" && <AIEngineTab />}
            {activeTab === "safety" && <SafetyTab />}
            {activeTab === "demo" && <DemoTab />}
            {activeTab === "about" && <AboutTab />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-ink-700/40 bg-ink-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600" />
            <span className="text-sm text-ink-500">ALTHR Autopilot / Track 4 / Global AI Hackathon Series with Qwen Cloud</span>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="btn-press">
              Open Dashboard
              <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </footer>
    </div>
  );
}

/* ---------- Overview Tab ---------- */

function OverviewTab() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-card border border-ink-700/40 bg-gradient-to-br from-ink-850 to-ink-900 p-8 md:p-12">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="relative z-10 max-w-3xl space-y-6">
          <Badge variant="success" className="text-xs">
            <CheckCircle2 className="h-3 w-3" /> Submission Ready
          </Badge>
          <h1 className="text-4xl font-bold leading-tight text-ink-100 md:text-5xl">
            An AI agent that runs your server operations on its own
          </h1>
          <p className="text-lg text-ink-400">
            ALTHR Autopilot watches your servers, figures out what is wrong when things break,
            and fixes problems without a human typing commands. It uses Qwen models from Alibaba
            Cloud to think through problems, check its own work, and take safe actions. You stay
            in control with approval queues, audit logs, and a kill switch.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard">
              <Button size="lg" className="btn-press">
                Try the Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/agent">
              <Button variant="outline" size="lg" className="btn-press">
                <Bot className="mr-2 h-4 w-4" />
                Talk to the AI
              </Button>
            </Link>
          </div>
        </div>
        {/* Hero illustration */}
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { icon: <Activity className="h-5 w-5" />, label: "Live Monitoring", value: "CPU / RAM / Disk / Net" },
            { icon: <Brain className="h-5 w-5" />, label: "AI Diagnosis", value: "Qwen-powered RCA" },
            { icon: <ShieldCheck className="h-5 w-5" />, label: "7-Layer Safety", value: "SAF Framework" },
            { icon: <ClipboardCheck className="h-5 w-5" />, label: "Human Approval", value: "HITL Queue" },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.25 }}
              className="card p-4"
            >
              <div className="mb-2 text-gold-400">{card.icon}</div>
              <div className="text-sm font-medium text-ink-100">{card.label}</div>
              <div className="text-xs text-ink-500">{card.value}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* What it does */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-ink-100">What the system does</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: <Eye className="h-5 w-5" />,
              title: "Watches your servers 24/7",
              body: "Collects CPU, memory, disk, and network metrics every few seconds. Spots anomalies like traffic spikes, memory leaks, and disk pressure before they become outages.",
            },
            {
              icon: <Brain className="h-5 w-5" />,
              title: "Diagnoses problems with AI",
              body: "When something looks wrong, the AI agent uses Qwen models to reason through the symptoms, gather evidence, and produce a root cause analysis with a confidence score.",
            },
            {
              icon: <Zap className="h-5 w-5" />,
              title: "Fixes issues on its own",
              body: "If the AI is confident enough, it runs the fix. If not, it asks a human to approve. Every action is logged, checked against safety rules, and can be rolled back.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.25 }}
              className="card p-6 space-y-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-500/15 text-gold-400">
                {item.icon}
              </div>
              <h3 className="text-base font-medium text-ink-100">{item.title}</h3>
              <p className="text-sm text-ink-400">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Why it stands out */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-ink-100">Why this submission stands out</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { num: "1", title: "Real autonomous action, not just alerts", body: "The agent does not just send notifications. It runs commands, restarts services, and fixes problems. You can watch it work in real time." },
            { num: "2", title: "7-layer safety framework (SAF)", body: "Every action passes through 7 independent checks: asset classification, identity, network segmentation, policy enforcement, immutable logging, containment, and governance." },
            { num: "3", title: "Decision intelligence pipeline", body: "Three separate AI modules (DRE, DREV, CRDS) debate each action before it runs. One proposes, one reviews, one can veto. This prevents bad decisions." },
            { num: "4", title: "Works with Qwen models on Alibaba Cloud", body: "Built specifically for the Qwen Cloud track. Uses qwen-turbo, qwen-plus, and qwen-max for different tasks based on cost and capability needs." },
            { num: "5", title: "Persistent memory across sessions", body: "The agent remembers past incidents, what fixed them, and what did not work. It gets smarter over time instead of starting fresh each time." },
            { num: "6", title: "Full web dashboard with live data", body: "Not a CLI demo. You get a real web UI with live charts, an AI chat console, terminal access, file browser, deployment manager, and audit logs." },
          ].map((item) => (
            <div key={item.num} className="card p-6 space-y-2">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-sm font-bold text-gold-300">
                  {item.num}
                </span>
                <div>
                  <h3 className="text-base font-medium text-ink-100">{item.title}</h3>
                  <p className="mt-1 text-sm text-ink-400">{item.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech stack */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-ink-100">Tech stack</h2>
        <div className="flex flex-wrap gap-2">
          {[
            "Next.js 14", "TypeScript", "Tailwind CSS", "Node.js", "Express",
            "Socket.io", "PostgreSQL", "Redis", "Docker", "Qwen Models",
            "Alibaba Cloud ECS", "Zod", "JWT", "Helmet", "Framer Motion",
          ].map((tech) => (
            <Badge key={tech} variant="outline" className="text-xs">
              {tech}
            </Badge>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------- Architecture Tab ---------- */

function ArchitectureTab() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-card border border-ink-700/40 bg-gradient-to-br from-ink-850 to-ink-900 p-8 md:p-12">
        <div className="absolute left-0 top-0 h-48 w-48 rounded-full bg-status-info/10 blur-3xl" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <Badge variant="info" className="text-xs">
            <Network className="h-3 w-3" /> System Design
          </Badge>
          <h1 className="text-3xl font-bold text-ink-100 md:text-4xl">
            How the pieces fit together
          </h1>
          <p className="text-base text-ink-400">
            The system has a Node.js backend that runs the AI pipeline, a PostgreSQL database
            for audit logs and memory, Redis for caching and pub/sub, and a Next.js frontend
            that talks to the backend over REST and WebSocket.
          </p>
        </div>
      </section>

      {/* Architecture diagram (SVG) */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink-100">Architecture diagram</h2>
        <div className="card p-6 overflow-x-auto">
          <ArchitectureDiagram />
        </div>
      </section>

      {/* Components */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-ink-100">Core components</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { icon: <Server className="h-5 w-5" />, title: "Backend (Node.js + Express)", body: "Runs the AI pipeline, REST API, WebSocket server, monitoring loop, and Telegram bot. Containerized with Docker." },
            { icon: <Brain className="h-5 w-5" />, title: "AI Pipeline (DRE / DREV / CRDS)", body: "Decision Reasoning Engine proposes actions. Decision Review Engine checks them. Cross-Reference Decision System can veto. Three independent AI passes per action." },
            { icon: <Activity className="h-5 w-5" />, title: "Monitoring Loop", body: "Collects system metrics every 30 seconds. Detects anomalies with threshold and pattern checks. Triggers the AI pipeline when something looks wrong." },
            { icon: <ShieldCheck className="h-5 w-5" />, title: "SAF (7-Layer Safety)", body: "Asset classification, identity check, network segmentation, policy enforcement, immutable logging, containment, and governance. Every action passes all 7 layers." },
            { icon: <Brain className="h-5 w-5" />, title: "PML (Persistent Memory)", body: "7-layer memory system: episodic, procedural, semantic, working, social, meta, and intent. The agent remembers past incidents and learns from them." },
            { icon: <Terminal className="h-5 w-5" />, title: "Tool Executor", body: "Runs shell commands, Docker operations, file edits, and service management. All commands are sandboxed and logged." },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.25 }}
              className="card p-5 space-y-2"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500/15 text-gold-400">
                  {item.icon}
                </div>
                <h3 className="text-sm font-medium text-ink-100">{item.title}</h3>
              </div>
              <p className="text-sm text-ink-400">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Data flow */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink-100">How a request flows through the system</h2>
        <div className="card p-6">
          <ol className="space-y-4">
            {[
              { step: "1", title: "User sends a message or anomaly is detected", body: "Either the user types a request in the AI Assistant, or the monitoring loop detects an anomaly (CPU spike, memory leak, etc.)." },
              { step: "2", title: "Intent parser classifies the request", body: "A Qwen model figures out what the user wants: run a command, diagnose an issue, deploy an app, or answer a question." },
              { step: "3", title: "DRE proposes candidate actions", body: "The Decision Reasoning Engine gathers context from memory, tools, and metrics. It proposes one or more actions with confidence scores." },
              { step: "4", title: "DREV reviews each action", body: "The Decision Review Engine checks the proposal for safety, correctness, and risk. It can reject or modify the action." },
              { step: "5", title: "CRDS casts a veto vote", body: "The Cross-Reference Decision System compares the action against historical data. If the action failed before, it can veto." },
              { step: "6", title: "SAF runs 7-layer check", body: "The action passes through all 7 safety layers. If any layer fails, the action is blocked." },
              { step: "7", title: "HITL approval (if needed)", body: "If confidence is below 85% or the action is high-risk, the action goes to the approval queue. A human can approve or reject." },
              { step: "8", title: "Action executes and result is logged", body: "The tool executor runs the action. The result is stored in the audit log with timestamp, IP, confidence, and SAF result." },
            ].map((item) => (
              <li key={item.step} className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-sm font-bold text-gold-300">
                  {item.step}
                </span>
                <div>
                  <h3 className="text-sm font-medium text-ink-100">{item.title}</h3>
                  <p className="mt-1 text-sm text-ink-400">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

function ArchitectureDiagram() {
  return (
    <svg viewBox="0 0 800 400" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
      {/* Background */}
      <rect width="800" height="400" rx="16" fill="#ffffff" />

      {/* Frontend box */}
      <rect x="20" y="20" width="160" height="80" rx="12" fill="#e8ebe6" stroke="#4A5D23" strokeWidth="2" />
      <text x="100" y="50" textAnchor="middle" fontSize="14" fontWeight="600" fill="#0e0f0c">Next.js Frontend</text>
      <text x="100" y="70" textAnchor="middle" fontSize="11" fill="#454745">Dashboard / AI Chat</text>
      <text x="100" y="85" textAnchor="middle" fontSize="11" fill="#454745">WebSocket + REST</text>

      {/* Backend box */}
      <rect x="240" y="20" width="200" height="80" rx="12" fill="#e8ebe6" stroke="#4A5D23" strokeWidth="2" />
      <text x="340" y="50" textAnchor="middle" fontSize="14" fontWeight="600" fill="#0e0f0c">Node.js Backend</text>
      <text x="340" y="70" textAnchor="middle" fontSize="11" fill="#454745">Express + Socket.io</text>
      <text x="340" y="85" textAnchor="middle" fontSize="11" fill="#454745">Auth / Rate Limit / Validation</text>

      {/* AI Pipeline box */}
      <rect x="500" y="20" width="160" height="80" rx="12" fill="#e8ebe6" stroke="#4A5D23" strokeWidth="2" />
      <text x="580" y="50" textAnchor="middle" fontSize="14" fontWeight="600" fill="#0e0f0c">AI Pipeline</text>
      <text x="580" y="70" textAnchor="middle" fontSize="11" fill="#454745">DRE / DREV / CRDS</text>
      <text x="580" y="85" textAnchor="middle" fontSize="11" fill="#454745">Qwen Models</text>

      {/* Safety box */}
      <rect x="240" y="150" width="200" height="70" rx="12" fill="#d4d8d0" stroke="#3a7d2c" strokeWidth="2" />
      <text x="340" y="180" textAnchor="middle" fontSize="14" fontWeight="600" fill="#0e0f0c">SAF (7 Layers)</text>
      <text x="340" y="200" textAnchor="middle" fontSize="11" fill="#454745">Safety checks + HITL</text>

      {/* Database box */}
      <rect x="20" y="150" width="160" height="70" rx="12" fill="#e8ebe6" stroke="#0e7fb0" strokeWidth="2" />
      <text x="100" y="180" textAnchor="middle" fontSize="14" fontWeight="600" fill="#0e0f0c">PostgreSQL</text>
      <text x="100" y="200" textAnchor="middle" fontSize="11" fill="#454745">Audit / Memory / Incidents</text>

      {/* Redis box */}
      <rect x="500" y="150" width="160" height="70" rx="12" fill="#e8ebe6" stroke="#b86700" strokeWidth="2" />
      <text x="580" y="180" textAnchor="middle" fontSize="14" fontWeight="600" fill="#0e0f0c">Redis</text>
      <text x="580" y="200" textAnchor="middle" fontSize="11" fill="#454745">Cache / Pub-Sub</text>

      {/* Tools box */}
      <rect x="240" y="270" width="200" height="70" rx="12" fill="#e8ebe6" stroke="#4A5D23" strokeWidth="2" />
      <text x="340" y="300" textAnchor="middle" fontSize="14" fontWeight="600" fill="#0e0f0c">Tool Executor</text>
      <text x="340" y="320" textAnchor="middle" fontSize="11" fill="#454745">Shell / Docker / Files</text>

      {/* Monitoring box */}
      <rect x="20" y="270" width="160" height="70" rx="12" fill="#e8ebe6" stroke="#d03238" strokeWidth="2" />
      <text x="100" y="300" textAnchor="middle" fontSize="14" fontWeight="600" fill="#0e0f0c">Monitor Loop</text>
      <text x="100" y="320" textAnchor="middle" fontSize="11" fill="#454745">Metrics / Anomaly Detect</text>

      {/* Telegram box */}
      <rect x="500" y="270" width="160" height="70" rx="12" fill="#e8ebe6" stroke="#4A5D23" strokeWidth="2" />
      <text x="580" y="300" textAnchor="middle" fontSize="14" fontWeight="600" fill="#0e0f0c">Telegram Bot</text>
      <text x="580" y="320" textAnchor="middle" fontSize="11" fill="#454745">Mobile alerts / approvals</text>

      {/* Arrows */}
      <line x1="180" y1="60" x2="240" y2="60" stroke="#454745" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <line x1="440" y1="60" x2="500" y2="60" stroke="#454745" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <line x1="340" y1="100" x2="340" y2="150" stroke="#454745" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <line x1="240" y1="185" x2="180" y2="185" stroke="#454745" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <line x1="440" y1="185" x2="500" y2="185" stroke="#454745" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <line x1="340" y1="220" x2="340" y2="270" stroke="#454745" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <line x1="100" y1="220" x2="100" y2="270" stroke="#454745" strokeWidth="1.5" markerEnd="url(#arrow)" />
      <line x1="440" y1="305" x2="500" y2="305" stroke="#454745" strokeWidth="1.5" markerEnd="url(#arrow)" />

      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6" fill="#454745" />
        </marker>
      </defs>
    </svg>
  );
}

/* ---------- AI Engine Tab ---------- */

function AIEngineTab() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-card border border-ink-700/40 bg-gradient-to-br from-ink-850 to-ink-900 p-8 md:p-12">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <Badge variant="success" className="text-xs">
            <Brain className="h-3 w-3" /> Decision Intelligence
          </Badge>
          <h1 className="text-3xl font-bold text-ink-100 md:text-4xl">
            Three AI modules debate every action before it runs
          </h1>
          <p className="text-base text-ink-400">
            Instead of trusting a single AI call, the system runs three independent passes.
            One proposes an action, one reviews it, and one can veto it. This catches bad
            decisions before they reach your servers.
          </p>
        </div>
      </section>

      {/* DRE / DREV / CRDS cards */}
      <section className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: <Zap className="h-5 w-5" />,
              name: "DRE",
              title: "Decision Reasoning Engine",
              body: "Gathers context from memory, metrics, and tools. Proposes one or more actions with a confidence score (0 to 1). Uses qwen-plus or qwen-max depending on task complexity.",
              color: "text-gold-400",
            },
            {
              icon: <Eye className="h-5 w-5" />,
              name: "DREV",
              title: "Decision Review Engine",
              body: "Reviews each proposed action for safety, correctness, and risk. Can reject, modify, or approve. Runs as a separate AI call so it does not inherit the first call's biases.",
              color: "text-status-info",
            },
            {
              icon: <ShieldCheck className="h-5 w-5" />,
              name: "CRDS",
              title: "Cross-Reference Decision System",
              body: "Compares the action against historical data. If a similar action failed or caused problems before, CRDS casts a veto vote. This prevents repeating mistakes.",
              color: "text-status-ok",
            },
          ].map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i, duration: 0.25 }}
              className="card p-6 space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-ink-800 ${item.color}`}>
                  {item.icon}
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-ink-500">{item.name}</div>
                  <div className="text-sm font-medium text-ink-100">{item.title}</div>
                </div>
              </div>
              <p className="text-sm text-ink-400">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Confidence scoring */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink-100">Confidence scoring and auto-execute</h2>
        <div className="card p-6 space-y-4">
          <p className="text-sm text-ink-400">
            Every action gets a confidence score from 0 to 1. The score determines what happens next:
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-4 rounded-lg bg-status-ok/10 p-3">
              <Badge variant="success">85% or higher</Badge>
              <span className="text-sm text-ink-300">Action runs automatically. No human approval needed.</span>
            </div>
            <div className="flex items-center gap-4 rounded-lg bg-status-warn/10 p-3">
              <Badge variant="warning">50% to 85%</Badge>
              <span className="text-sm text-ink-300">Action goes to the approval queue. A human reviews and approves or rejects.</span>
            </div>
            <div className="flex items-center gap-4 rounded-lg bg-status-crit/10 p-3">
              <Badge variant="critical">Below 50%</Badge>
              <span className="text-sm text-ink-300">Action is blocked. The AI explains what it wanted to do and why it was not confident.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Qwen model usage */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink-100">How Qwen models are used</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { model: "qwen-turbo", use: "Intent parsing, simple classification, quick lookups", cost: "Lowest cost, fastest response" },
            { model: "qwen-plus", use: "DRE proposals, DREV reviews, root cause analysis", cost: "Balanced cost and capability" },
            { model: "qwen-max", use: "Complex diagnosis, multi-step reasoning, CRDS veto", cost: "Highest capability, used sparingly" },
          ].map((item) => (
            <div key={item.model} className="card p-5 space-y-2">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-gold-400" />
                <code className="text-sm font-mono text-gold-300">{item.model}</code>
              </div>
              <p className="text-sm text-ink-400">{item.use}</p>
              <p className="text-xs text-ink-500">{item.cost}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Memory layers */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink-100">Persistent memory (7 layers)</h2>
        <div className="card p-6">
          <p className="mb-4 text-sm text-ink-400">
            The agent stores different types of memory so it can learn from past incidents instead of starting fresh each time:
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              { name: "Episodic", body: "Records of specific incidents and what happened" },
              { name: "Procedural", body: "Step-by-step playbooks for known problems" },
              { name: "Semantic", body: "General knowledge about the system and its services" },
              { name: "Working", body: "Short-term context for the current task" },
              { name: "Social", body: "User preferences and interaction history" },
              { name: "Meta", body: "Knowledge about knowledge (what the agent knows vs does not)" },
              { name: "Intent", body: "What the user likely wants based on past requests" },
            ].map((layer) => (
              <div key={layer.name} className="flex items-start gap-3 rounded-lg bg-ink-800/50 p-3">
                <Brain className="h-4 w-4 shrink-0 text-gold-400 mt-0.5" />
                <div>
                  <span className="text-sm font-medium text-ink-100">{layer.name}</span>
                  <p className="text-xs text-ink-500">{layer.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- Safety Tab ---------- */

function SafetyTab() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-card border border-ink-700/40 bg-gradient-to-br from-ink-850 to-ink-900 p-8 md:p-12">
        <div className="absolute left-0 top-0 h-48 w-48 rounded-full bg-status-ok/10 blur-3xl" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <Badge variant="success" className="text-xs">
            <Lock className="h-3 w-3" /> Security Architecture
          </Badge>
          <h1 className="text-3xl font-bold text-ink-100 md:text-4xl">
            Safety is not an afterthought. It is the foundation.
          </h1>
          <p className="text-base text-ink-400">
            Every action the AI takes passes through 7 independent safety layers. The system
            also has API rate limiting, input validation, WebSocket authentication, audit logging,
            a kill switch, and human-in-the-loop approval for risky actions.
          </p>
        </div>
      </section>

      {/* SAF 7 layers */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-ink-100">SAF: 7-layer safety framework</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { layer: "L1", name: "Asset Classification", body: "Identifies what the action targets (file, container, network, user) and how critical it is." },
            { layer: "L2", name: "Identity Verification", body: "Checks who is requesting the action and whether they have permission." },
            { layer: "L3", name: "Network Segmentation", body: "Ensures the action stays within allowed network boundaries." },
            { layer: "L4", name: "Policy Enforcement", body: "Checks the action against configured rules (allowed commands, blocked operations)." },
            { layer: "L5", name: "Immutable Logging", body: "Every action is written to an append-only audit log with timestamp, IP, and result." },
            { layer: "L6", name: "Containment", body: "Actions run in a sandbox. If something goes wrong, it is isolated and can be rolled back." },
            { layer: "L7", name: "Governance", body: "Final check: does this action comply with organizational policies and compliance requirements?" },
          ].map((item, i) => (
            <motion.div
              key={item.layer}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05 * i, duration: 0.25 }}
              className="card p-4 flex items-start gap-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-status-ok/15 text-xs font-bold text-status-ok">
                {item.layer}
              </span>
              <div>
                <h3 className="text-sm font-medium text-ink-100">{item.name}</h3>
                <p className="mt-1 text-xs text-ink-400">{item.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Security features */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-ink-100">Security features implemented</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { icon: <Lock className="h-4 w-4" />, title: "API key + JWT authentication", body: "All API requests require a valid API key or JWT token. WebSocket connections are authenticated on handshake." },
            { icon: <Zap className="h-4 w-4" />, title: "Rate limiting", body: "Sliding window rate limiter: 100 requests per minute per IP, 20 burst max. Prevents abuse and DoS." },
            { icon: <CheckCircle2 className="h-4 w-4" />, title: "Input validation (Zod)", body: "Every API endpoint validates input with Zod schemas. Invalid data is rejected with field-level error messages." },
            { icon: <ShieldCheck className="h-4 w-4" />, title: "CORS lockdown", body: "Cross-origin requests are restricted to configured frontend domains. No wildcard origins in production." },
            { icon: <Eye className="h-4 w-4" />, title: "Audit logging with IP capture", body: "Every action is logged with timestamp, actor, target, result, confidence, and client IP address." },
            { icon: <Power className="h-4 w-4" />, title: "Kill switch", body: "A single button stops all AI actions immediately. Available on the dashboard and via API." },
            { icon: <ClipboardCheck className="h-4 w-4" />, title: "Human-in-the-loop approvals", body: "Actions below 85% confidence go to an approval queue. Humans can approve or reject with reasons." },
            { icon: <Server className="h-4 w-4" />, title: "CSP headers + Helmet", body: "Content Security Policy and security headers (X-Frame-Options, X-Content-Type-Options, HSTS) on all responses." },
          ].map((item) => (
            <div key={item.title} className="card p-5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-gold-400">{item.icon}</span>
                <h3 className="text-sm font-medium text-ink-100">{item.title}</h3>
              </div>
              <p className="text-sm text-ink-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Where to verify */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink-100">Where to verify safety features</h2>
        <div className="card p-6">
          <div className="space-y-3">
            {[
              { page: "/security", label: "Safety & Audit page", desc: "View SAF 7-layer status, run a security scan, and browse the immutable audit log" },
              { page: "/approvals", label: "Approvals page", desc: "See pending actions waiting for human approval, approve or reject them" },
              { page: "/settings", label: "Settings page", desc: "Trip the kill switch, view guardrails, check AI usage and budget limits" },
              { page: "/compliance", label: "Compliance page", desc: "Full SAF framework breakdown with compliance status for each layer" },
            ].map((item) => (
              <Link
                key={item.page}
                href={item.page}
                className="flex items-center justify-between rounded-lg bg-ink-800/50 p-3 transition-colors hover:bg-ink-800"
              >
                <div>
                  <span className="text-sm font-medium text-ink-100">{item.label}</span>
                  <p className="text-xs text-ink-500">{item.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-ink-500" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- Demo Tab ---------- */

function DemoTab() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-card border border-ink-700/40 bg-gradient-to-br from-ink-850 to-ink-900 p-8 md:p-12">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-status-info/10 blur-3xl" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <Badge variant="info" className="text-xs">
            <Rocket className="h-3 w-3" /> Try It Live
          </Badge>
          <h1 className="text-3xl font-bold text-ink-100 md:text-4xl">
            Walk through the system right now
          </h1>
          <p className="text-base text-ink-400">
            The dashboard is open and ready to explore. No login required. Here are the key
            pages to visit and what to try on each one.
          </p>
        </div>
      </section>

      {/* Demo steps */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-ink-100">Step-by-step walkthrough</h2>
        <div className="space-y-4">
          {[
            {
              step: "1",
              title: "Open the Dashboard",
              page: "/dashboard",
              desc: "See live server metrics (CPU, RAM, disk, network). Watch the charts update in real time. Try the Simulate Incident buttons to trigger a fake CPU spike or memory leak and watch the AI respond.",
            },
            {
              step: "2",
              title: "Talk to the AI Assistant",
              page: "/agent",
              desc: "Type a natural language request like 'show server health' or 'list top CPU processes'. The AI will parse your intent, run the right tools, and stream the response back in real time.",
            },
            {
              step: "3",
              title: "View Live Metrics",
              page: "/monitoring",
              desc: "See detailed charts for CPU, RAM, disk, and network. Try the RCA (Root Cause Analysis) panel to run a diagnosis on a simulated anomaly.",
            },
            {
              step: "4",
              title: "Check the Approval Queue",
              page: "/approvals",
              desc: "If the AI proposed any actions that need human approval, they will appear here. You can approve or reject each one with a reason.",
            },
            {
              step: "5",
              title: "Review the Audit Log",
              page: "/security",
              desc: "See every action the AI has taken, with timestamps, confidence scores, and SAF results. Run a security scan to check open ports and system status.",
            },
            {
              step: "6",
              title: "Deploy an App",
              page: "/deployments",
              desc: "Paste a GitHub repo URL and the system will clone it, detect the stack, generate a Dockerfile if needed, build the image, and run it on an auto-assigned port.",
            },
            {
              step: "7",
              title: "Open a Terminal",
              page: "/terminal",
              desc: "Run shell commands directly in the browser. The terminal is connected to the backend container over WebSocket.",
            },
            {
              step: "8",
              title: "Trip the Kill Switch",
              page: "/settings",
              desc: "Go to Settings and trip the kill switch. Watch all AI operations stop immediately. Reset it when you are done.",
            },
          ].map((item) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * parseInt(item.step), duration: 0.25 }}
              className="card p-5"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-sm font-bold text-gold-300">
                  {item.step}
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-ink-100">{item.title}</h3>
                    <Link href={item.page}>
                      <Button variant="outline" size="sm" className="btn-press">
                        Open
                        <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                  <p className="mt-2 text-sm text-ink-400">{item.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink-100">All pages at a glance</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { href: "/dashboard", label: "Dashboard", icon: <Activity className="h-4 w-4" /> },
            { href: "/agent", label: "AI Assistant", icon: <Bot className="h-4 w-4" /> },
            { href: "/monitoring", label: "Live Metrics", icon: <Cpu className="h-4 w-4" /> },
            { href: "/terminal", label: "Terminal", icon: <Terminal className="h-4 w-4" /> },
            { href: "/containers", label: "Containers", icon: <Server className="h-4 w-4" /> },
            { href: "/deployments", label: "Deploy", icon: <Rocket className="h-4 w-4" /> },
            { href: "/files", label: "Files", icon: <GitBranch className="h-4 w-4" /> },
            { href: "/approvals", label: "Approvals", icon: <ClipboardCheck className="h-4 w-4" /> },
            { href: "/security", label: "Safety & Audit", icon: <ShieldCheck className="h-4 w-4" /> },
            { href: "/memory", label: "Memory", icon: <Brain className="h-4 w-4" /> },
            { href: "/analytics", label: "Performance", icon: <Activity className="h-4 w-4" /> },
            { href: "/settings", label: "Settings", icon: <Server className="h-4 w-4" /> },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="card card-hover p-4 flex items-center gap-3"
            >
              <span className="text-gold-400">{link.icon}</span>
              <span className="text-sm text-ink-100">{link.label}</span>
              <ArrowRight className="ml-auto h-3 w-3 text-ink-500" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ---------- About Tab ---------- */

function AboutTab() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-card border border-ink-700/40 bg-gradient-to-br from-ink-850 to-ink-900 p-8 md:p-12">
        <div className="absolute left-0 top-0 h-48 w-48 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <Badge variant="success" className="text-xs">
            <CheckCircle2 className="h-3 w-3" /> About the Team
          </Badge>
          <h1 className="text-3xl font-bold text-ink-100 md:text-4xl">
            Who built this
          </h1>
          <p className="text-base text-ink-400">
            ALTHR Autopilot was built for the Global AI Hackathon Series with Qwen Cloud,
            Track 4: Autopilot Agent. The goal was to create an AI agent that can run server
            operations on its own, safely, with human oversight when needed.
          </p>
        </div>
      </section>

      {/* About the submission */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink-100">About this submission</h2>
        <div className="card p-6 space-y-4">
          <p className="text-sm text-ink-400">
            This project was built from scratch for the hackathon. It includes a Node.js backend
            with a full AI reasoning pipeline, a PostgreSQL database for audit logs and memory,
            Redis for caching, a Next.js frontend with real-time WebSocket updates, Docker
            containerization, and deployment to Alibaba Cloud ECS.
          </p>
          <p className="text-sm text-ink-400">
            The AI pipeline uses three Qwen models (qwen-turbo, qwen-plus, qwen-max) for
            different tasks. Every action the AI takes is checked by three independent modules
            (DRE, DREV, CRDS), passes through a 7-layer safety framework (SAF), and is logged
            to an immutable audit trail.
          </p>
          <p className="text-sm text-ink-400">
            The system is designed to be useful in real production environments, not just as a
            demo. It includes proper authentication, rate limiting, input validation, error
            handling, and a kill switch for emergencies.
          </p>
        </div>
      </section>

      {/* What we learned */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink-100">What we focused on</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { title: "Safety first", body: "An AI agent that can run commands on your servers needs strong guardrails. We built 7 safety layers, three AI review passes, and human approval queues before writing any other features." },
            { title: "Real utility", body: "We wanted the system to do something useful, not just look impressive. It monitors real metrics, runs real commands, and can deploy real applications from GitHub repos." },
            { title: "Transparency", body: "Every action the AI takes is visible in the audit log with full context. You can see what it did, why it did it, how confident it was, and whether it passed safety checks." },
            { title: "Built for Qwen", body: "The system is designed around Qwen models and their strengths. It picks the right model for each task based on cost, speed, and capability needs." },
          ].map((item) => (
            <div key={item.title} className="card p-5 space-y-2">
              <h3 className="text-sm font-medium text-gold-300">{item.title}</h3>
              <p className="text-sm text-ink-400">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ink-100">Contact</h2>
        <div className="card p-6">
          <div className="flex flex-wrap gap-4">
            <a href="https://github.com/298althr/QWENCLOUD" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg bg-ink-800/50 px-4 py-2 text-sm text-ink-300 transition-colors hover:bg-ink-800">
              <GitBranch className="h-4 w-4" />
              GitHub Repository
            </a>
            <div className="flex items-center gap-2 rounded-lg bg-ink-800/50 px-4 py-2 text-sm text-ink-300">
              <Mail className="h-4 w-4" />
              sav-dev@althr.io
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-card border border-gold-500/30 bg-gradient-to-br from-gold-500/10 to-transparent p-8 text-center">
        <h2 className="text-2xl font-semibold text-ink-100">Ready to see it in action?</h2>
        <p className="mt-2 text-sm text-ink-400">The dashboard is open. No login required.</p>
        <Link href="/dashboard" className="mt-4 inline-block">
          <Button size="lg" className="btn-press">
            Open Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </section>
    </div>
  );
}
