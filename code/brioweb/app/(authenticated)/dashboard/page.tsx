import { redirect } from "next/navigation";
import { requireUser } from "@/db/auth-dal";
import { getDashboardForUser } from "@/db/queries/dashboard";
import { getPreferencesForUser } from "@/db/queries/product-state";
import { LiveTodayWorkspace } from "@/components/live-today-workspace";

function localDateIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function DashboardPage() {
  const user = await requireUser();
  const preferences = await getPreferencesForUser(user.id);
  if (!preferences.onboardingCompleted) redirect("/onboarding");
  const dashboard = await getDashboardForUser(user.id, localDateIn(preferences.timezone));
  return <LiveTodayWorkspace initialDashboard={dashboard}/>;
}
