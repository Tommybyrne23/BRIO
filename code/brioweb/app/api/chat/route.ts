import { run, type AgentInputItem } from "@openai/agents";
import { getSession } from "@/db/auth-dal";
import { buildOrchestratorAgent } from "@/agents/orchestrator";

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

  const orchestrator = buildOrchestratorAgent(session.user.id);
  const result = await run(orchestrator, toAgentInputItems(messages), { stream: true });

  // result.toTextStream() returns the SDK's own cross-runtime async-iterable
  // shim, not a full Web ReadableStream (no getReader()) — iterate with
  // `for await` and re-wrap as bytes for the Route Handler response body.
  const textStream = result.toTextStream();
  const byteStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of textStream) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(byteStream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
