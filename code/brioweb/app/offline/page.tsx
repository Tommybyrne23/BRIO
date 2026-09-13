import Image from "next/image";
import Link from "next/link";

export default function OfflinePage() {
  return <main className="auth-panel" style={{ minHeight: "100vh" }}><div className="auth-card"><Image src="/brio-lockup.svg" alt="Brio" width={145} height={55}/><div style={{ marginTop: 36 }}><span className="eyebrow">Offline</span><h1>Your account workspace needs a connection.</h1><p className="page-subtitle">Authenticated health records, saves and recommendations are not cached for offline use. The public synthetic demo may remain available if it was opened previously.</p><div className="cluster" style={{ marginTop: 24 }}><Link className="button" href="/dashboard">Try again</Link><Link className="button button-secondary" href="/demo">Open cached demo</Link></div></div></div></main>;
}
