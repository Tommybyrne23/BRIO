"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-zinc-50";
const labelClass = "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";
const buttonClass =
  "flex h-11 w-full items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#ccc]";
const linkClass = "font-medium text-zinc-950 underline underline-offset-2 dark:text-zinc-50";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      if (error) {
        setError(error.message ?? "Something went wrong");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch (err) {
      console.error("Password reset request failed:", err);
      setError("Something went wrong. Check the browser console for details.");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Forgot password
        </h1>
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
          We&apos;ll send you a link to reset it.
        </p>

        {status === "sent" ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            If an account exists for that email, a reset link has been generated. No email
            provider is wired up yet — check the server console log for the link.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={loading} className={buttonClass}>
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/sign-in" className={linkClass}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
