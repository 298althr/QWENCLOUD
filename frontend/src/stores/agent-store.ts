// frontend/src/stores/agent-store.ts
// Zustand store for agent state — reasoning chain, actions, approvals, metrics, decision pipeline.

import { create } from "zustand";

type ReasoningEntry = { type: "reasoning" | "response"; text: string; timestamp: number };
type ActionEntry = { stage: string; timestamp?: number; [key: string]: any };
type ApprovalEntry = {
  action_id: string;
  action: string;
  confidence: number;
  risk_level: string;
  timestamp: string;
  di_tier?: string;
  di_score?: number;
  rrs?: number;
  crds_vetoed?: boolean;
  drev_winner?: string;
  drev_reserve?: string;
  drev_cr?: number;
  drev_robustness?: number;
  dre_candidates?: number;
  dre_coverage?: number;
  dre_contradiction?: number;
  degradations?: string[];
  explainability?: any;
  [key: string]: any;
};
type AlertEntry = { id: string; type: string; severity: string; message: string; timestamp: string };

// Decision pipeline types
type PipelineEvent = { stage: string; data: any; timestamp: number };
type FrameworkStatus = { dre: string; drev: string; crds: string; dqs: string; disc: string; critique: string };

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

  // Decision pipeline
  pipelineStage: string;
  pipelineHistory: PipelineEvent[];
  frameworkStatus: FrameworkStatus;

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
  setPipelineStage: (stage: string) => void;
  addPipelineEvent: (event: PipelineEvent) => void;
  setFrameworkStatus: (status: Partial<FrameworkStatus>) => void;
};

export const useAgentStore = create<AgentState>((set) => ({
  reasoning: [],
  actions: [],
  isProcessing: false,
  lastResponse: "",
  metrics: null,
  alerts: [],
  approvals: [],

  // Decision pipeline
  pipelineStage: "idle",
  pipelineHistory: [],
  frameworkStatus: { dre: "idle", drev: "idle", crds: "idle", dqs: "idle", disc: "idle", critique: "idle" },

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

  setPipelineStage: (stage) => set({ pipelineStage: stage }),

  addPipelineEvent: (event) =>
    set((s) => ({
      pipelineHistory: [...s.pipelineHistory.slice(-100), event],
    })),

  setFrameworkStatus: (status) =>
    set((s) => ({
      frameworkStatus: { ...s.frameworkStatus, ...status },
    })),
}));
