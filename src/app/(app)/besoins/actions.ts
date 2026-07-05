"use server";

import { requireAuth, checkPreviewGuard } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { db } from "@/db";
import { needs, companies, cursus, profiles, tasks, taskLinks, matchings, candidates, needCursus, notifications } from "@/db/schema";
import { eq, isNull, and, asc, inArray, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivityEvent } from "@/lib/activity";
import { parseTaskCategory } from "@/lib/task-service";
import { normalizeNeedPipelineStatus } from "@/app/(app)/matching/rules";
import { syncCandidateStatusFromMatchings } from "@/app/(app)/matching/actions";
import { normalizeContractDate, normalizeRemunerationLines } from "@/lib/cerfa-mapping";

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
  const actor = await requireAuth();
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
    const [createdTask] = await db.insert(tasks).values({
      title: task.title,
      category: parseTaskCategory(task.category),
      assignedTo: task.assignedTo || null,
      dueAt,
      description: task.notes || null,
      createdBy: actor.id,
    }).returning({ id: tasks.id });

    await db.insert(taskLinks).values({
      taskId: createdTask.id,
      entityType: "company",
      entityId: companyId,
    });

    await logActivityEvent({
      companyId,
      actorId: actor.id,
      actionType: "task.created",
      summary: `Tache creee : ${task.title}`,
    });

    if (task.assignedTo && task.assignedTo !== actor.id) {
      await db.insert(notifications).values({
        userId: task.assignedTo,
        type: "task_assigned",
        title: "Nouvelle tache assignee",
        body: `${actor.fullName} vous a assigne : ${task.title}`,
        companyId,
      });
    }
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
    .where(and(isNull(needs.deletedAt), isNull(companies.deletedAt)))
    .orderBy(asc(needs.title));

  if (rows.length === 0) return [];

  const needIds = rows.map((r) => r.id);
  const companyIds = rows.map((r) => r.companyId);

  const [nextTaskRows, candidateRows] = await Promise.all([
    db
      .select({ companyId: taskLinks.entityId, dueAt: tasks.dueAt })
      .from(taskLinks)
      .innerJoin(tasks, eq(taskLinks.taskId, tasks.id))
      .where(
        and(
          eq(taskLinks.entityType, "company"),
          inArray(taskLinks.entityId, companyIds),
          isNull(tasks.completedAt),
          isNull(tasks.deletedAt),
        )
      )
      .orderBy(asc(tasks.dueAt)),
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
          isNull(candidates.deletedAt),
        )
      )
      .orderBy(asc(matchings.createdAt)),
  ]);

  const nextTaskMap = new Map<string, string>();
  for (const t of nextTaskRows) {
    if (t.companyId && !nextTaskMap.has(t.companyId)) {
      nextTaskMap.set(t.companyId, t.dueAt.toISOString());
    }
  }

  const candidatesByNeed = new Map<string, Array<{ matchingId: string; candidateId: string; firstName: string; propositionStatus: string; isFrozen: boolean }>>();
  const activeCountMap = new Map<string, number>();
  const waitingFreCountMap = new Map<string, number>();
  const interviewCountMap = new Map<string, number>();
  for (const r of candidateRows) {
    const nid = r.needId as string;
    if (!candidatesByNeed.has(nid)) candidatesByNeed.set(nid, []);
    candidatesByNeed.get(nid)!.push({ matchingId: r.matchingId, candidateId: r.candidateId, firstName: r.firstName, propositionStatus: r.propositionStatus, isFrozen: r.isFrozen });
    activeCountMap.set(nid, (activeCountMap.get(nid) ?? 0) + 1);
    if (r.propositionStatus === "waiting_fre") {
      waitingFreCountMap.set(nid, (waitingFreCountMap.get(nid) ?? 0) + 1);
    }
    if (r.propositionStatus === "interview") {
      interviewCountMap.set(nid, (interviewCountMap.get(nid) ?? 0) + 1);
    }
  }

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  return rows.map((r) => {
    const nextTaskAt = nextTaskMap.get(r.companyId) ?? null;
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
      status: normalizeNeedPipelineStatus(r.status),
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
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "needs:edit")) return;
  await db
    .update(needs)
    .set({
      status: status as never,
      updatedAt: new Date(),
      ...(lostReason !== undefined ? { lostReason } : {}),
    })
    .where(eq(needs.id, id));

  if (status === "lost") {
    const activeMatchings = await db
      .select({ id: matchings.id, candidateId: matchings.candidateId })
      .from(matchings)
      .where(
        and(
          eq(matchings.needId, id),
          notInArray(matchings.propositionStatus, ["not_retained"])
        )
      );

    // Cascade: mark all active matchings as not_retained
    if (activeMatchings.length > 0) {
      await db
        .update(matchings)
        .set({ propositionStatus: "not_retained", updatedAt: new Date() })
        .where(inArray(matchings.id, activeMatchings.map((matching) => matching.id)));

      const candidateIds = [...new Set(activeMatchings.map((matching) => matching.candidateId as string))];
      await Promise.all(candidateIds.map(syncCandidateStatusFromMatchings));
    }
    revalidatePath("/candidats");
  }

  revalidatePath("/besoins");
}

