// frontend/src/lib/websocket.ts
// WebSocket client for real-time updates (Socket.io).

import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, { transports: ["websocket", "polling"] });
    socket.on("connect", () => console.log("[ws] connected:", socket?.id));
    socket.on("disconnect", () => console.log("[ws] disconnected"));
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

export function sendAgentMessage(message: string) {
  getSocket().emit("agent_message", { message });
}

export function approveAction(action_id: string) {
  getSocket().emit("approve_action", { action_id });
}

export function rejectAction(action_id: string, reason?: string) {
  getSocket().emit("reject_action", { action_id, reason });
}
