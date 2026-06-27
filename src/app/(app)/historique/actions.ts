"use server";

import { db } from "@/db";
import { activityEvents, profiles, candidates } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth";

export type EventRow = {
  id: string;
  actionType: string;
  summary: string;
  createdAt: string;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  candidateId: string | null;
  candidateFirstName: string | null;
  candidateLastName: string | null;
};

const PAGE_SIZE = 50;

export async function loadEvents({
  offset = 0,
  filterType = "",
  filterActor = "",
  filterCandidat = "",
}: {
  offset?: number;
  filterType?: string;
  filterActor?: string;
  filterCandidat?: string;
}): Promise<EventRow[]> {
  await requireRole("admin", "direction");

  const conditions = [];
  if (filterType) conditions.push(eq(activityEvents.actionType, filterType));
  if (filterActor) conditions.push(eq(activityEvents.actorId, filterActor));
  if (filterCandidat) conditions.push(eq(activityEvents.candidateId, filterCandidat));

  const rows = await db
    .select({
      id: activityEvents.id,
      actionType: activityEvents.actionType,
      summary: activityEvents.summary,
      createdAt: activityEvents.createdAt,
      actorId: activityEvents.actorId,
      actorName: profiles.fullName,
      actorEmail: profiles.email,
      candidateId: activityEvents.candidateId,
      candidateFirstName: candidates.firstName,
      candidateLastName: candidates.lastName,
    })
    .from(activityEvents)
    .leftJoin(profiles, eq(activityEvents.actorId, profiles.id))
    .leftJoin(candidates, eq(activityEvents.candidateId, candidates.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(activityEvents.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    actorName: r.actorName || null,
    actorEmail: r.actorEmail || null,
    candidateFirstName: r.candidateFirstName || null,
    candidateLastName: r.candidateLastName || null,
  }));
}

export async function getActors(): Promise<{ id: string; name: string }[]> {
  await requireRole("admin", "direction");

  const rows = await db
    .select({ id: profiles.id, fullName: profiles.fullName, email: profiles.email })
    .from(profiles)
    .orderBy(profiles.fullName);

  return rows.map((r) => ({ id: r.id, name: r.fullName || r.email }));
}
