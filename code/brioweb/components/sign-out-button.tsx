"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({
  variant = "pill",
}: {
  variant?: "pill" | "menu-item";
}) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  if (variant === "menu-item") {
    return (
      <button
        role="menuitem"
        onClick={handleSignOut}
        className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-950 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-900"
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      onClick={handleSignOut}
      className="flex h-10 items-center justify-center rounded-full border border-zinc-300 px-5 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
    >
      Sign out
    </button>
  );
}
