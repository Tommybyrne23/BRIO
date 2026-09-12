import { ChatPanel } from "./chat-panel";

export default function ChatPage() {
  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="flex w-full max-w-lg flex-col">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Coach
        </h1>
        <ChatPanel />
      </div>
    </div>
  );
}
