// Shared between app/api/chat/route.ts (server) and
// app/dashboard/chat/chat-panel.tsx (client) — type-only, no runtime code,
// safe to import from both.

export type AgentKey = "orchestrator" | "sleep" | "training" | "recovery";

export type ChatStreamEvent =
  | { type: "agent_status"; agent: AgentKey; status: "started" | "done" }
  | { type: "agent_detail"; agent: AgentKey; detail: string }
  | { type: "text"; delta: string }
  | { type: "error"; message: string };
