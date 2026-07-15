"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, LayoutDashboard, Bot, Activity, Rocket, Brain, ShieldCheck, Settings, Keyboard, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface GuidedTourProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    title: "Welcome to ALTHR Autopilot",
    description: "Your AI-powered operations cockpit for real-time monitoring, intelligent decisions, and autonomous infrastructure management.",
    icon: <Sparkles className="h-6 w-6 text-gold-500" />,
    cta: "Start Tour",
  },
  {
    title: "Dashboard Overview",
    description: "The home screen shows live CPU, RAM, and Disk metrics. Click any card to see detailed process breakdowns and resource usage.",
    icon: <LayoutDashboard className="h-6 w-6 text-status-info" />,
    link: "/",
    linkLabel: "Open Dashboard",
  },
  {
    title: "Real-Time Activity Feed",
    description: "Watch the AI agent's reasoning, actions, approvals, and anomaly alerts as they happen. Everything is streamed live via WebSocket.",
    icon: <Activity className="h-6 w-6 text-status-ok" />,
    link: "/",
    linkLabel: "View Dashboard Feed",
  },
  {
    title: "Agent Console",
    description: "Chat directly with the operations AI. Ask it to investigate incidents, manage containers, review deployments, or run security scans.",
    icon: <Bot className="h-6 w-6 text-gold-500" />,
    link: "/agent",
    linkLabel: "Open Agent Console",
  },
  {
    title: "Monitoring & Processes",
    description: "Deep-dive into running processes, open ports, Docker container health, and historical resource charts.",
    icon: <Activity className="h-6 w-6 text-status-info" />,
    link: "/monitoring",
    linkLabel: "Open Monitoring",
  },
  {
    title: "Deployments",
    description: "Deploy applications from GitHub, validate repositories, run CI/CD checks, and investigate deployment failures with AI.",
    icon: <Rocket className="h-6 w-6 text-status-warn" />,
    link: "/deployments",
    linkLabel: "Open Deployments",
  },
  {
    title: "Memory & Learning",
    description: "Inspect the persistent memory layers (M1-M7), feedback loops, and lessons learned from every incident.",
    icon: <Brain className="h-6 w-6 text-status-info" />,
    link: "/memory",
    linkLabel: "Open Memory",
  },
  {
    title: "Security & Compliance",
    description: "Run security scans, review audit logs, and explore the 7-layer SAF guardrails that keep AI actions safe.",
    icon: <ShieldCheck className="h-6 w-6 text-status-ok" />,
    link: "/security",
    linkLabel: "Open Security",
  },
  {
    title: "Settings & Shortcuts",
    description: "Customize thresholds, browse the full settings, and press '?' anytime to see keyboard shortcuts for lightning-fast navigation.",
    icon: <Settings className="h-6 w-6 text-ink-300" />,
    extraIcon: <Keyboard className="h-5 w-5 text-ink-500" />,
    link: "/settings",
    linkLabel: "Open Settings",
  },
];

export default function GuidedTour({ open, onClose }: GuidedTourProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-ink-700 bg-ink-900 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-gold-500/20 via-ink-800/30 to-transparent" />

        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 text-ink-500 hover:text-ink-200 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative px-6 pb-6 pt-8">
          {/* Progress */}
          <div className="mb-6 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i <= step ? "bg-gold-500" : "bg-ink-800"
                )}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-700 bg-ink-950 shadow-inner">
            {current.icon}
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-ink-100">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-400">{current.description}</p>

          {/* Extra shortcut hint on last step */}
          {current.extraIcon && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-ink-800 bg-ink-950/50 px-3 py-2">
              {current.extraIcon}
              <span className="text-xs text-ink-500">Press <kbd className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-ink-300">?</kbd> anytime for shortcuts</span>
            </div>
          )}

          {/* Quick link */}
          {current.link && (
            <div className="mt-5">
              <Link
                href={current.link}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-500 hover:text-gold-400"
              >
                {current.linkLabel}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {/* Footer actions */}
          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="text-xs font-medium text-ink-500 hover:text-ink-300 transition-colors"
            >
              Exit tour
            </button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="flex h-9 items-center gap-1 rounded-md border border-ink-700 bg-ink-900 px-3 text-sm font-medium text-ink-300 transition-colors hover:bg-ink-800"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              <button
                onClick={() => {
                  if (isLast) onClose();
                  else setStep((s) => s + 1);
                }}
                className="flex h-9 items-center gap-1 rounded-md bg-gold-500 px-4 text-sm font-medium text-white transition-colors hover:bg-gold-600"
              >
                {isLast ? "Finish" : isFirst ? current.cta : "Continue"}
                {!isLast && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="mt-4 text-center text-[10px] text-ink-600">
            Step {step + 1} of {STEPS.length}
          </div>
        </div>
      </div>
    </div>
  );
}
