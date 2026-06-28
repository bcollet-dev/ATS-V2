"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { needs, companies, cursus, profiles, tasks, matchings, candidates } from "@/db/schema";
import { eq, isNull, and, asc, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createNeedSchema = z.object({
  companyId: z.string().uuid("Entreprise requise"),
  title: z.string().min(1, "Le titre est requis"),
  targetCursusId: z.string().optional(),
  city: z.string().optional(),
  positionsCount: z.coerce.number().int().min(1).default(1),
  ownerId: z.string().optional(),
  task: z.object({
    category: z.enum(["call", "email", "document", "follow_up", "interview", "other", "video_interview", "onsite_interview", "administrative"]),
    title: z.string().min(1, "Titre de la tâche requis"),
    assignedTo: z.string().min(1, "Responsable requis"),
    dueAt: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export type CreateNeedInput = z.infer<typeof createNeedSchema>;

type CreateNeedResult =
  | { success: true; data: { id: string; title: string } }
  | { success: false; error: string };

export async function createNeed(input: CreateNeedInput): Promise<CreateNeedResult> {
  await requireAuth();
  const parsed = createNeedSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const { companyId, title, targetCursusId, city, positionsCount, ownerId, task } = parsed.data;

  const [created] = await db
    .insert(needs)
    .values({
      companyId,
      title,
      targetCursusId: targetCursusId || null,
      city: city?.trim() || null,
      positionsCount,
      ownerId: ownerId || null,
    })
    .returning({ id: needs.id, title: needs.title });

  // Create premier-contact task (non-fatal if fails)
  try {
    const dueAt = task.dueAt ? new Date(task.dueAt) : new Date();
    await db.insert(tasks).values({
      needId: created.id,
      title: task.title,
      category: task.category as never,
      assignedTo: task.assignedTo || null,
      dueAt,
      description: task.notes || null,
    });
  } catch { /* task creation failure is non-fatal */ }

  revalidatePath("/besoins");
  return { success: true, data: created };
}

export type NeedRow = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  targetCursusId: string | null;
  targetCursusName: string | null;
  city: string | null;
  positionsCount: number;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  nextTaskAt: string | null;
  updatedAt: string;
  isInactive: boolean;
  nextTaskOverdue: boolean;
  activeMatchingsCount: number;
  waitingFreCandidatesCount: number;
  interviewCandidatesCount: number;
  needCandidates: Array<{ matchingId: string; candidateId: string; firstName: string; propositionStatus: string; isFrozen: boolean }>;
};

export async function loadPipelineNeeds(): Promise<NeedRow[]> {
  await requireAuth();

  const rows = await db
    .select({
      id: needs.id,
      title: needs.title,
      companyId: needs.companyId,
      companyName: companies.name,
      targetCursusId: needs.targetCursusId,
      targetCursusName: cursus.name,
      city: needs.city,
      positionsCount: needs.positionsCount,
      status: needs.status,
      ownerId: needs.ownerId,
      ownerName: profiles.fullName,
      updatedAt: needs.updatedAt,
    })
    .from(needs)
    .leftJoin(companies, eq(needs.companyId, companies.id))
    .leftJoin(cursus, eq(needs.targetCursusId, cursus.id))
    .leftJoin(profiles, eq(needs.ownerId, profiles.id))
    .where(isNull(needs.deletedAt))
    .orderBy(asc(needs.title));

  if (rows.length === 0) return [];

  const needIds = rows.map((r) => r.id);

  const [nextTaskRows, activeCountRows, waitingFreCountRows, interviewCountRows, candidateRows] = await Promise.all([
    db
      .select({ needId: tasks.needId, dueAt: tasks.dueAt })
      .from(tasks)
      .where(
        and(
          inArray(tasks.needId, needIds),
          isNull(tasks.completedAt),
          isNull(tasks.deletedAt),
        )
      )
      .orderBy(asc(tasks.dueAt)),
    db
      .select({ needId: matchings.needId, count: sql<number>`count(*)::int` })
      .from(matchings)
      .where(
        and(
          inArray(matchings.needId, needIds),
          notInArray(matchings.propositionStatus, ["not_retained"]),
        )
      )
      .groupBy(matchings.needId),
    db
      .select({ needId: matchings.needId, count: sql<number>`count(*)::int` })
      .from(matchings)
      .where(
        and(
          inArray(matchings.needId, needIds),
          eq(matchings.propositionStatus, "waiting_fre"),
        )
      )
      .groupBy(matchings.needId),
    db
      .select({ needId: matchings.needId, count: sql<number>`count(*)::int` })
      .from(matchings)
      .where(
        and(
          inArray(matchings.needId, needIds),
          eq(matchings.propositionStatus, "interview"),
        )
      )
      .groupBy(matchings.needId),
    db
      .select({
        needId: matchings.needId,
        matchingId: matchings.id,
        candidateId: matchings.candidateId,
        firstName: candidates.firstName,
        propositionStatus: matchings.propositionStatus,
        isFrozen: matchings.isFrozen,
      })
      .from(matchings)
      .innerJoin(candidates, eq(matchings.candidateId, candidates.id))
      .where(
        and(
          inArray(matchings.needId, needIds),
          notInArray(matchings.propositionStatus, ["not_retained"]),
        )
      )
      .orderBy(asc(matchings.createdAt)),
  ]);

  const nextTaskMap = new Map<string, string>();
  for (const t of nextTaskRows) {
    if (t.needId && !nextTaskMap.has(t.needId)) {
      nextTaskMap.set(t.needId, t.dueAt.toISOString());
    }
  }

  const candidatesByNeed = new Map<string, Array<{ matchingId: string; candidateId: string; firstName: string; propositionStatus: string; isFrozen: boolean }>>();
  for (const r of candidateRows) {
    const nid = r.needId as string;
    if (!candidatesByNeed.has(nid)) candidatesByNeed.set(nid, []);
    candidatesByNeed.get(nid)!.push({ matchingId: r.matchingId, candidateId: r.candidateId, firstName: r.firstName, propositionStatus: r.propositionStatus, isFrozen: r.isFrozen });
  }

  const activeCountMap = new Map(activeCountRows.map((r) => [r.needId as string, Number(r.count)]));
  const waitingFreCountMap = new Map(waitingFreCountRows.map((r) => [r.needId as string, Number(r.count)]));
  const interviewCountMap = new Map(interviewCountRows.map((r) => [r.needId as string, Number(r.count)]));

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  return rows.map((r) => {
    const nextTaskAt = nextTaskMap.get(r.id) ?? null;
    const updatedAt = r.updatedAt.toISOString();
    const inactive =
      r.updatedAt < twoDaysAgo &&
      (!nextTaskAt || new Date(nextTaskAt) < new Date());
    return {
      id: r.id,
      title: r.title,
      companyId: r.companyId,
      companyName: r.companyName ?? "—",
      targetCursusId: r.targetCursusId ?? null,
      targetCursusName: r.targetCursusName ?? null,
      city: r.city ?? null,
      positionsCount: r.positionsCount,
      status: r.status,
      ownerId: r.ownerId ?? null,
      ownerName: r.ownerName ?? null,
      nextTaskAt,
      updatedAt,
      isInactive: inactive,
      nextTaskOverdue: !!nextTaskAt && new Date(nextTaskAt) < new Date(),
      needCandidates: candidatesByNeed.get(r.id) ?? [],
      activeMatchingsCount: activeCountMap.get(r.id) ?? 0,
      waitingFreCandidatesCount: waitingFreCountMap.get(r.id) ?? 0,
      interviewCandidatesCount: interviewCountMap.get(r.id) ?? 0,
    };
  });
}

export async function updateNeedStatus(id: string, status: string, lostReason?: string) {
  await requireAuth();
  await db
    .update(needs)
    .set({
      status: status as never,
      updatedAt: new Date(),
      ...(lostReason !== undefined ? { lostReason } : {}),
    })
    .where(eq(needs.id, id));

  if (status === "lost") {
    // Cascade: mark all active matchings as not_retained
    await db
      .update(matchings)
      .set({ propositionStatus: "not_retained", updatedAt: new Date() })
      .where(
        and(
          eq(matchings.needId, id),
          notInArray(matchings.propositionStatus, ["not_retained"])
        )
      );
    revalidatePath("/candidats");
  }

  revalidatePath("/besoins");
}

export async function updateNeedTitle(id: string, title: string) {
  await requireAuth();
  if (!title.trim()) return;
  await db
    .update(needs)
    .set({ title: title.trim(), updatedAt: new Date() })
    .where(eq(needs.id, id));
  revalidatePath("/besoins");
}

export async function updateNeedCursus(id: string, targetCursusId: string | null) {
  await requireAuth();
  await db
    .update(needs)
    .set({ targetCursusId: targetCursusId || null, updatedAt: new Date() })
    .where(eq(needs.id, id));
  revalidatePath("/besoins");
}

export async function updateNeedOwner(id: string, ownerId: string | null) {
  await requireAuth();
  await db
    .update(needs)
    .set({ ownerId: ownerId || null, updatedAt: new Date() })
    .where(eq(needs.id, id));
  revalidatePath("/besoins");
}

export async function updateNeedCity(id: string, city: string | null) {
  await requireAuth();
  await db
    .update(needs)
    .set({ city: city?.trim() || null, updatedAt: new Date() })
    .where(eq(needs.id, id));
  revalidatePath("/besoins");
}
