import { run, type AgentInputItem } from "@openai/agents";
import { getSession } from "@/db/auth-dal";
import { buildOrchestratorAgent, CONSULT_TOOL_TO_AGENT } from "@/agents/orchestrator";
import { labelForTool } from "@/agents/tool-labels";
import type { AgentKey, ChatStreamEvent } from "@/agents/chat-events";

type ChatMessage = { role: "user" | "assistant"; content: string };

function parseMessages(body: unknown): ChatMessage[] | null {
  if (body === null || typeof body !== "object") return null;
  const messages = (body as Record<string, unknown>).messages;
  if (!Array.isArray(messages)) return null;

  const parsed: ChatMessage[] = [];
  for (const m of messages) {
    if (typeof m !== "object" || m === null) return null;
    const row = m as Record<string, unknown>;
    if (row.role !== "user" && row.role !== "assistant") return null;
    if (typeof row.content !== "string") return null;
    parsed.push({ role: row.role, content: row.content });
  }
  return parsed;
}

// Client sends the plain-text running conversation each turn (v1
// simplification — no server-side chat persistence yet). This maps it into
// the SDK's AgentInputItem protocol shape the orchestrator expects.
function toAgentInputItems(messages: ChatMessage[]): AgentInputItem[] {
  return messages.map((m) =>
    m.role === "user"
      ? { role: "user", content: m.content }
      : {
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: m.content }],
        },
  );
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = parseMessages(body);
  if (!messages || messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json(
      { error: "Body must be { messages: { role: 'user' | 'assistant', content: string }[] }, ending with a user message" },
      { status: 400 },
    );
  }

  const byteStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (event: ChatStreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      // Fires from inside a domain agent's own nested run (its own tool
      // calls, its own message output) — the tool-level detail trail.
      const onSubAgentEvent: Parameters<typeof buildOrchestratorAgent>[1] = (agent, evt) => {
        if (
          evt.type === "run_item_stream_event" &&
          evt.name === "tool_called" &&
          evt.item.rawItem.type === "function_call"
        ) {
          send({ type: "agent_detail", agent, detail: labelForTool(evt.item.rawItem.name) });
        }
      };

      try {
        const orchestrator = buildOrchestratorAgent(session.user.id, onSubAgentEvent);
        const result = await run(orchestrator, toAgentInputItems(messages), { stream: true });

        for await (const event of result) {
          if (event.type === "raw_model_stream_event" && event.data.type === "output_text_delta") {
            send({ type: "text", delta: event.data.delta });
            continue;
          }

          if (event.type !== "run_item_stream_event") continue;
          if (event.name !== "tool_called" && event.name !== "tool_output") continue;

          const rawItem = event.item.rawItem;
          const toolName =
            rawItem.type === "function_call" || rawItem.type === "function_call_result" ? rawItem.name : undefined;
          const agent: AgentKey | undefined = toolName ? CONSULT_TOOL_TO_AGENT[toolName] : undefined;
          if (!agent) continue;

          send({ type: "agent_status", agent, status: event.name === "tool_called" ? "started" : "done" });
        }
      } catch (error) {
        send({ type: "error", message: error instanceof Error ? error.message : "Something went wrong" });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(byteStream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
