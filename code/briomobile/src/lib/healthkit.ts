import * as SecureStore from "expo-secure-store";
import {
  queryQuantitySamplesWithAnchor,
  queryCategorySamplesWithAnchor,
  type QuantityTypeIdentifier,
  type CategoryTypeIdentifier,
} from "@kingstinct/react-native-healthkit";
import { authClient } from "@/lib/auth-client";

const QUANTITY_TYPES: { identifier: QuantityTypeIdentifier; unit: string }[] = [
  { identifier: "HKQuantityTypeIdentifierStepCount", unit: "count" },
  { identifier: "HKQuantityTypeIdentifierActiveEnergyBurned", unit: "kcal" },
  { identifier: "HKQuantityTypeIdentifierHeartRate", unit: "count/min" },
];

const CATEGORY_TYPES: CategoryTypeIdentifier[] = ["HKCategoryTypeIdentifierSleepAnalysis"];

// Shared with index.tsx's useHealthkitAuthorization({ toRead: HEALTHKIT_READ_IDENTIFIERS }).
export const HEALTHKIT_READ_IDENTIFIERS = [
  ...QUANTITY_TYPES.map((t) => t.identifier),
  ...CATEGORY_TYPES,
];

const ANCHOR_KEY_PREFIX = "briomobile_hk_anchor_";

async function getAnchor(identifier: string) {
  return (await SecureStore.getItemAsync(`${ANCHOR_KEY_PREFIX}${identifier}`)) ?? undefined;
}

async function setAnchor(identifier: string, anchor: string) {
  await SecureStore.setItemAsync(`${ANCHOR_KEY_PREFIX}${identifier}`, anchor);
}

type OutgoingSample = {
  externalId: string;
  sampleType: string;
  value: number;
  unit: string | null;
  startDate: string;
  endDate: string;
  sourceName: string | null;
};

async function pushSamples(samples: OutgoingSample[]) {
  if (samples.length === 0) return;
  const { error } = await authClient.$fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/api/health-samples`,
    { method: "POST", body: { samples } },
  );
  if (error) {
    throw new Error(error.message ?? error.statusText ?? "Request failed");
  }
}

async function syncQuantityType(identifier: QuantityTypeIdentifier, unit: string) {
  const anchor = await getAnchor(identifier);
  const result = await queryQuantitySamplesWithAnchor(identifier, { anchor, limit: 0, unit });

  const samples: OutgoingSample[] = result.samples.map((sample) => ({
    externalId: sample.uuid,
    sampleType: identifier,
    value: sample.quantity,
    unit: sample.unit,
    startDate: sample.startDate.toISOString(),
    endDate: sample.endDate.toISOString(),
    sourceName: sample.sourceRevision?.source?.name ?? null,
  }));

  await pushSamples(samples);
  await setAnchor(identifier, result.newAnchor);
  return samples.length;
}

async function syncCategoryType(identifier: CategoryTypeIdentifier) {
  const anchor = await getAnchor(identifier);
  const result = await queryCategorySamplesWithAnchor(identifier, { anchor, limit: 0 });

  const samples: OutgoingSample[] = result.samples.map((sample) => ({
    externalId: sample.uuid,
    sampleType: identifier,
    value: sample.value,
    unit: null,
    startDate: sample.startDate.toISOString(),
    endDate: sample.endDate.toISOString(),
    sourceName: sample.sourceRevision?.source?.name ?? null,
  }));

  await pushSamples(samples);
  await setAnchor(identifier, result.newAnchor);
  return samples.length;
}

export async function syncHealthKitData(): Promise<{ pushed: number; errors: string[] }> {
  let pushed = 0;
  const errors: string[] = [];

  for (const { identifier, unit } of QUANTITY_TYPES) {
    try {
      pushed += await syncQuantityType(identifier, unit);
    } catch (err) {
      errors.push(`${identifier}: ${err instanceof Error ? err.message : "sync failed"}`);
    }
  }

  for (const identifier of CATEGORY_TYPES) {
    try {
      pushed += await syncCategoryType(identifier);
    } catch (err) {
      errors.push(`${identifier}: ${err instanceof Error ? err.message : "sync failed"}`);
    }
  }

  return { pushed, errors };
}
