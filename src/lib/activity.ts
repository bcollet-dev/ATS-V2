"use server";

import { db } from "@/db";
import { activityEvents } from "@/db/schema";

export async function logActivityEvent({
  needId,
  candidateId,
  companyId,
  matchingId,
  actorId,
  actionType,
  summary,
  metadata,
}: {
  needId?: string;
  candidateId?: string;
  companyId?: string;
  matchingId?: string;
  actorId: string;
  actionType: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(activityEvents).values({
    needId: needId ?? null,
    candidateId: candidateId ?? null,
    companyId: companyId ?? null,
    matchingId: matchingId ?? null,
    actorId,
    actionType,
    summary,
    metadata: metadata ?? null,
  });
}
