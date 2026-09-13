import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  agentInsights,
  dailyCheckIns,
  decisions,
  manualLogs,
  signalConsents,
  userPreferences,
} from "@/db/schema";
import {
  ConsentSnapshotSchema,
  DailyCheckInSchema,
  ManualLogSchema,
  PreferencesSchema,
  SignalKeySchema,
  createDefaultConsentSnapshot,
  type ConsentSnapshot,
  type DailyCheckIn,
  type ManualLog,
  type Preferences,
} from "@/lib/contracts";
import { ConflictError } from "./errors";

const DEFAULT_MUTATION_ID = "system-initial-state";

function iso(value: Date | string) {
  return new Date(value).toISOString();
}

function preferencesFromRow(row: typeof userPreferences.$inferSelect): Preferences {
  return PreferencesSchema.parse({
    schemaVersion: "1.0.0",
    timezone: row.timezone,
    goal: row.goal,
    trainingBlock: row.trainingBlock,
    usageMode: row.usageMode,
    restrictionText: row.restrictionText,
    restrictions: row.restrictions,
    profile: row.profile,
    onboardingCompleted: row.onboardingCompleted,
    revision: row.revision,
    mutationId: row.mutationId,
    updatedAt: iso(row.updatedAt),
  });
}

async function ensurePreferences(
  userId: string,
  executor: Pick<typeof db, "insert" | "select"> = db,
) {
  await executor.insert(userPreferences).values({
    userId,
    mutationId: DEFAULT_MUTATION_ID,
  }).onConflictDoNothing();
  const [row] = await executor.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  if (!row) throw new Error("Unable to initialize preferences");
  return row;
}

async function ensureConsentRows(
  userId: string,
  consentVersion: number,
  executor: Pick<typeof db, "insert"> = db,
) {
  const timestamp = new Date().toISOString();
  const defaults = createDefaultConsentSnapshot(timestamp);
  await executor.insert(signalConsents).values(defaults.signals.map((signal) => ({
    userId,
    signal: signal.signal,
    purpose: signal.purpose,
    sourceLabel: signal.sourceLabel,
    enabled: false,
    consentVersion,
    changedAt: new Date(signal.changedAt),
  }))).onConflictDoNothing();
}

export async function getPreferencesForUser(userId: string) {
  return preferencesFromRow(await ensurePreferences(userId));
}

export async function updatePreferencesForUser(
  userId: string,
  patch: Omit<Partial<Preferences>, "updatedAt"> & Pick<Preferences, "revision" | "mutationId">,
) {
  const current = await ensurePreferences(userId);
  if (current.mutationId === patch.mutationId) return preferencesFromRow(current);
  if (current.revision !== patch.revision) throw new ConflictError("Preferences changed on another client");

  const [updated] = await db.update(userPreferences).set({
    ...(patch.timezone === undefined ? {} : { timezone: patch.timezone }),
    ...(patch.goal === undefined ? {} : { goal: patch.goal }),
    ...(patch.trainingBlock === undefined ? {} : { trainingBlock: patch.trainingBlock }),
    ...(patch.usageMode === undefined ? {} : { usageMode: patch.usageMode }),
    ...(patch.restrictionText === undefined ? {} : { restrictionText: patch.restrictionText }),
    ...(patch.restrictions === undefined ? {} : { restrictions: patch.restrictions }),
    ...(patch.profile === undefined ? {} : { profile: patch.profile }),
    ...(patch.onboardingCompleted === undefined ? {} : { onboardingCompleted: patch.onboardingCompleted }),
    mutationId: patch.mutationId,
    revision: sql`${userPreferences.revision} + 1`,
    updatedAt: new Date(),
  }).where(and(eq(userPreferences.userId, userId), eq(userPreferences.revision, patch.revision))).returning();

  if (!updated) throw new ConflictError("Preferences changed on another client");
  return preferencesFromRow(updated);
}

export async function getConsentForUser(userId: string): Promise<ConsentSnapshot> {
  const preferences = await ensurePreferences(userId);
  await ensureConsentRows(userId, preferences.consentVersion);
  const rows = await db.select().from(signalConsents)
    .where(eq(signalConsents.userId, userId))
    .orderBy(signalConsents.signal);

  return ConsentSnapshotSchema.parse({
    schemaVersion: "1.0.0",
    consentVersion: preferences.consentVersion,
    signals: SignalKeySchema.options.map((signal) => {
      const row = rows.find((candidate) => candidate.signal === signal);
      if (!row) throw new Error(`Missing consent row: ${signal}`);
      return {
        signal,
        purpose: row.purpose,
        sourceLabel: row.sourceLabel,
        enabled: row.enabled,
        changedAt: iso(row.changedAt),
      };
    }),
    updatedAt: iso(preferences.updatedAt),
  });
}

