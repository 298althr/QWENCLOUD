// frontend/src/stores/agent-store.ts
// Zustand store for agent state — reasoning chain, actions, approvals, metrics.

import { create } from "zustand";

type ReasoningEntry = { type: "reasoning" | "response"; text: string; timestamp: number };
type ActionEntry = { stage: string; timestamp?: number; [key: string]: any };
type ApprovalEntry = { action_id: string; action: string; confidence: number; risk_level: string; timestamp: string };
type AlertEntry = { id: string; type: string; severity: string; message: string; timestamp: string };

type AgentState = {
  // Agent console
  reasoning: ReasoningEntry[];
  actions: ActionEntry[];
  isProcessing: boolean;
  lastResponse: string;

  // Real-time
  metrics: { cpu: number; ram: number; disk: number | null } | null;
  alerts: AlertEntry[];
  approvals: ApprovalEntry[];

  // Actions
  addReasoning: (type: "reasoning" | "response", text: string) => void;
  addAction: (entry: ActionEntry) => void;
  setProcessing: (v: boolean) => void;
  setLastResponse: (text: string) => void;
  setMetrics: (m: { cpu: number; ram: number; disk: number | null }) => void;
  addAlert: (alert: AlertEntry) => void;
  addApproval: (a: ApprovalEntry) => void;
  removeApproval: (action_id: string) => void;
  clearConsole: () => void;
};

export const useAgentStore = create<AgentState>((set) => ({
  reasoning: [],
  actions: [],
  isProcessing: false,
  lastResponse: "",
  metrics: null,
  alerts: [],
  approvals: [],

  addReasoning: (type, text) =>
    set((s) => ({
      reasoning: [...s.reasoning.slice(-200), { type, text, timestamp: Date.now() }],
    })),

  addAction: (entry) =>
    set((s) => ({
      actions: [...s.actions.slice(-50), { ...entry, timestamp: Date.now() }],
    })),

  setProcessing: (v) => set({ isProcessing: v }),
  setLastResponse: (text) => set({ lastResponse: text }),
  setMetrics: (m) => set({ metrics: m }),

  addAlert: (alert) =>
    set((s) => ({
      alerts: [alert, ...s.alerts].slice(0, 50),
    })),

  addApproval: (a) =>
    set((s) => ({
      approvals: [...s.approvals.filter((x) => x.action_id !== a.action_id), a],
    })),

  removeApproval: (action_id) =>
    set((s) => ({
      approvals: s.approvals.filter((x) => x.action_id !== action_id),
    })),

  clearConsole: () => set({ reasoning: [], actions: [], lastResponse: "" }),
}));
