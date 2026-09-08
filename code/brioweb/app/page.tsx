import Link from "next/link";
import { getSession } from "@/db/auth-dal";

export default async function Home() {
  const session = await getSession();

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-xl flex-col items-center gap-8 px-6 py-32 text-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            BRIO
          </h1>
          <p className="max-w-sm text-lg leading-7 text-zinc-600 dark:text-zinc-400">
            Track and understand your health data, in one place.
          </p>
        </div>

        {session ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Signed in as <span className="font-medium text-zinc-950 dark:text-zinc-50">{session.user.name}</span>
            </p>
            <Link
              href="/dashboard"
              className="flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Go to dashboard
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Sign up
            </Link>
            <Link
              href="/sign-in"
              className="flex h-11 items-center justify-center rounded-full border border-zinc-300 px-6 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
            >
              Sign in
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
