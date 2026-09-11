// Fabricates plausible sleep + heart rate history for one user, written into
// the existing health_samples table using the same sampleTypes briomobile's
// HealthKit sync already uses. Manual/dev-only — never wired into briomobile
// or run automatically in production. Real sleep/HR data (once HealthKit
// actually produces it) lands alongside these rows with no conflict.
//
// Usage: npm run generate:fake-sleep -- --email you@example.com --days 90
import { resolveUserIdFromArgs } from "./lib/resolve-user";
import { insertHealthSamples } from "@/db/queries/health-samples";

const SLEEP_SAMPLE_TYPE = "HKCategoryTypeIdentifierSleepAnalysis";
const HEART_RATE_SAMPLE_TYPE = "HKQuantityTypeIdentifierHeartRate";
const ASLEEP_UNSPECIFIED = 1; // HKCategoryValueSleepAnalysis.asleepUnspecified

function randomInRange([min, max]: [number, number]) {
  return min + Math.random() * (max - min);
}

async function main() {
  const { userId, days } = await resolveUserIdFromArgs();
  const rows: Parameters<typeof insertHealthSamples>[0] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let daysAgo = 0; daysAgo < days; daysAgo++) {
    const dayStart = now - daysAgo * dayMs;

    // --- Sleep: one segment per night, bedtime the evening before. ---
    const isRoughNight = Math.random() < 0.15; // occasional short/irregular night
    // Rough nights push bedtime past midnight (0-2am, "today") instead of
    // late evening (22-23.5, "yesterday") — kept as two separate ranges
    // rather than one wrapping range to avoid sweeping through the whole day.
    const bedtimeIsPastMidnight = isRoughNight && Math.random() < 0.5;
    const bedHour = bedtimeIsPastMidnight ? randomInRange([0, 2]) : isRoughNight ? randomInRange([23.5, 23.99]) : randomInRange([22, 23.5]);
    const sleepHours = isRoughNight ? randomInRange([3.5, 5.5]) : randomInRange([6.5, 8.5]);

    const bedtime = new Date(bedtimeIsPastMidnight ? dayStart : dayStart - dayMs);
    bedtime.setHours(Math.floor(bedHour), Math.round((bedHour % 1) * 60), 0, 0);
    const wakeTime = new Date(bedtime.getTime() + sleepHours * 60 * 60 * 1000);

    rows.push({
      userId,
      externalId: null,
      sampleType: SLEEP_SAMPLE_TYPE,
      value: ASLEEP_UNSPECIFIED,
      unit: null,
      startDate: bedtime,
      endDate: wakeTime,
      sourceName: "synthetic-generator",
      metadata: null,
    });

    // --- Heart rate: hourly samples through waking hours. ---
    for (let hour = 7; hour <= 22; hour++) {
      const sampleTime = new Date(dayStart);
      sampleTime.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
      const isActiveWindow = hour >= 17 && hour <= 19 && Math.random() < 0.4;
      const bpm = Math.round(isActiveWindow ? randomInRange([110, 165]) : randomInRange([58, 88]));

      rows.push({
        userId,
        externalId: null,
        sampleType: HEART_RATE_SAMPLE_TYPE,
        value: bpm,
        unit: "count/min",
        startDate: sampleTime,
        endDate: sampleTime,
        sourceName: "synthetic-generator",
        metadata: null,
      });
    }
  }

  const inserted = await insertHealthSamples(rows);
  console.log(
    `Inserted ${inserted.length} fake sleep/heart-rate samples for user ${userId} over the last ${days} days.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
