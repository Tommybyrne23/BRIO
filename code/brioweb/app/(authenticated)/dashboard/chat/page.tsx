import Link from "next/link";
import { requireUser } from "@/db/auth-dal";
import { DemoProfileControl } from "@/components/demo-profile-control";
import { listEcpDefinitions } from "@/lib/demo/ecp-fixtures";
import { ChatPanel } from "./chat-panel";

export default async function ChatPage() {
  const user = await requireUser();
  const allowedEmail = process.env.BRIO_DEMO_ACCOUNT_EMAIL?.trim().toLowerCase();
  const canLoadProfiles = process.env.BRIO_DEMO_MODE === "true"
    && Boolean(allowedEmail)
    && user.email?.toLowerCase() === allowedEmail;

  return <div className="page-shell narrow stack">
    <div className="page-head">
      <div>
        <span className="eyebrow">Consent-gated live agents</span>
        <h1 className="page-title">Ask Brio</h1>
        <p className="page-subtitle">The orchestrator asks specialist agents to retrieve owner-scoped evidence, then synthesizes one inspectable response. A model call occurs only after you press Send.</p>
      </div>
      <Link className="button button-secondary button-small" href="/data">Review consent</Link>
    </div>

    {canLoadProfiles ? <DemoProfileControl profiles={listEcpDefinitions()} /> : <div className="card compact">
      <strong>Live account mode</strong>
      <p className="muted small">Profile loading is unavailable unless this is the explicitly configured demo account. AI processing must be enabled in Data controls.</p>
    </div>}

    <div className="card compact">
      <div className="cluster"><span className="badge live">Live agents</span>{canLoadProfiles && <span className="badge synthetic">Synthetic inputs after profile load</span>}</div>
      <p className="muted small">The visible specialist trail reports tool activity, not private chain-of-thought. Responses must preserve missing data, consent exclusions, uncertainty, and synthetic provenance.</p>
    </div>

    <ChatPanel />
  </div>;
}
