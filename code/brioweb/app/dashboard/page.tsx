import Link from "next/link";
import { requireUser } from "@/db/auth-dal";
import { getRecentSamplesForUser } from "@/db/queries/health-samples";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const user = await requireUser();
  const samples = await getRecentSamplesForUser(user.id);

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

          <Link
            href="/dashboard/chat"
            className="mt-6 inline-block font-medium text-zinc-950 underline underline-offset-2 dark:text-zinc-50"
          >
            Chat with your coach
          </Link>

          {user.role === "admin" && (
            <Link
              href="/admin"
              className="mt-2 block font-medium text-zinc-950 underline underline-offset-2 dark:text-zinc-50"
            >
              Go to admin area
            </Link>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Recent health samples
          </h2>
          {samples.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No samples yet. Push one from the mobile app or{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                POST /api/health-samples
              </code>
              .
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              {samples.map((sample) => (
                <li key={sample.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium text-zinc-950 dark:text-zinc-50">
                      {sample.sampleType
                        .replace(/^HK(Quantity|Category)TypeIdentifier/, "")
                        .replace(/([a-z])([A-Z])/g, "$1 $2")}
                    </p>
                    <p className="text-zinc-500 dark:text-zinc-400">
                      {sample.value}
                      {sample.unit ? ` ${sample.unit}` : ""} · {sample.sourceName ?? "unknown source"}
                    </p>
                  </div>
                  <time
                    dateTime={sample.startDate.toISOString()}
                    className="shrink-0 text-zinc-500 dark:text-zinc-400"
                  >
                    {sample.startDate.toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
