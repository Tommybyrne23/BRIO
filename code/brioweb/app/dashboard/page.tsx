import Link from "next/link";
import { requireUser } from "@/db/auth-dal";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Dashboard
          </h1>
          <SignOutButton />
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-zinc-500 dark:text-zinc-400">Name</dt>
            <dd className="text-zinc-950 dark:text-zinc-50">{user.name}</dd>
            <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
            <dd className="text-zinc-950 dark:text-zinc-50">{user.email}</dd>
            <dt className="text-zinc-500 dark:text-zinc-400">Username</dt>
            <dd className="text-zinc-950 dark:text-zinc-50">{user.username ?? "(none)"}</dd>
            <dt className="text-zinc-500 dark:text-zinc-400">Role</dt>
            <dd className="text-zinc-950 dark:text-zinc-50">{user.role ?? "user"}</dd>
          </dl>

          {user.role === "admin" && (
            <Link
              href="/admin"
              className="mt-6 inline-block font-medium text-zinc-950 underline underline-offset-2 dark:text-zinc-50"
            >
              Go to admin area
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
