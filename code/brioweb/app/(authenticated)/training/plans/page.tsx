import Link from "next/link";

export default function TrainingPlansPage() {
  return <div className="page-shell narrow"><div className="page-head"><div><span className="eyebrow">Browse plans · P2 deferred</span><h1 className="page-title">Plan browsing is not part of this release.</h1><p className="page-subtitle">The wireframe marks this path P2. Brio does not display invented plans or imply a verified programme catalogue exists.</p></div></div><section className="empty-state"><h2 className="section-title">Available now</h2><p className="muted">Continue a saved session, describe your own session for structured review, or enter a historical session manually.</p><div className="cluster"><Link className="button" href="/training">Return to Training</Link><Link className="button button-secondary" href="/training/describe">Describe a session</Link></div></section></div>;
}
