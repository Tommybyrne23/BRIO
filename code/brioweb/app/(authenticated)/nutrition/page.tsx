import { requireUser } from "@/db/auth-dal";
import { getManualLogForUser } from "@/db/queries/product-state";
import { getPreferencesForUser } from "@/db/queries/product-state";
import { NutritionEditor } from "@/components/nutrition-editor";

function localDateIn(timeZone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

export default async function NutritionPage() {
  const user = await requireUser(); const preferences = await getPreferencesForUser(user.id); const localDate = localDateIn(preferences.timezone); const latest = await getManualLogForUser(user.id, localDate); const nutrition = latest?.nutrition;
  return <div className="page-shell"><div className="page-head"><div><span className="eyebrow">Nutrition</span><h1 className="page-title">Intake, without invented balance.</h1><p className="page-subtitle">Manual intake stays separate from active energy. Missing values remain missing.</p></div></div><div className="metric-grid">{[["Energy intake",nutrition?.energyIntakeKcal,"kcal"],["Protein",nutrition?.proteinGrams,"g"],["Carbohydrate",nutrition?.carbohydrateGrams,"g"]].map(([label,value,unit]) => <div className="metric-card" key={String(label)}><span className="metric-label">{label}</span><div><strong className="section-title">{value ?? "—"}</strong> <span className="muted small">{value === undefined ? "not entered" : unit}</span></div><p className="metric-baseline">Today’s manual entry.</p></div>)}</div><div style={{ marginTop: 22 }}><NutritionEditor localDate={localDate} initial={latest}/></div><div className="card" style={{ marginTop: 22 }}><span className="eyebrow">Food search</span><h2 className="section-title">Deferred for this release</h2><p className="muted">Named foods can be entered manually through the API contract; no fake catalogue or unverified restriction lookup is shown.</p></div></div>;
}
