import type { Metadata } from "next";
import { requireUser } from "@/db/auth-dal";
import { getConsentForUser, getPreferencesForUser } from "@/db/queries/product-state";
import { OnboardingFlow } from "@/components/onboarding-flow";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const [preferences, consent] = await Promise.all([getPreferencesForUser(user.id), getConsentForUser(user.id)]);
  return <OnboardingFlow initialPreferences={preferences} initialConsent={consent} />;
}
