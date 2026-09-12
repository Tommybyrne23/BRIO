"use client";

import { useState, type FormEvent } from "react";
import type { AgentKey, ChatStreamEvent } from "@/agents/chat-events";

type AgentStep = { type: "status"; agent: AgentKey } | { type: "detail"; agent: AgentKey; detail: string };

type ChatMessage = { role: "user" | "assistant"; content: string; steps?: AgentStep[] };

const AGENT_LABELS: Record<AgentKey, string> = {
  orchestrator: "🧠 Orchestrator",
  sleep: "🌙 Sleep Agent",
  training: "🏋️ Training Agent",
  recovery: "❤️ Recovery Agent",
};

// Domain agents run concurrently (the orchestrator can call all three
// consult_* tools in one turn), so raw event order interleaves their
// tool_called/detail events — e.g. all three "started" land before any
// detail lines do, and two agents that share a tool (get_training_load_summary
// is used by both Training and Recovery) produce two separately-labeled
// lines. Group by agent so each agent's own detail lines nest under its own
// header in the order they actually arrived, instead of one flat,
// hard-to-attribute chronological list.
function groupStepsByAgent(steps: AgentStep[]): { agent: AgentKey; details: string[] }[] {
  const order: AgentKey[] = [];
  const detailsByAgent = new Map<AgentKey, string[]>();

  for (const step of steps) {
    if (!detailsByAgent.has(step.agent)) {
      detailsByAgent.set(step.agent, []);
      order.push(step.agent);
    }
    if (step.type === "detail") {
      detailsByAgent.get(step.agent)!.push(step.detail);
    }
  }

  return order.map((agent) => ({ agent, details: detailsByAgent.get(agent) ?? [] }));
}

function TypingDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);

  function updateLastMessage(updater: (msg: ChatMessage) => ChatMessage) {
    setMessages((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = updater(updated[updated.length - 1]);
      return updated;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    setError(null);
    setInput("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...nextMessages, { role: "assistant", content: "", steps: [] }]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? `Request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const streamEvent = JSON.parse(line) as ChatStreamEvent;

          if (streamEvent.type === "text") {
            assistantText += streamEvent.delta;
            updateLastMessage((msg) => ({ ...msg, content: assistantText }));
          } else if (streamEvent.type === "agent_status" && streamEvent.status === "started") {
            updateLastMessage((msg) => ({
              ...msg,
              steps: [...(msg.steps ?? []), { type: "status", agent: streamEvent.agent }],
            }));
          } else if (streamEvent.type === "agent_detail") {
            updateLastMessage((msg) => ({
              ...msg,
              steps: [...(msg.steps ?? []), { type: "detail", agent: streamEvent.agent, detail: streamEvent.detail }],
            }));
          } else if (streamEvent.type === "error") {
            throw new Error(streamEvent.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages(nextMessages);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-end gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Show agent thinking</span>
          <button
            type="button"
            role="switch"
            aria-checked={showDetails}
            onClick={() => setShowDetails((v) => !v)}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
              showDetails ? "bg-zinc-950 dark:bg-zinc-50" : "bg-zinc-300 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform dark:bg-zinc-950 ${
                showDetails ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </label>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ask about your sleep, training, or recovery — e.g. &ldquo;How has my recovery been this
            week?&rdquo;
          </p>
        )}
        {messages.map((message, index) => {
          const isLastAssistant = message.role === "assistant" && index === messages.length - 1;
          const steps = message.steps ?? [];
          const trail = groupStepsByAgent(steps);
          const isWorking = isLastAssistant && isStreaming && !message.content;

          return (
            <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  message.role === "user"
                    ? "max-w-[85%] rounded-2xl bg-zinc-950 px-4 py-2.5 text-sm text-zinc-50 dark:bg-zinc-50 dark:text-zinc-950"
                    : "max-w-[85%] whitespace-pre-wrap rounded-2xl bg-zinc-100 px-4 py-2.5 text-sm text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50"
                }
              >
                {trail.length > 0 && (
                  <div className="mb-2 space-y-1.5 border-b border-zinc-200 pb-2 text-xs dark:border-zinc-800">
                    {trail.map(({ agent, details }) => (
                      <div key={agent}>
                        <p className="font-medium text-zinc-600 dark:text-zinc-300">{AGENT_LABELS[agent]}</p>
                        {showDetails &&
                          details.map((detail, i) => (
                            <p key={i} className="pl-4 text-zinc-400 dark:text-zinc-500">
                              · {detail}
                            </p>
                          ))}
                      </div>
                    ))}
                    {isWorking && <TypingDots className="pl-4 text-zinc-400 dark:text-zinc-500" />}
                  </div>
                )}
                {message.content}
                {isWorking && steps.length === 0 && (
                  <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                    Thinking <TypingDots />
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your coach…"
          disabled={isStreaming}
          className="flex-1 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="flex h-10 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Send
        </button>
      </form>
    </div>
  );
}
