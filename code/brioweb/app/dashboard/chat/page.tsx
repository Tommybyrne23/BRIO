import Link from "next/link";
import { ChatPanel } from "./chat-panel";

export default function ChatPage() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="flex w-full max-w-lg flex-col">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Coach
          </h1>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-zinc-500 underline underline-offset-2 dark:text-zinc-400"
          >
            Back to dashboard
          </Link>
        </div>
        <ChatPanel />
      </div>
    </div>
  );
}
