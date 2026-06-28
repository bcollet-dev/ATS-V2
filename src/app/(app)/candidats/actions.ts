"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { candidates, profiles, tasks, matchings, needs, companies } from "@/db/schema";
import { eq, isNull, and, asc, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { syncNeedStatusFromMatchings } from "@/app/(app)/matching/actions";

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
  needMatchings: Array<{ matchingId: string; needId: string; needTitle: string; propositionStatus: string; isFrozen: boolean }>;
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

  const [nextTaskRows, matchingRows] = await Promise.all([
    db
      .select({ candidateId: tasks.candidateId, dueAt: tasks.dueAt })
      .from(tasks)
      .where(
        and(
          inArray(tasks.candidateId, candidateIds),
          isNull(tasks.completedAt),
          isNull(tasks.deletedAt),
        )
      )
      .orderBy(asc(tasks.dueAt)),
    db
      .select({
        candidateId: matchings.candidateId,
        matchingId: matchings.id,
        needId: matchings.needId,
        needTitle: needs.title,
        propositionStatus: matchings.propositionStatus,
        isFrozen: matchings.isFrozen,
      })
      .from(matchings)
      .innerJoin(needs, eq(matchings.needId, needs.id))
      .where(
        and(
          inArray(matchings.candidateId, candidateIds),
          notInArray(matchings.propositionStatus, ["not_retained"]),
        )
      )
      .orderBy(asc(matchings.createdAt)),
  ]);

  const nextTaskMap = new Map<string, string>();
  for (const t of nextTaskRows) {
    if (t.candidateId && !nextTaskMap.has(t.candidateId)) {
      nextTaskMap.set(t.candidateId, t.dueAt.toISOString());
    }
  }

  const needMatchingsByCandidate = new Map<string, Array<{ matchingId: string; needId: string; needTitle: string; propositionStatus: string; isFrozen: boolean }>>();
  for (const r of matchingRows) {
    const cid = r.candidateId as string;
    if (!needMatchingsByCandidate.has(cid)) needMatchingsByCandidate.set(cid, []);
    needMatchingsByCandidate.get(cid)!.push({ matchingId: r.matchingId, needId: r.needId, needTitle: r.needTitle, propositionStatus: r.propositionStatus, isFrozen: r.isFrozen });
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
      needMatchings: needMatchingsByCandidate.get(r.id) ?? [],
    };
  });
}

export async function updateCandidatCursus(id: string, cursusEnvisage: string) {
  await requireAuth();
  await db
    .update(candidates)
    .set({ cursusEnvisage: cursusEnvisage || null, updatedAt: new Date() })
    .where(eq(candidates.id, id));
  revalidatePath("/candidats");
}

export async function updateCandidatOwner(id: string, ownerId: string | null) {
  await requireAuth();
  await db
    .update(candidates)
    .set({ ownerId: ownerId || null, updatedAt: new Date() })
    .where(eq(candidates.id, id));
  revalidatePath("/candidats");
}

const ARCHIVE_STATUSES = new Set(["temporary_refusal", "definitive_refusal"]);

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

  if (ARCHIVE_STATUSES.has(status)) {
    const refusalReason = status === "definitive_refusal" ? "Refus définitif" : "Refus temporaire";

    // Get all active matchings for this candidate (not already not_retained)
    const activeMatchings = await db
      .select({ id: matchings.id, needId: matchings.needId })
      .from(matchings)
      .where(
        and(
          eq(matchings.candidateId, id),
          notInArray(matchings.propositionStatus, ["not_retained"])
        )
      );

    if (activeMatchings.length > 0) {
      await db
        .update(matchings)
        .set({ propositionStatus: "not_retained", refusalReason, updatedAt: new Date() })
        .where(inArray(matchings.id, activeMatchings.map((m) => m.id)));

      // Re-sync each affected besoin's status
      const needIds = [...new Set(activeMatchings.map((m) => m.needId as string))];
      await Promise.all(needIds.map(syncNeedStatusFromMatchings));

      revalidatePath("/besoins");
    }
  }

  revalidatePath("/candidats");
}
