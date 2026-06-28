"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { matchings, candidates, needs, companies, cursus } from "@/db/schema";
import { eq, isNull, and, asc, notInArray, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MatchingForNeed = {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateCursus: string | null;
  candidateStatus: string;
  propositionStatus: string;
  isWinner: boolean;
  isFrozen: boolean;
  refusalReason: string | null;
  notes: string | null;
  createdAt: string;
};

export type MatchingForCandidate = {
  id: string;
  needId: string;
  needTitle: string;
  companyName: string;
  targetCursusName: string | null;
  needStatus: string;
  propositionStatus: string;
  isWinner: boolean;
  isFrozen: boolean;
  refusalReason: string | null;
  createdAt: string;
};

export type CandidateOption = {
  id: string;
  name: string;
  cursus: string | null;
  status: string;
};

export type NeedOption = {
  id: string;
  title: string;
  companyName: string;
  status: string;
};

// ─── Loaders ─────────────────────────────────────────────────────────────────

export async function loadMatchingsForNeed(needId: string): Promise<MatchingForNeed[]> {
  await requireAuth();
  const rows = await db
    .select({
      id: matchings.id,
      candidateId: matchings.candidateId,
      candidateName: candidates.firstName,
      candidateLastName: candidates.lastName,
      candidateCursus: candidates.cursusEnvisage,
      candidateStatus: candidates.status,
      propositionStatus: matchings.propositionStatus,
      isWinner: matchings.isWinner,
      isFrozen: matchings.isFrozen,
      refusalReason: matchings.refusalReason,
      notes: matchings.notes,
      createdAt: matchings.createdAt,
    })
    .from(matchings)
    .innerJoin(candidates, eq(matchings.candidateId, candidates.id))
    .where(eq(matchings.needId, needId))
    .orderBy(asc(matchings.createdAt));

  return rows.map((r) => ({
    id: r.id,
    candidateId: r.candidateId,
    candidateName: `${r.candidateName} ${r.candidateLastName}`,
    candidateCursus: r.candidateCursus ?? null,
    candidateStatus: r.candidateStatus,
    propositionStatus: r.propositionStatus,
    isWinner: r.isWinner,
    isFrozen: r.isFrozen,
    refusalReason: r.refusalReason ?? null,
    notes: r.notes ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function loadMatchingsForCandidate(candidateId: string): Promise<MatchingForCandidate[]> {
  await requireAuth();
  const rows = await db
    .select({
      id: matchings.id,
      needId: matchings.needId,
      needTitle: needs.title,
      companyName: companies.name,
      targetCursusName: cursus.name,
      needStatus: needs.status,
      propositionStatus: matchings.propositionStatus,
      isWinner: matchings.isWinner,
      isFrozen: matchings.isFrozen,
      refusalReason: matchings.refusalReason,
      createdAt: matchings.createdAt,
    })
    .from(matchings)
    .innerJoin(needs, eq(matchings.needId, needs.id))
    .innerJoin(companies, eq(needs.companyId, companies.id))
    .leftJoin(cursus, eq(needs.targetCursusId, cursus.id))
    .where(eq(matchings.candidateId, candidateId))
    .orderBy(asc(matchings.createdAt));

  return rows.map((r) => ({
    id: r.id,
    needId: r.needId,
    needTitle: r.needTitle,
    companyName: r.companyName ?? "—",
    targetCursusName: r.targetCursusName ?? null,
    needStatus: r.needStatus,
    propositionStatus: r.propositionStatus,
    isWinner: r.isWinner,
    isFrozen: r.isFrozen,
    refusalReason: r.refusalReason ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

// Candidates not yet matched to a specific need
export async function loadAvailableCandidatesForNeed(needId: string): Promise<CandidateOption[]> {
  await requireAuth();
  const alreadyMatched = await db
    .select({ candidateId: matchings.candidateId })
    .from(matchings)
    .where(eq(matchings.needId, needId));

  const excludeIds = alreadyMatched.map((m) => m.candidateId);

  const query = db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      cursusEnvisage: candidates.cursusEnvisage,
      status: candidates.status,
    })
    .from(candidates)
    .where(
      and(
        isNull(candidates.deletedAt),
        ...(excludeIds.length > 0 ? [notInArray(candidates.id, excludeIds)] : [])
      )
    )
    .orderBy(asc(candidates.firstName));

  const rows = await query;
  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`,
    cursus: r.cursusEnvisage ?? null,
    status: r.status,
  }));
}

// Needs not yet matched to a specific candidate
export async function loadAvailableNeedsForCandidate(candidateId: string): Promise<NeedOption[]> {
  await requireAuth();
  const alreadyMatched = await db
    .select({ needId: matchings.needId })
    .from(matchings)
    .where(eq(matchings.candidateId, candidateId));

  const excludeIds = alreadyMatched.map((m) => m.needId);

  const query = db
    .select({
      id: needs.id,
      title: needs.title,
      companyName: companies.name,
      status: needs.status,
    })
    .from(needs)
    .innerJoin(companies, eq(needs.companyId, companies.id))
    .where(
      and(
        isNull(needs.deletedAt),
        ...(excludeIds.length > 0 ? [notInArray(needs.id, excludeIds)] : [])
      )
    )
    .orderBy(asc(needs.title));

  const rows = await query;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    companyName: r.companyName ?? "—",
    status: r.status,
  }));
}

// ─── Auto-sync besoin status ─────────────────────────────────────────────────

// Statuts besoin éligibles au recalcul automatique (les autres sont positionnés manuellement)
const SYNC_ALLOWED_NEED_STATUSES = new Set(["need_in_progress", "interview", "waiting_fre"]);

export async function syncNeedStatusFromMatchings(needId: string): Promise<void> {
  const [needRow] = await db
    .select({ status: needs.status })
    .from(needs)
    .where(eq(needs.id, needId));

  if (!needRow || !SYNC_ALLOWED_NEED_STATUSES.has(needRow.status)) return;

  // If a winner (placed) already exists, don't auto-sync to avoid downgrading the need
  const [winner] = await db
    .select({ id: matchings.id })
    .from(matchings)
    .where(and(eq(matchings.needId, needId), eq(matchings.propositionStatus, "placed")))
    .limit(1);
  if (winner) return;

  // Active propositions: not eliminated, not placed, not frozen
  const actives = await db
    .select({ propositionStatus: matchings.propositionStatus })
    .from(matchings)
    .where(
      and(
        eq(matchings.needId, needId),
        notInArray(matchings.propositionStatus, ["not_retained", "placed"]),
        eq(matchings.isFrozen, false)
      )
    );

  let targetStatus: string;
  if (actives.some((m) => m.propositionStatus === "waiting_fre")) {
    targetStatus = "waiting_fre";
  } else if (actives.some((m) => m.propositionStatus === "interview")) {
    targetStatus = "interview";
  } else {
    targetStatus = "need_in_progress";
  }

  if (targetStatus !== needRow.status) {
    await db
      .update(needs)
      .set({ status: targetStatus as never, updatedAt: new Date() })
      .where(eq(needs.id, needId));
    revalidatePath("/besoins");
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

type CreateResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string };

export async function createMatching(candidateId: string, needId: string): Promise<CreateResult> {
  await requireAuth();
  const existing = await db
    .select({ id: matchings.id })
    .from(matchings)
    .where(and(eq(matchings.candidateId, candidateId), eq(matchings.needId, needId)));
  if (existing.length > 0) return { success: false, error: "Ce candidat est déjà proposé sur ce besoin." };

  const [created] = await db
    .insert(matchings)
    .values({ candidateId, needId })
    .returning({ id: matchings.id });

  revalidatePath("/besoins");
  revalidatePath("/candidats");
  return { success: true, data: created };
}

export async function updateMatchingStatus(
  id: string,
  status: string,
  refusalReason?: string
): Promise<void> {
  await requireAuth();
  await db
    .update(matchings)
    .set({
      propositionStatus: status as never,
      updatedAt: new Date(),
      ...(refusalReason !== undefined ? { refusalReason } : {}),
    })
    .where(eq(matchings.id, id));

  const [row] = await db
    .select({ needId: matchings.needId })
    .from(matchings)
    .where(eq(matchings.id, id));
  if (row) await syncNeedStatusFromMatchings(row.needId);

  revalidatePath("/besoins");
  revalidatePath("/candidats");
}

export async function markMatchingWinner(matchingId: string): Promise<void> {
  await requireAuth();

  // Find the needId for this matching
  const [row] = await db
    .select({ needId: matchings.needId })
    .from(matchings)
    .where(eq(matchings.id, matchingId));
  if (!row) return;

  // Mark winner + placed
  await db
    .update(matchings)
    .set({ isWinner: true, isFrozen: false, propositionStatus: "placed", updatedAt: new Date() })
    .where(eq(matchings.id, matchingId));

  // Freeze all others on same need
  await db
    .update(matchings)
    .set({ isFrozen: true, updatedAt: new Date() })
    .where(
      and(
        eq(matchings.needId, row.needId),
        notInArray(matchings.id, [matchingId])
      )
    );

  revalidatePath("/besoins");
  revalidatePath("/candidats");
}

export async function deleteMatching(id: string): Promise<void> {
  await requireAuth();
  // Capture needId before deletion so we can sync after
  const [row] = await db
    .select({ needId: matchings.needId })
    .from(matchings)
    .where(eq(matchings.id, id));
  await db.delete(matchings).where(eq(matchings.id, id));
  if (row) await syncNeedStatusFromMatchings(row.needId);
  revalidatePath("/besoins");
  revalidatePath("/candidats");
}

// Revalidate need-specific path
export async function revalidateNeed(needId: string): Promise<void> {
  revalidatePath(`/besoins/${needId}`);
  revalidatePath("/besoins");
}

export async function revalidateCandidat(candidateId: string): Promise<void> {
  revalidatePath(`/candidats/${candidateId}`);
  revalidatePath("/candidats");
}