export async function permanentlyDeleteNeed(id: string): Promise<{ success: boolean; error?: string }> {
  const guard = await checkPreviewGuard();
  if (guard) return guard;
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "needs:delete")) return { success: false, error: "Non autorisé" };

  const [need] = await db
    .select({ status: needs.status })
    .from(needs)
    .where(eq(needs.id, id))
    .limit(1);

  if (!need) return { success: false, error: "Besoin introuvable" };
  if (need.status !== "lost") {
    return { success: false, error: "Le besoin doit d'abord etre archive" };
  }

  await db
    .delete(needs)
    .where(eq(needs.id, id));

  revalidatePath("/besoins");
  revalidatePath("/candidats");
  revalidatePath("/matching");
  revalidatePath("/annuaire");
  revalidatePath("/taches");
  return { success: true };
}

export async function updateNeedTitle(id: string, title: string) {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "needs:edit")) return;
  if (!title.trim()) return;
  await db
    .update(needs)
    .set({ title: title.trim(), updatedAt: new Date() })
    .where(eq(needs.id, id));
  revalidatePath("/besoins");
}

export async function updateNeedCursus(id: string, targetCursusId: string | null) {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "needs:edit")) return;
  await db
    .update(needs)
    .set({ targetCursusId: targetCursusId || null, updatedAt: new Date() })
    .where(eq(needs.id, id));
  revalidatePath("/besoins");
}

export async function updateNeedOwner(id: string, ownerId: string | null) {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "needs:edit")) return;
  await db
    .update(needs)
    .set({ ownerId: ownerId || null, updatedAt: new Date() })
    .where(eq(needs.id, id));
  revalidatePath("/besoins");
}

export async function updateNeedCity(id: string, city: string | null) {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "needs:edit")) return;
  await db
    .update(needs)
    .set({ city: city?.trim() || null, updatedAt: new Date() })
    .where(eq(needs.id, id));
  revalidatePath("/besoins");
}

const remunerationFieldSchema = Object.fromEntries(
  Array.from({ length: 8 }, (_, index) => {
    const position = index + 1;
    return [
      [`remunerationStart${position}`, z.string().optional()],
      [`remunerationEnd${position}`, z.string().optional()],
      [`remunerationPercent${position}`, z.string().optional()],
      [`remunerationReference${position}`, z.string().optional()],
    ];
  }).flat(),
);

const contractFieldsSchema = z.object({
  contactId: z.string().optional(),
  startDate: z.string().optional(),
  weeklyHours: z.string().optional(),
  contractType: z.string().optional(),
  contractConclusionDate: z.string().optional(),
  contractPracticalStartDate: z.string().optional(),
  contractMadeAt: z.string().optional(),
  salaryReference: z.string().optional(),
  smcAmount: z.string().optional(),
  overtimeHandling: z.string().optional(),
  endDate: z.string().optional(),
  monthlyGrossSalary: z.string().optional(),
  hourlyGrossSalary: z.string().optional(),
  rncpCode: z.string().optional(),
  masterFirstName: z.string().optional(),
  masterLastName: z.string().optional(),
  masterBirthName: z.string().optional(),
  masterBirthDate: z.string().optional(),
  masterJobTitle: z.string().optional(),
  masterPhone: z.string().optional(),
  masterEmail: z.string().optional(),
  masterDiploma: z.string().optional(),
  masterDiplomaLevel: z.string().optional(),
  benefitFood: z.string().optional(),
  benefitHousing: z.string().optional(),
  benefitOther: z.string().optional(),
  ...remunerationFieldSchema,
});