export async function updateConsentForUser(
  userId: string,
  input: {
    expectedConsentVersion: number;
    mutationId: string;
    changes: { signal: (typeof SignalKeySchema.options)[number]; enabled: boolean }[];
  },
) {
  return db.transaction(async (tx) => {
    const preferences = await ensurePreferences(userId, tx);
    await ensureConsentRows(userId, preferences.consentVersion, tx);

    if (preferences.mutationId === input.mutationId) return getConsentForUser(userId);
    if (preferences.consentVersion !== input.expectedConsentVersion) {
      throw new ConflictError("Consent changed on another client");
    }

    const nextVersion = preferences.consentVersion + 1;
    const changedAt = new Date();
    for (const change of input.changes) {
      await tx.update(signalConsents).set({
        enabled: change.enabled,
        consentVersion: nextVersion,
        changedAt,
      }).where(and(eq(signalConsents.userId, userId), eq(signalConsents.signal, change.signal)));
    }

    await tx.update(userPreferences).set({
      consentVersion: nextVersion,
      mutationId: input.mutationId,
      updatedAt: changedAt,
    }).where(eq(userPreferences.userId, userId));

    await tx.update(decisions).set({ status: "stale", staleAt: changedAt, updatedAt: changedAt })
      .where(and(eq(decisions.userId, userId), inArray(decisions.status, ["proposed", "escalated"])));
    await tx.update(agentInsights).set({ isCurrent: false })
      .where(and(eq(agentInsights.userId, userId), eq(agentInsights.isCurrent, true)));

    const rows = await tx.select().from(signalConsents)
      .where(eq(signalConsents.userId, userId))
      .orderBy(signalConsents.signal);
    return ConsentSnapshotSchema.parse({
      schemaVersion: "1.0.0",
      consentVersion: nextVersion,
      signals: SignalKeySchema.options.map((signal) => {
        const row = rows.find((candidate) => candidate.signal === signal);
        if (!row) throw new Error(`Missing consent row: ${signal}`);
        return { signal, purpose: row.purpose, sourceLabel: row.sourceLabel, enabled: row.enabled, changedAt: iso(row.changedAt) };
      }),
      updatedAt: changedAt.toISOString(),
    });
  });
}

export async function isSignalEnabled(userId: string, signal: (typeof SignalKeySchema.options)[number]) {
  const consent = await getConsentForUser(userId);
  return consent.signals.some((entry) => entry.signal === signal && entry.enabled);
}

export async function getSignalConsentState(
  userId: string,
  signal: (typeof SignalKeySchema.options)[number],
): Promise<"unset" | "enabled" | "disabled"> {
  const [row] = await db.select({ enabled: signalConsents.enabled }).from(signalConsents)
    .where(and(eq(signalConsents.userId, userId), eq(signalConsents.signal, signal))).limit(1);
  if (!row) return "unset";
  return row.enabled ? "enabled" : "disabled";
}

function checkInFromRow(row: typeof dailyCheckIns.$inferSelect): DailyCheckIn {
  return DailyCheckInSchema.parse({
    schemaVersion: "1.0.0",
    localDate: row.localDate,
    responses: row.responses,
    mutationId: row.mutationId,
    revision: row.revision,
    recordedAt: iso(row.recordedAt),
  });
}

export async function getCheckInForUser(userId: string, localDate: string) {
  const [row] = await db.select().from(dailyCheckIns)
    .where(and(eq(dailyCheckIns.userId, userId), eq(dailyCheckIns.localDate, localDate))).limit(1);
  return row ? checkInFromRow(row) : null;
}

export async function saveCheckInForUser(userId: string, input: DailyCheckIn) {
  const existing = await getCheckInForUser(userId, input.localDate);
  if (existing?.mutationId === input.mutationId) return existing;
  if (existing && existing.revision !== input.revision) throw new ConflictError("Check-in changed on another client");

  const [row] = await db.insert(dailyCheckIns).values({
    userId,
    localDate: input.localDate,
    responses: input.responses,
    revision: input.revision,
    mutationId: input.mutationId,
    recordedAt: new Date(input.recordedAt),
  }).onConflictDoUpdate({
    target: [dailyCheckIns.userId, dailyCheckIns.localDate],
    set: {
      responses: input.responses,
      revision: sql`${dailyCheckIns.revision} + 1`,
      mutationId: input.mutationId,
      recordedAt: new Date(input.recordedAt),
      updatedAt: new Date(),
    },
  }).returning();
  return checkInFromRow(row);
}

function manualLogFromRow(row: typeof manualLogs.$inferSelect): ManualLog {
  return ManualLogSchema.parse({ ...(row.payload as object), mutationId: row.mutationId, revision: row.revision, recordedAt: iso(row.recordedAt) });
}

export async function getManualLogForUser(userId: string, localDate: string) {
  const [row] = await db.select().from(manualLogs)
    .where(and(eq(manualLogs.userId, userId), eq(manualLogs.localDate, localDate))).limit(1);
  return row ? manualLogFromRow(row) : null;
}

export async function listManualLogsForUser(userId: string, limit = 31) {
  const rows = await db.select().from(manualLogs).where(eq(manualLogs.userId, userId))
    .orderBy(desc(manualLogs.localDate)).limit(limit);
  return rows.map(manualLogFromRow);
}

export async function saveManualLogForUser(userId: string, input: ManualLog) {
  const existing = await getManualLogForUser(userId, input.localDate);
  if (existing?.mutationId === input.mutationId) return existing;
  if (existing && existing.revision !== input.revision) throw new ConflictError("Manual log changed on another client");
  const payload = { ...input, mutationId: undefined, revision: undefined, recordedAt: undefined };

  const [row] = await db.insert(manualLogs).values({
    userId,
    localDate: input.localDate,
    payload,
    revision: input.revision,
    mutationId: input.mutationId,
    recordedAt: new Date(input.recordedAt),
  }).onConflictDoUpdate({
    target: [manualLogs.userId, manualLogs.localDate],
    set: {
      payload,
      revision: sql`${manualLogs.revision} + 1`,
      mutationId: input.mutationId,
      recordedAt: new Date(input.recordedAt),
      updatedAt: new Date(),
    },
  }).returning();
  return manualLogFromRow(row);
}
