import Image from "next/image";
import Link from "next/link";
import { getSession } from "@/db/auth-dal";
import { createDemoFixture } from "@/lib/demo/fixture";

export default async function Home() {
  const session = await getSession();
  const preview = createDemoFixture("2026-09-13", "specialist_disagreement");
  const decision = preview.dashboard.decision!;

  return <div className="hero">
    <header className="public-nav"><Link href="/" aria-label="Brio home"><Image src="/brio-lockup.svg" alt="Brio" width={150} height={55} priority /></Link><div className="cluster nav-secondary">{session ? <Link href="/dashboard" className="button button-small">Open workspace</Link> : <><Link href="/sign-in" className="button button-quiet button-small">Sign in</Link><Link href="/sign-up" className="button button-small">Create account</Link></>}</div></header>
    <main className="hero-grid">
      <section><span className="eyebrow">Training · nutrition · recovery</span><h1>One decision.<br/><em>Show the working.</em></h1><p className="hero-copy">Brio compares the evidence you choose to share, keeps uncertainty visible, and gives you one editable action: Progress, Maintain, Repeat, Reduce or Escalate.</p><div className="hero-actions"><Link href="/demo" className="button">Explore the synthetic demo</Link>{session ? <Link href="/dashboard" className="button button-secondary">Open your workspace</Link> : <><Link href="/sign-up" className="button button-secondary">Create account</Link><Link href="/sign-in" className="button button-quiet">Sign in</Link></>}</div><p className="hero-note">The demo uses synthetic inputs and simulated outcomes. It does not read your health records or call a model.</p></section>
      <section className="preview-card" aria-label="Example recommendation"><Image className="preview-mark" src="/brio-icon.svg" alt="" width={72} height={72}/><div className="cluster"><span className="badge synthetic">Synthetic inputs</span><span className="badge simulated">Simulated decision</span></div><p className="eyebrow" style={{ marginTop: 34 }}>Example bounded action</p><h2 className="decision-action decision-repeat" style={{ fontSize: "clamp(3.4rem, 7vw, 6.5rem)" }}>{decision.action}</h2><p className="decision-proposal">{decision.proposal.text}</p><hr className="rule"/><div className="disagreement"><strong>Visible disagreement</strong><p className="muted small">{decision.disagreement.summary}</p></div><p className="muted small">{decision.policyReason}</p><Link href="/demo" className="text-link">Inspect all evidence →</Link></section>
    </main>
  </div>;
}
