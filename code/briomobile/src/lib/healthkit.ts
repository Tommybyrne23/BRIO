import * as SecureStore from "expo-secure-store";
import {
  queryQuantitySamplesWithAnchor,
  queryCategorySamplesWithAnchor,
  type QuantityTypeIdentifier,
  type CategoryTypeIdentifier,
} from "@kingstinct/react-native-healthkit";
import { authClient } from "@/lib/auth-client";

const QUANTITY_TYPES: { identifier: QuantityTypeIdentifier; unit: string; signal: string }[] = [
  { identifier: "HKQuantityTypeIdentifierStepCount", unit: "count", signal: "health_steps" },
  { identifier: "HKQuantityTypeIdentifierActiveEnergyBurned", unit: "kcal", signal: "health_active_energy" },
  { identifier: "HKQuantityTypeIdentifierHeartRate", unit: "count/min", signal: "health_heart_rate" },
];
const CATEGORY_TYPES: { identifier: CategoryTypeIdentifier; signal: string }[] = [
  { identifier: "HKCategoryTypeIdentifierSleepAnalysis", signal: "health_sleep" },
];
export const HEALTHKIT_READ_IDENTIFIERS = [...QUANTITY_TYPES.map((type) => type.identifier), ...CATEGORY_TYPES.map((type) => type.identifier)];

function sanitize(value: string) { return value.replace(/[^\w.-]/g, "_"); }
function anchorKey(userId: string, identifier: string) { return `briomobile_hk_anchor_${sanitize(process.env.EXPO_PUBLIC_API_URL ?? "unknown")}_${sanitize(userId)}_${identifier}`; }
async function getAnchor(userId: string, identifier: string) { return (await SecureStore.getItemAsync(anchorKey(userId, identifier))) ?? undefined; }
async function setAnchor(userId: string, identifier: string, anchor: string) { await SecureStore.setItemAsync(anchorKey(userId, identifier), anchor); }

async function allowedSignals() {
  const { data, error } = await authClient.$fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/consent`, { method: "GET" });
  if (error) throw new Error(error.message ?? "Consent could not be checked");
  const snapshot = data as { consent?: { signals?: { signal: string; enabled: boolean }[] } };
  return new Set((snapshot.consent?.signals ?? []).filter((signal) => signal.enabled).map((signal) => signal.signal));
}

type OutgoingSample = { externalId: string; sampleType: string; value: number; unit: string | null; startDate: string; endDate: string; sourceName: string | null };
async function pushSamples(samples: OutgoingSample[]) {
  if (samples.length === 0) return 0;
  const { data, error } = await authClient.$fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/health-samples`, { method: "POST", body: { samples } });
  if (error) throw new Error(error.message ?? error.statusText ?? "Sample request failed");
  return Number((data as { acceptedCount?: number }).acceptedCount ?? samples.length);
}
async function pushDeletions(externalIds: string[]) {
  if (externalIds.length === 0) return;
  const { error } = await authClient.$fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/health-samples/deletions`, { method: "POST", body: { externalIds } });
  if (error) throw new Error(error.message ?? error.statusText ?? "Deletion reconciliation failed");
}

async function syncQuantityType(userId: string, identifier: QuantityTypeIdentifier, unit: string) {
  const result = await queryQuantitySamplesWithAnchor(identifier, { anchor: await getAnchor(userId, identifier), limit: 0, unit });
  const samples: OutgoingSample[] = result.samples.map((sample) => ({ externalId: sample.uuid, sampleType: identifier, value: sample.quantity, unit: sample.unit, startDate: sample.startDate.toISOString(), endDate: sample.endDate.toISOString(), sourceName: sample.sourceRevision?.source?.name ?? null }));
  await pushDeletions(result.deletedSamples.map((sample) => sample.uuid));
  const accepted = await pushSamples(samples);
  await setAnchor(userId, identifier, result.newAnchor);
  return accepted;
}
async function syncCategoryType(userId: string, identifier: CategoryTypeIdentifier) {
  const result = await queryCategorySamplesWithAnchor(identifier, { anchor: await getAnchor(userId, identifier), limit: 0 });
  const samples: OutgoingSample[] = result.samples.map((sample) => ({ externalId: sample.uuid, sampleType: identifier, value: sample.value, unit: null, startDate: sample.startDate.toISOString(), endDate: sample.endDate.toISOString(), sourceName: sample.sourceRevision?.source?.name ?? null }));
  await pushDeletions(result.deletedSamples.map((sample) => sample.uuid));
  const accepted = await pushSamples(samples);
  await setAnchor(userId, identifier, result.newAnchor);
  return accepted;
}

export async function syncHealthKitData(userId: string): Promise<{ pushed: number; skipped: number; errors: string[] }> {
  const allowed = await allowedSignals();
  let pushed = 0; let skipped = 0; const errors: string[] = [];
  for (const { identifier, unit, signal } of QUANTITY_TYPES) {
    if (!allowed.has(signal)) { skipped += 1; continue; }
    try { pushed += await syncQuantityType(userId, identifier, unit); } catch (error) { errors.push(`${identifier}: ${error instanceof Error ? error.message : "sync failed"}`); }
  }
  for (const { identifier, signal } of CATEGORY_TYPES) {
    if (!allowed.has(signal)) { skipped += 1; continue; }
    try { pushed += await syncCategoryType(userId, identifier); } catch (error) { errors.push(`${identifier}: ${error instanceof Error ? error.message : "sync failed"}`); }
  }
  return { pushed, skipped, errors };
}