export type ContractFields = z.infer<typeof contractFieldsSchema>;

export async function updateNeedContractFields(
  needId: string,
  fields: ContractFields
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "needs:edit")) return { success: false, error: "Non autorisé" };
  const parsed = contractFieldsSchema.safeParse(fields);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const d = parsed.data;
  const startYear = normalizeContractDate(d.startDate)?.slice(0, 4) ?? null;
  const remunerationLines = normalizeRemunerationLines(
    Array.from({ length: 8 }, (_, index) => {
      const position = index + 1;
      return {
        startDate: d[`remunerationStart${position}`],
        endDate: d[`remunerationEnd${position}`],
        percent: d[`remunerationPercent${position}`],
        reference: d[`remunerationReference${position}`],
      };
    }),
    { defaultReference: d.salaryReference, fallbackYear: startYear },
  );

  await db
    .update(needs)
    .set({
      weeklyHours: d.weeklyHours ?? null,
      contactId: d.contactId ?? null,
      startDate: normalizeContractDate(d.startDate),
      contractType: d.contractType ?? null,
      contractConclusionDate: normalizeContractDate(d.contractConclusionDate),
      contractPracticalStartDate: normalizeContractDate(d.contractPracticalStartDate),
      contractMadeAt: d.contractMadeAt?.trim() || "Courbevoie",
      salaryReference: d.salaryReference ?? null,
      smcAmount: d.smcAmount ?? null,
      overtimeHandling: d.overtimeHandling ?? null,
      endDate: normalizeContractDate(d.endDate),
      remunerationLines: remunerationLines.length > 0 ? remunerationLines : null,
      monthlyGrossSalary: d.monthlyGrossSalary ?? null,
      hourlyGrossSalary: d.hourlyGrossSalary ?? null,
      rncpCode: d.rncpCode ?? null,
      masterFirstName: d.masterFirstName ?? null,
      masterLastName: d.masterLastName ?? null,
      masterBirthName: d.masterBirthName ?? null,
      masterBirthDate: d.masterBirthDate ?? null,
      masterJobTitle: d.masterJobTitle ?? null,
      masterPhone: d.masterPhone ?? null,
      masterEmail: d.masterEmail ?? null,
      masterDiploma: d.masterDiploma ?? null,
      masterDiplomaLevel: d.masterDiplomaLevel ?? null,
      benefitFood: d.benefitFood ?? null,
      benefitHousing: d.benefitHousing ?? null,
      benefitOther: d.benefitOther ?? null,
      updatedAt: new Date(),
    })
    .where(eq(needs.id, needId));

  await logActivityEvent({
    needId,
    actorId: actor.id,
    actionType: "need_fields_updated",
    summary: "Informations du contrat mises à jour",
  });

  revalidatePath(`/besoins/${needId}`);
  return { success: true };
}

export async function syncNeedCursus(needId: string, cursusIds: string[]): Promise<void> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "needs:edit")) return;

  await db.delete(needCursus).where(eq(needCursus.needId, needId));

  if (cursusIds.length > 0) {
    await db.insert(needCursus).values(cursusIds.map((cursusId) => ({ needId, cursusId })));
  }

  await logActivityEvent({
    needId,
    actorId: actor.id,
    actionType: "need_cursus_updated",
    summary: "Cursus cibles mis à jour",
  });

  revalidatePath(`/besoins/${needId}`);
}

export async function loadNeedCursus(needId: string): Promise<{ cursusId: string; cursusName: string }[]> {
  await requireAuth();

  const rows = await db
    .select({ cursusId: needCursus.cursusId, cursusName: cursus.name })
    .from(needCursus)
    .innerJoin(cursus, eq(needCursus.cursusId, cursus.id))
    .where(eq(needCursus.needId, needId));

  return rows;
}
