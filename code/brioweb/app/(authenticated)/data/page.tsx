import { requireUser } from "@/db/auth-dal";
import { getConsentForUser } from "@/db/queries/product-state";
import { getSourceStatusesForUser } from "@/db/queries/governance";
import { listDecisionEventsForUser, listDecisionsForUser } from "@/db/queries/decisions";
import { DataControls } from "@/components/data-controls";
import { PwaInstall } from "@/components/pwa-install";

export default async function DataPage() {
  const user = await requireUser();
  const [consent, sources, decisions, events] = await Promise.all([
    getConsentForUser(user.id),
    getSourceStatusesForUser(user.id),
    listDecisionsForUser(user.id),
    listDecisionEventsForUser(user.id),
  ]);
  return <div className="page-shell"><div className="page-head"><div><span className="eyebrow">Data · consent · audit</span><h1 className="page-title">Your controls, in one place.</h1><p className="page-subtitle">Change processing permissions, inspect sources and decisions, export records, or delete the account.</p></div></div><div className="stack"><PwaInstall/><DataControls initialConsent={consent} sources={sources} decisions={decisions} events={events}/></div></div>;
}
