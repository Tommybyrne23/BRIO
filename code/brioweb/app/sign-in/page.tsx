"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: authError } = await authClient.signIn.email({ email, password });
      if (authError) return setError(authError.message ?? "Email or password was not accepted.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("The sign-in request could not be completed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-shell"><section className="auth-art"><Link href="/"><Image src="/brio-lockup.svg" alt="Brio" width={150} height={55}/></Link><p className="auth-quote">One workspace for what you did, what you ate, and how you <span>responded.</span></p><p className="muted small">The iPhone helper uses the same preserved account.</p></section><section className="auth-panel"><div className="auth-card"><span className="eyebrow">Welcome back</span><h1>Sign in</h1><p className="page-subtitle">Use the email and password for your Brio account.</p><form className="stack" onSubmit={submit} style={{ marginTop: 28 }}><div className="form-field"><label htmlFor="email">Email</label><input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)}/></div><div className="form-field"><label htmlFor="password">Password</label><input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)}/></div>{error && <div className="error-box" role="alert">{error}</div>}<button className="button" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button></form><div className="stack-tight" style={{ marginTop: 22 }}><Link className="text-link small" href="/forgot-password">Password reset status</Link><p className="muted small">No account? <Link className="text-link" href="/sign-up">Create one</Link></p><p className="muted small"><Link className="text-link" href="/demo">Explore the synthetic demo</Link></p></div></div></section></main>;
}
