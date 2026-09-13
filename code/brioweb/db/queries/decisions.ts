import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { decisionEvents, decisions, userPreferences } from "@/db/schema";
import {
  DecisionResponseSchema,
  DecisionSchema,
  type Decision,
  type DecisionResponse,
} from "@/lib/contracts";
import { ConflictError, NotFoundError } from "./errors";

function iso(value: Date | string) {
  return new Date(value).toISOString();
}

function decisionFromRow(row: typeof decisions.$inferSelect): Decision {
  return DecisionSchema.parse({
    ...(row.payload as object),
    id: row.id,
    status: row.status,
    action: row.action,
    inputDataMode: row.inputDataMode,
    executionMode: row.executionMode,
    consentVersion: row.consentVersion,
    generatedAt: iso(row.generatedAt),
    staleAt: row.staleAt ? iso(row.staleAt) : null,
  });
}

function eventFromRow(row: typeof decisionEvents.$inferSelect): DecisionResponse {
  return DecisionResponseSchema.parse({
    ...(row.payload as object),
    decisionId: row.decisionId,
    kind: row.kind,
    selectedAction: row.selectedAction,
    mutationId: row.mutationId,
    consentVersion: row.consentVersion,
    respondedAt: iso(row.respondedAt),
  });
}

export async function listDecisionsForUser(userId: string, limit = 50) {
  const rows = await db.select().from(decisions).where(eq(decisions.userId, userId))
    .orderBy(desc(decisions.generatedAt)).limit(limit);
  return rows.map(decisionFromRow);
}

export async function getCurrentDecisionForUser(userId: string) {
  const [row] = await db.select().from(decisions).where(and(
    eq(decisions.userId, userId),
    eq(decisions.status, "proposed"),
  )).orderBy(desc(decisions.generatedAt)).limit(1);
  return row ? decisionFromRow(row) : null;
}

export async function getLatestDecisionForUser(userId: string) {
  const [row] = await db.select().from(decisions).where(eq(decisions.userId, userId))
    .orderBy(desc(decisions.generatedAt)).limit(1);
  return row ? decisionFromRow(row) : null;
}

export async function saveDecisionForUser(userId: string, decision: Decision) {
  const [preferences] = await db.select().from(userPreferences)
    .where(eq(userPreferences.userId, userId)).limit(1);
  if (!preferences || preferences.accountStatus !== "active") throw new ConflictError("Account is not eligible for decisions");
  if (preferences.consentVersion !== decision.consentVersion) throw new ConflictError("Consent changed while decision was generated");

  const [row] = await db.insert(decisions).values({
    id: decision.id,
    userId,
    status: decision.status,
    action: decision.action,
    inputDataMode: decision.inputDataMode,
    executionMode: decision.executionMode,
    payload: decision,
    consentVersion: decision.consentVersion,
    generatedAt: new Date(decision.generatedAt),
    staleAt: decision.staleAt ? new Date(decision.staleAt) : null,
  }).onConflictDoNothing().returning();
  if (row) return decisionFromRow(row);

  const [existing] = await db.select().from(decisions)
    .where(and(eq(decisions.userId, userId), eq(decisions.id, decision.id))).limit(1);
  if (!existing) throw new ConflictError("Decision ID belongs to another account");
  return decisionFromRow(existing);
}

export async function respondToDecisionForUser(userId: string, event: DecisionResponse) {
  return db.transaction(async (tx) => {
    const [duplicate] = await tx.select().from(decisionEvents)
      .where(and(eq(decisionEvents.userId, userId), eq(decisionEvents.mutationId, event.mutationId))).limit(1);
    if (duplicate) return eventFromRow(duplicate);

    const [decision] = await tx.select().from(decisions)
      .where(and(eq(decisions.userId, userId), eq(decisions.id, event.decisionId))).limit(1);
    if (!decision) throw new NotFoundError("Decision not found");
    if (decision.status !== "proposed") throw new ConflictError("Decision is no longer current");

    const [preferences] = await tx.select().from(userPreferences)
      .where(eq(userPreferences.userId, userId)).limit(1);
    if (!preferences || preferences.consentVersion !== event.consentVersion || decision.consentVersion !== event.consentVersion) {
      throw new ConflictError("Consent changed before the response was saved");
    }

    const [created] = await tx.insert(decisionEvents).values({
      userId,
      decisionId: event.decisionId,
      kind: event.kind,
      selectedAction: event.selectedAction,
      payload: event,
      mutationId: event.mutationId,
      consentVersion: event.consentVersion,
      respondedAt: new Date(event.respondedAt),
    }).returning();

    await tx.update(decisions).set({
      status: event.kind,
      updatedAt: new Date(),
    }).where(and(eq(decisions.userId, userId), eq(decisions.id, event.decisionId)));

    return eventFromRow(created);
  });
}

export async function listDecisionEventsForUser(userId: string, limit = 100) {
  const rows = await db.select().from(decisionEvents).where(eq(decisionEvents.userId, userId))
    .orderBy(desc(decisionEvents.respondedAt)).limit(limit);
  return rows.map(eventFromRow);
}
