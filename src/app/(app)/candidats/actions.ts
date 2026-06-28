"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { candidates, profiles, tasks } from "@/db/schema";
import { eq, isNull, and, asc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type CandidatRow = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  cursusEnvisage: string | null;
  ownerId: string | null;
  ownerName: string | null;
  nextTaskAt: string | null;
  updatedAt: string;
  isInactive: boolean;
  nextTaskOverdue: boolean;
};

export async function loadPipelineCandidates(): Promise<CandidatRow[]> {
  await requireAuth();

  const rows = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      status: candidates.status,
      cursusEnvisage: candidates.cursusEnvisage,
      ownerId: candidates.ownerId,
      ownerName: profiles.fullName,
      updatedAt: candidates.updatedAt,
    })
    .from(candidates)
    .leftJoin(profiles, eq(candidates.ownerId, profiles.id))
    .where(isNull(candidates.deletedAt))
    .orderBy(asc(candidates.firstName));

  if (rows.length === 0) return [];

  const candidateIds = rows.map((r) => r.id);

  const nextTaskRows = await db
    .select({ candidateId: tasks.candidateId, dueAt: tasks.dueAt })
    .from(tasks)
    .where(
      and(
        inArray(tasks.candidateId, candidateIds),
        isNull(tasks.completedAt),
        isNull(tasks.deletedAt),
      )
    )
    .orderBy(asc(tasks.dueAt));

  const nextTaskMap = new Map<string, string>();
  for (const t of nextTaskRows) {
    if (t.candidateId && !nextTaskMap.has(t.candidateId)) {
      nextTaskMap.set(t.candidateId, t.dueAt.toISOString());
    }
  }

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  return rows.map((r) => {
    const nextTaskAt = nextTaskMap.get(r.id) ?? null;
    const updatedAt = r.updatedAt.toISOString();
    const inactive =
      r.updatedAt < twoDaysAgo &&
      (!nextTaskAt || new Date(nextTaskAt) < new Date());
    return {
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      status: r.status,
      cursusEnvisage: r.cursusEnvisage ?? null,
      ownerId: r.ownerId ?? null,
      ownerName: r.ownerName ?? null,
      nextTaskAt,
      updatedAt,
      isInactive: inactive,
      nextTaskOverdue: !!nextTaskAt && new Date(nextTaskAt) < new Date(),
    };
  });
}

export async function updateCandidateStatus(id: string, status: string, lostReason?: string) {
  await requireAuth();
  await db
    .update(candidates)
    .set({
      status: status as never,
      updatedAt: new Date(),
      ...(lostReason !== undefined ? { lostReason } : {}),
    })
    .where(eq(candidates.id, id));
  revalidatePath("/candidats");
}
