import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const healthSamples = pgTable(
  "health_samples",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Mirrors HealthKit's HKSampleType identifier string, e.g.
    // "HKQuantityTypeIdentifierStepCount", "HKCategoryTypeIdentifierSleepAnalysis".
    // Kept as free text (not an enum) so new HK types don't require a migration.
    sampleType: text("sample_type").notNull(),

    // Numeric value for quantity samples; category samples' integer enum code
    // also fits here (e.g. HKCategoryValueSleepAnalysis.asleep = 1).
    value: doublePrecision("value").notNull(),

    // Unit string for quantity samples (e.g. "count", "kcal", "count/min").
    // Null for category samples, which have no unit.
    unit: text("unit"),

    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),

    // Originating device/app, e.g. "iPhone", "Apple Watch".
    sourceName: text("source_name"),

    // Catch-all for the rest of HealthKit's per-sample metadata dict
    // (e.g. HKMetadataKeyWasUserEntered, device info) so new fields don't
    // require a schema migration.
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("health_samples_user_type_start_idx").on(
      table.userId,
      table.sampleType,
      table.startDate,
    ),
  ],
);
