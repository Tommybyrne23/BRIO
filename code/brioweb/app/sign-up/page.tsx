"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
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
      const prefix = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18) || "brio";
      const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
      const { error: authError } = await authClient.signUp.email({
        email,
        password,
        name: "Brio member",
        username: `${prefix}${suffix}`,
      });
      if (authError) return setError(authError.message ?? "We could not create the account.");
      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("The account request could not be completed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-shell"><section className="auth-art"><Link href="/"><Image src="/brio-lockup.svg" alt="Brio" width={150} height={55}/></Link><p className="auth-quote">Your evidence stays <span>inspectable.</span><br/>Your decision stays editable.</p><p className="muted small">No social providers are configured for this submission.</p></section><section className="auth-panel"><div className="auth-card"><span className="eyebrow">Create account</span><h1>Start with only what you choose.</h1><p className="page-subtitle">Two fields now. Signal permissions come next and all optional processing starts off.</p><form className="stack" onSubmit={submit} style={{ marginTop: 28 }}><div className="form-field"><label htmlFor="email">Email</label><input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)}/></div><div className="form-field"><label htmlFor="password">Password</label><input id="password" className="input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)}/><p className="form-hint">Use at least 8 characters.</p></div>{error && <div className="error-box" role="alert">{error}</div>}<button className="button" type="submit" disabled={loading}>{loading ? "Creating account…" : "Create account"}</button></form><p className="muted small" style={{ marginTop: 22 }}>Already have an account? <Link className="text-link" href="/sign-in">Sign in</Link></p><p className="muted small"><Link className="text-link" href="/demo">Explore the synthetic demo first</Link></p></div></section></main>;
}
