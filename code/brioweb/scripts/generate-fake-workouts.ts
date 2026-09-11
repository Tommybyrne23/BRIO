// Fabricates plausible workout history for one user. Manual/dev-only — never
// wired into briomobile or run automatically in production.
//
// Usage: npm run generate:fake-workouts -- --email you@example.com --days 90
import { resolveUserIdFromArgs } from "./lib/resolve-user";
import { insertWorkouts } from "@/db/queries/workouts";

const WORKOUT_TYPES = ["run", "walk", "cycle", "strength", "swim", "hiit", "yoga"] as const;
type WorkoutType = (typeof WORKOUT_TYPES)[number];

const PROFILE: Record<WorkoutType, { durationMin: [number, number]; distanceKmPerMin: number | null; hr: [number, number]; kcalPerMin: number }> = {
  run: { durationMin: [25, 55], distanceKmPerMin: 0.16, hr: [140, 172], kcalPerMin: 11 },
  walk: { durationMin: [20, 60], distanceKmPerMin: 0.08, hr: [95, 120], kcalPerMin: 4.5 },
  cycle: { durationMin: [30, 75], distanceKmPerMin: 0.3, hr: [125, 160], kcalPerMin: 9 },
  strength: { durationMin: [35, 65], distanceKmPerMin: null, hr: [105, 140], kcalPerMin: 7 },
  swim: { durationMin: [25, 50], distanceKmPerMin: 0.055, hr: [120, 155], kcalPerMin: 10 },
  hiit: { durationMin: [20, 40], distanceKmPerMin: null, hr: [150, 180], kcalPerMin: 13 },
  yoga: { durationMin: [30, 60], distanceKmPerMin: null, hr: [80, 105], kcalPerMin: 3.5 },
};

function randomInRange([min, max]: [number, number]) {
  return min + Math.random() * (max - min);
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function main() {
  const { userId, days } = await resolveUserIdFromArgs();
  const rows: Parameters<typeof insertWorkouts>[0] = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let daysAgo = 0; daysAgo < days; daysAgo++) {
    // ~5 workouts/week on average.
    if (Math.random() > 5 / 7) continue;

    const workoutType = pick(WORKOUT_TYPES);
    const profile = PROFILE[workoutType];
    const durationMinutes = randomInRange(profile.durationMin);
    const durationSeconds = Math.round(durationMinutes * 60);

    const dayStart = now - daysAgo * dayMs;
    const hourOfDay = Math.random() < 0.6 ? randomInRange([6, 9]) : randomInRange([17, 20]);
    const startDate = new Date(dayStart);
    startDate.setHours(Math.floor(hourOfDay), Math.floor((hourOfDay % 1) * 60), 0, 0);
    const endDate = new Date(startDate.getTime() + durationSeconds * 1000);

    const avgHeartRate = Math.round(randomInRange(profile.hr));
    const maxHeartRate = Math.round(avgHeartRate + randomInRange([5, 20]));

    rows.push({
      userId,
      workoutType,
      startDate,
      endDate,
      durationSeconds,
      distanceMeters: profile.distanceKmPerMin ? Math.round(profile.distanceKmPerMin * durationMinutes * 1000) : null,
      activeEnergyKcal: Math.round(profile.kcalPerMin * durationMinutes),
      avgHeartRate,
      maxHeartRate,
      perceivedExertion: Math.round(randomInRange([4, 9])),
      sourceName: "synthetic-generator",
      externalId: null,
      metadata: null,
    });
  }

  const inserted = await insertWorkouts(rows);
  console.log(`Inserted ${inserted.length} fake workouts for user ${userId} over the last ${days} days.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
