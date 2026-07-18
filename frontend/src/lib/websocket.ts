// frontend/src/lib/websocket.ts
// WebSocket client for real-time updates (Socket.io).

import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3000";

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_DELAY = 1000;

export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";
const statusListeners = new Set<(status: ConnectionStatus) => void>();

export function onConnectionStatus(cb: (status: ConnectionStatus) => void) {
  statusListeners.add(cb);
  return () => { statusListeners.delete(cb); };
}

function notifyStatus(status: ConnectionStatus) {
  statusListeners.forEach((cb) => cb(status));
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: BASE_DELAY,
      reconnectionDelayMax: 10000,
    });

    socket.on("connect", () => {
      console.log("[ws] connected:", socket?.id);
      reconnectAttempts = 0;
      notifyStatus("connected");
    });

    socket.on("disconnect", () => {
      console.log("[ws] disconnected");
      notifyStatus("disconnected");
    });

    socket.on("connect_error", () => {
      reconnectAttempts++;
      const delay = Math.min(BASE_DELAY * Math.pow(2, reconnectAttempts), 10000);
      console.log(`[ws] reconnect attempt ${reconnectAttempts} in ${delay}ms`);
      notifyStatus("reconnecting");
    });

    socket.io.on("reconnect_attempt", () => {
      notifyStatus("reconnecting");
    });
  }
  return socket;
}

export type ReasoningChunk = { anomalyId?: string; chunk: string };
export type ActionUpdate = { anomalyId?: string; stage: string; [key: string]: any };
export type AnomalyAlert = { id: string; type: string; severity: string; message: string; timestamp: string };
export type ServerMetrics = {
  timestamp: string;
  cpu: number;
  ram: number;
  ram_used_mb: number;
  ram_total_mb: number;
  disk: number | null;
  processes: any[];
  ports: any[];
};

// Decision pipeline event types
export type DecisionEvent = {
  stage: string;
  data: any;
  timestamp: string;
};

export function onReasoningStream(cb: (data: ReasoningChunk) => void) {
  const s = getSocket();
  s.on("reasoning_stream", cb);
  return () => { s.off("reasoning_stream", cb); };
}

export function onResponseStream(cb: (data: ReasoningChunk) => void) {
  const s = getSocket();
  s.on("response_stream", cb);
  return () => { s.off("response_stream", cb); };
}

export function onActionUpdate(cb: (data: ActionUpdate) => void) {
  const s = getSocket();
  s.on("action_update", cb);
  return () => { s.off("action_update", cb); };
}

export function onAnomalyAlert(cb: (data: AnomalyAlert) => void) {
  const s = getSocket();
  s.on("anomaly_alert", cb);
  return () => { s.off("anomaly_alert", cb); };
}

export function onServerMetrics(cb: (data: ServerMetrics) => void) {
  const s = getSocket();
  s.on("server_metrics", cb);
  return () => { s.off("server_metrics", cb); };
}

export function onApprovalNeeded(cb: (data: any) => void) {
  const s = getSocket();
  s.on("approval_needed", cb);
  return () => { s.off("approval_needed", cb); };
}

// Terminal log events (AI commands, simulations, user commands)
export type TerminalLogEntry = {
  id: string;
  command: string;
  output: string;
  exitCode: number | null;
  source: string;
  timestamp: number;
  isoTime: string;
};

export function onTerminalLog(cb: (data: TerminalLogEntry) => void) {
  const s = getSocket();
  s.on("terminal_log", cb);
  return () => { s.off("terminal_log", cb); };
}

// Decision pipeline events
export function onDreResearch(cb: (data: DecisionEvent) => void) {
  const s = getSocket();
  s.on("dre_research", cb);
  return () => { s.off("dre_research", cb); };
}

export function onDrevVerification(cb: (data: DecisionEvent) => void) {
  const s = getSocket();
  s.on("drev_verification", cb);
  return () => { s.off("drev_verification", cb); };
}

export function onCrdsReaction(cb: (data: DecisionEvent) => void) {
  const s = getSocket();
  s.on("crds_reaction", cb);
  return () => { s.off("crds_reaction", cb); };
}

export function onDqsMass(cb: (data: DecisionEvent) => void) {
  const s = getSocket();
  s.on("dqs_mass", cb);
  return () => { s.off("dqs_mass", cb); };
}

export function onCritiqueQuality(cb: (data: DecisionEvent) => void) {
  const s = getSocket();
  s.on("critique_quality", cb);
  return () => { s.off("critique_quality", cb); };
}

export function onDegradationStatus(cb: (data: DecisionEvent) => void) {
  const s = getSocket();
  s.on("degradation_status", cb);
  return () => { s.off("degradation_status", cb); };
}

export function sendAgentMessage(message: string) {
  getSocket().emit("agent_message", { message });
}

export function approveAction(action_id: string) {
  getSocket().emit("approve_action", { action_id });
}

export function rejectAction(action_id: string, reason?: string) {
  getSocket().emit("reject_action", { action_id, reason });
}

// RCA events
export type RcaResult = {
  incident_id: string;
  symptom: string;
  signal_type: string;
  affected_node: string;
  causal_chain: any[];
  competing_causes: any[];
  bayesian_scores: Record<string, any>;
  blast_radius: number;
  impacted_services: string[];
  recommended_actions: string[];
  causal_explanation: string;
  confidence_score: number;
  governance_status: string;
  analysis_time_ms: number;
  timestamp: string;
};

export function onRcaResult(cb: (data: RcaResult) => void) {
  const s = getSocket();
  s.on("rca_result", cb);
  return () => { s.off("rca_result", cb); };
}

export function onIncidentOpened(cb: (data: any) => void) {
  const s = getSocket();
  s.on("incident_opened", cb);
  return () => { s.off("incident_opened", cb); };
}

export function onIncidentEscalated(cb: (data: any) => void) {
  const s = getSocket();
  s.on("incident_escalated", cb);
  return () => { s.off("incident_escalated", cb); };
}

export function onIncidentResolved(cb: (data: any) => void) {
  const s = getSocket();
  s.on("incident_resolved", cb);
  return () => { s.off("incident_resolved", cb); };
}
