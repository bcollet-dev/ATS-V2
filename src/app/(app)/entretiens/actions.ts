"use server";

import { db } from "@/db";
import {
  interviews,
  interviewTrames,
  cursus,
  candidates,
  profiles,
  tasks,
} from "@/db/schema";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, checkPreviewGuard, type UserProfile } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { logActivityEvent } from "@/lib/activity";
import { generateAndStoreInterviewSummary } from "@/lib/interview-summary";
import {
  POSITIONING_SUBCATEGORY,
  isPositioningSubcategory,
  DECISION_LABELS,
  type InterviewAnswers,
  type InterviewDecision,
  type InterviewQuestion,
} from "@/lib/interview-grid";
import {
  validateTrameQuestions,
  computeAverageScore,
  decisionToCandidateStatus,
} from "@/lib/interview-logic";
import { updateCandidateStatus } from "@/app/(app)/candidats/actions";
import {
  saveTrameSchema,
  interviewPayloadSchema,
  positioningDecisionSchema,
  decisionUpdateSchema,
  type SaveTrameInput,
  type InterviewPayloadInput,
  type PositioningDecisionInput,
  type DecisionUpdateInput,
} from "./schemas";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrameRow = {
  id: string;
  name: string;
  subcategory: string;
  cursusId: string | null;
  cursusName: string | null;
  questions: InterviewQuestion[];
  active: boolean;
  updatedAt: string;
};

export type TrameOption = {
  id: string;
  name: string;
  subcategory: string;
  cursusName: string | null;
  matchesCandidateCursus: boolean;
};

export type InterviewCandidateRow = {
  id: string;
  firstName: string;
  lastName: string;
  cursusEnvisage: string | null;
  city: string | null;
  interview: { id: string; status: "draft" | "completed" } | null;
};

export type CompletedInterviewRow = {
  id: string;
  candidateId: string;
  candidateName: string;
  trameName: string;
  subcategory: string;
  cursusName: string | null;
  decision: string | null;
  averageScore: number | null;
  completedAt: string | null;
  conductedByName: string | null;
  hasAiSummary: boolean;
};

export type InterviewDetail = {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateStatus: string;
  trameName: string;
  subcategory: string;
  isPositioning: boolean;
  cursusName: string | null;
  status: "draft" | "completed";
  questions: InterviewQuestion[];
  answers: InterviewAnswers;
  overallNotes: string | null;
  decision: string | null;
  refusalReason: string | null;
  aiSummary: string | null;
  aiSummaryGeneratedAt: string | null;
  conductedByName: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type CandidateInterviewRow = {
  id: string;
  status: "draft" | "completed";
  trameName: string;
  subcategory: string;
  decision: string | null;
  averageScore: number | null;
  aiSummary: string | null;
  conductedByName: string | null;
  completedAt: string | null;
  createdAt: string;
};

type ActionError = { success: false; error: string };

// ─── Guards ───────────────────────────────────────────────────────────────────

async function requireConductor(): Promise<{ user: UserProfile } | ActionError> {
  const user = await requireAuth();
  if (!can(user.role as AppRole, "interviews:conduct")) {
    return { success: false, error: "Vous n'avez pas les droits pour faire passer des entretiens" };
  }
  const guard = await checkPreviewGuard();
  if (guard) return guard;
  return { user };
}

async function requireTrameManager(): Promise<{ user: UserProfile } | ActionError> {
  const user = await requireAuth();
  if (!can(user.role as AppRole, "interviewTrames:manage")) {
    return { success: false, error: "Seules la direction et l'administration gèrent les trames d'entretien" };
  }
  const guard = await checkPreviewGuard();
  if (guard) return guard;
  return { user };
}

// ─── Trames d'entretien ───────────────────────────────────────────────────────

export async function listInterviewTrames(): Promise<TrameRow[]> {
  const rows = await db
    .select({
      id: interviewTrames.id,
      name: interviewTrames.name,
      subcategory: interviewTrames.subcategory,
      cursusId: interviewTrames.cursusId,
      cursusName: cursus.name,
      questions: interviewTrames.questions,
      active: interviewTrames.active,
      updatedAt: interviewTrames.updatedAt,
    })
    .from(interviewTrames)
    .leftJoin(cursus, eq(cursus.id, interviewTrames.cursusId))
    .orderBy(asc(interviewTrames.name));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    subcategory: r.subcategory,
    cursusId: r.cursusId,
    cursusName: r.cursusName,
    questions: (r.questions ?? []) as InterviewQuestion[],
    active: r.active,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function listTrameSubcategories(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ subcategory: interviewTrames.subcategory })
    .from(interviewTrames)
    .orderBy(asc(interviewTrames.subcategory));

  const existing = rows.map((r) => r.subcategory);
  return [POSITIONING_SUBCATEGORY, ...existing.filter((s) => s !== POSITIONING_SUBCATEGORY)];
}

export async function saveInterviewTrame(
  input: SaveTrameInput
): Promise<{ success: true; trameId: string } | ActionError> {
  const auth = await requireTrameManager();
  if ("success" in auth) return auth;

  const parsed = saveTrameSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const structureErrors = validateTrameQuestions(parsed.data.questions as InterviewQuestion[]);
  if (structureErrors.length > 0) {
    return { success: false, error: structureErrors[0] };
  }

  const now = new Date();
  const values = {
    name: parsed.data.name.trim(),
    subcategory: parsed.data.subcategory.trim(),
    cursusId: parsed.data.cursusId ?? null,
    questions: parsed.data.questions,
    active: parsed.data.active ?? true,
    updatedAt: now,
  };

  let trameId = parsed.data.id;
  if (trameId) {
    const updated = await db
      .update(interviewTrames)
      .set(values)
      .where(eq(interviewTrames.id, trameId))
      .returning({ id: interviewTrames.id });
    if (updated.length === 0) return { success: false, error: "Trame introuvable" };
  } else {
    const [created] = await db
      .insert(interviewTrames)
      .values({ ...values, createdBy: auth.user.id })
      .returning({ id: interviewTrames.id });
    trameId = created.id;
  }

  revalidatePath("/trames/entretien");
  revalidatePath("/entretiens");
  return { success: true, trameId };
}

export async function toggleTrameActive(
  trameId: string,
  active: boolean
): Promise<{ success: true } | ActionError> {
  const auth = await requireTrameManager();
  if ("success" in auth) return auth;

  await db
    .update(interviewTrames)
    .set({ active, updatedAt: new Date() })
    .where(eq(interviewTrames.id, trameId));

  revalidatePath("/trames/entretien");
  revalidatePath("/entretiens");
  return { success: true };
}

export async function deleteInterviewTrame(
  trameId: string
): Promise<{ success: true } | ActionError> {
  const auth = await requireTrameManager();
  if ("success" in auth) return auth;

  const deleted = await db
    .delete(interviewTrames)
    .where(eq(interviewTrames.id, trameId))
    .returning({ id: interviewTrames.id });
  if (deleted.length === 0) return { success: false, error: "Trame introuvable" };

  revalidatePath("/trames/entretien");
  revalidatePath("/entretiens");
  return { success: true };
}

// ─── Choix de trame au démarrage ──────────────────────────────────────────────

export async function listTramesForCandidate(candidateId: string): Promise<TrameOption[]> {
  const candidat = await db.query.candidates.findFirst({
    where: and(eq(candidates.id, candidateId), isNull(candidates.deletedAt)),
    columns: { cursusEnvisage: true },
  });

  const rows = await db
    .select({
      id: interviewTrames.id,
      name: interviewTrames.name,
      subcategory: interviewTrames.subcategory,
      cursusName: cursus.name,
    })
    .from(interviewTrames)
    .leftJoin(cursus, eq(cursus.id, interviewTrames.cursusId))
    .where(eq(interviewTrames.active, true))
    .orderBy(asc(interviewTrames.name));

  const candidateCursus = candidat?.cursusEnvisage ?? null;
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      subcategory: r.subcategory,
      cursusName: r.cursusName,
      matchesCandidateCursus: !!candidateCursus && r.cursusName === candidateCursus,
    }))
    .sort((a, b) => Number(b.matchesCandidateCursus) - Number(a.matchesCandidateCursus));
}

// ─── Cycle de vie d'un entretien ──────────────────────────────────────────────

export async function startInterview(input: {
  candidateId: string;
  trameId: string;
  taskId?: string;
}): Promise<{ success: true; interviewId: string } | ActionError> {
  const auth = await requireConductor();
  if ("success" in auth) return auth;

  const candidat = await db.query.candidates.findFirst({
    where: and(eq(candidates.id, input.candidateId), isNull(candidates.deletedAt)),
    columns: { id: true, firstName: true, lastName: true, cursusEnvisage: true },
  });
  if (!candidat) return { success: false, error: "Candidat introuvable" };

  // Reprendre le brouillon existant plutôt que d'en créer un second
  const [existingDraft] = await db
    .select({ id: interviews.id })
    .from(interviews)
    .where(and(eq(interviews.candidateId, input.candidateId), eq(interviews.status, "draft")))
    .limit(1);
  if (existingDraft) return { success: true, interviewId: existingDraft.id };

  const [trame] = await db
    .select({
      id: interviewTrames.id,
      name: interviewTrames.name,
      subcategory: interviewTrames.subcategory,
      questions: interviewTrames.questions,
      cursusName: cursus.name,
    })
    .from(interviewTrames)
    .leftJoin(cursus, eq(cursus.id, interviewTrames.cursusId))
    .where(and(eq(interviewTrames.id, input.trameId), eq(interviewTrames.active, true)))
    .limit(1);
  if (!trame) return { success: false, error: "Trame introuvable ou désactivée" };

  const questions = (trame.questions ?? []) as InterviewQuestion[];
  if (questions.length === 0) return { success: false, error: "Cette trame ne contient aucune question" };

  const [created] = await db
    .insert(interviews)
    .values({
      candidateId: input.candidateId,
      trameId: trame.id,
      trameName: trame.name,
      subcategory: trame.subcategory,
      cursusName: trame.cursusName ?? candidat.cursusEnvisage,
      questionsSnapshot: questions,
      taskId: input.taskId ?? null,
      conductedBy: auth.user.id,
    })
    .returning({ id: interviews.id });

  if (input.taskId) {
    await db
      .update(tasks)
      .set({ completedAt: new Date(), completedBy: auth.user.id, updatedAt: new Date() })
      .where(and(eq(tasks.id, input.taskId), isNull(tasks.completedAt)));
  }

  await logActivityEvent({
    candidateId: input.candidateId,
    actorId: auth.user.id,
    actionType: "interview_started",
    summary: `Entretien démarré — trame « ${trame.name} »`,
  });

  revalidatePath("/entretiens");
  revalidatePath(`/candidats/${input.candidateId}`);
  revalidatePath("/dashboard");
  return { success: true, interviewId: created.id };
}

// « Candidat non présent » depuis une tâche d'entretien : PVPP uniquement si le
// candidat est au stade Entretien EDA du pipeline, sinon simple clôture de tâche.
export async function markInterviewNoShow(input: {
  candidateId: string;
  taskId: string;
}): Promise<{ success: true; pvppApplied: boolean } | ActionError> {
  const auth = await requireConductor();
  if ("success" in auth) return auth;

  const candidat = await db.query.candidates.findFirst({
    where: and(eq(candidates.id, input.candidateId), isNull(candidates.deletedAt)),
    columns: { id: true, status: true },
  });
  if (!candidat) return { success: false, error: "Candidat introuvable" };

  await db
    .update(tasks)
    .set({ completedAt: new Date(), completedBy: auth.user.id, updatedAt: new Date() })
    .where(and(eq(tasks.id, input.taskId), isNull(tasks.completedAt)));

  const pvppApplied = candidat.status === "interview";
  if (pvppApplied) {
    await updateCandidateStatus(input.candidateId, "pvpp");
  }

  await logActivityEvent({
    candidateId: input.candidateId,
    actorId: auth.user.id,
    actionType: "interview_no_show",
    summary: pvppApplied
      ? "Candidat non présenté à l'entretien — passage en PVPP"
      : "Candidat non présenté à l'entretien",
  });

  revalidatePath("/entretiens");
  revalidatePath(`/candidats/${input.candidateId}`);
  revalidatePath("/dashboard");
  return { success: true, pvppApplied };
}

export async function saveInterviewDraft(
  interviewId: string,
  payload: InterviewPayloadInput
): Promise<{ success: true } | ActionError> {
  const auth = await requireConductor();
  if ("success" in auth) return auth;

  const parsed = interviewPayloadSchema.safeParse(payload);
  if (!parsed.success) return { success: false, error: "Données invalides" };

  const updated = await db
    .update(interviews)
    .set({
      answers: parsed.data.answers,
      overallNotes: parsed.data.overallNotes?.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(interviews.id, interviewId), eq(interviews.status, "draft")))
    .returning({ id: interviews.id });

  if (updated.length === 0) return { success: false, error: "Entretien introuvable ou déjà finalisé" };
  return { success: true };
}

export async function completeInterview(
  interviewId: string,
  payload: InterviewPayloadInput,
  decision?: PositioningDecisionInput
): Promise<{ success: true; aiSummaryError?: string } | ActionError> {
  const auth = await requireConductor();
  if ("success" in auth) return auth;

  const parsedPayload = interviewPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) return { success: false, error: "Données invalides" };

  const [existing] = await db
    .select({
      id: interviews.id,
      candidateId: interviews.candidateId,
      subcategory: interviews.subcategory,
      trameName: interviews.trameName,
    })
    .from(interviews)
    .where(and(eq(interviews.id, interviewId), eq(interviews.status, "draft")))
    .limit(1);
  if (!existing) return { success: false, error: "Entretien introuvable ou déjà finalisé" };

  const isPositioning = isPositioningSubcategory(existing.subcategory);

  let interviewDecision: InterviewDecision | null = null;
  let refusalReason: string | null = null;
  if (isPositioning) {
    const parsedDecision = positioningDecisionSchema.safeParse(decision);
    if (!parsedDecision.success) {
      return { success: false, error: "La décision d'admissibilité est requise pour un entretien de positionnement" };
    }
    interviewDecision = parsedDecision.data.admissible
      ? "admissible"
      : parsedDecision.data.refusalType!;
    refusalReason = parsedDecision.data.admissible
      ? null
      : parsedDecision.data.refusalReason?.trim() || null;
  }

  const now = new Date();
  await db
    .update(interviews)
    .set({
      answers: parsedPayload.data.answers,
      overallNotes: parsedPayload.data.overallNotes?.trim() || null,
      decision: interviewDecision,
      refusalReason,
      status: "completed",
      conductedBy: auth.user.id,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(interviews.id, interviewId));

  // Décision de positionnement → statut pipeline (gèle les matchings et
  // resynchronise les besoins en cas de refus, via la mécanique existante)
  if (interviewDecision) {
    await updateCandidateStatus(
      existing.candidateId,
      decisionToCandidateStatus(interviewDecision),
      interviewDecision === "admissible" ? undefined : (refusalReason ?? undefined)
    );
  }

  const summaryResult = await generateAndStoreInterviewSummary(interviewId);

  await logActivityEvent({
    candidateId: existing.candidateId,
    actorId: auth.user.id,
    actionType: "interview_completed",
    summary: interviewDecision
      ? `Entretien « ${existing.trameName} » finalisé — ${DECISION_LABELS[interviewDecision]}`
      : `Entretien « ${existing.trameName} » finalisé`,
  });

  revalidatePath("/entretiens");
  revalidatePath(`/entretiens/${interviewId}`);
  revalidatePath(`/candidats/${existing.candidateId}`);
  revalidatePath("/candidats");

  return summaryResult.success ? { success: true } : { success: true, aiSummaryError: summaryResult.error };
}

// ─── Édition a posteriori ─────────────────────────────────────────────────────

export async function updateCompletedInterview(
  interviewId: string,
  payload: InterviewPayloadInput,
  decisionUpdate?: DecisionUpdateInput
): Promise<{ success: true } | ActionError> {
  const auth = await requireConductor();
  if ("success" in auth) return auth;

  const parsedPayload = interviewPayloadSchema.safeParse(payload);
  if (!parsedPayload.success) return { success: false, error: "Données invalides" };

  const [existing] = await db
    .select({
      id: interviews.id,
      candidateId: interviews.candidateId,
      subcategory: interviews.subcategory,
      trameName: interviews.trameName,
      decision: interviews.decision,
    })
    .from(interviews)
    .where(and(eq(interviews.id, interviewId), eq(interviews.status, "completed")))
    .limit(1);
  if (!existing) return { success: false, error: "Entretien introuvable ou non finalisé" };

  let decisionChanged = false;
  let newDecision: InterviewDecision | null = null;
  let newRefusalReason: string | null | undefined;
  let applyStatus = false;

  if (decisionUpdate !== undefined) {
    const parsedDecision = decisionUpdateSchema.safeParse(decisionUpdate);
    if (!parsedDecision.success) return { success: false, error: "Décision invalide" };
    newDecision = parsedDecision.data.decision;
    newRefusalReason =
      newDecision === "admissible" || newDecision === null
        ? null
        : parsedDecision.data.refusalReason?.trim() || null;
    applyStatus = parsedDecision.data.applyStatus;
    decisionChanged = newDecision !== existing.decision;
  }

  await db
    .update(interviews)
    .set({
      answers: parsedPayload.data.answers,
      overallNotes: parsedPayload.data.overallNotes?.trim() || null,
      ...(decisionUpdate !== undefined
        ? { decision: newDecision, refusalReason: newRefusalReason ?? null }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(interviews.id, interviewId));

  if (decisionChanged && applyStatus && newDecision) {
    await updateCandidateStatus(
      existing.candidateId,
      decisionToCandidateStatus(newDecision),
      newDecision === "admissible" ? undefined : (newRefusalReason ?? undefined)
    );
  }

  await logActivityEvent({
    candidateId: existing.candidateId,
    actorId: auth.user.id,
    actionType: "interview_updated",
    summary: decisionChanged
      ? `Entretien « ${existing.trameName} » modifié — décision : ${newDecision ? DECISION_LABELS[newDecision] : "retirée"}${applyStatus && newDecision ? " (statut mis à jour)" : ""}`
      : `Entretien « ${existing.trameName} » modifié`,
  });

  revalidatePath("/entretiens");
  revalidatePath(`/entretiens/${interviewId}`);
  revalidatePath(`/candidats/${existing.candidateId}`);
  revalidatePath("/candidats");
  return { success: true };
}

export async function updateInterviewSummary(
  interviewId: string,
  summary: string
): Promise<{ success: true } | ActionError> {
  const auth = await requireConductor();
  if ("success" in auth) return auth;

  const updated = await db
    .update(interviews)
    .set({ aiSummary: summary.trim() || null, updatedAt: new Date() })
    .where(and(eq(interviews.id, interviewId), eq(interviews.status, "completed")))
    .returning({ candidateId: interviews.candidateId, trameName: interviews.trameName });
  if (updated.length === 0) return { success: false, error: "Entretien introuvable ou non finalisé" };

  await logActivityEvent({
    candidateId: updated[0].candidateId,
    actorId: auth.user.id,
    actionType: "interview_summary_updated",
    summary: `Résumé de l'entretien « ${updated[0].trameName} » modifié`,
  });

  revalidatePath(`/entretiens/${interviewId}`);
  revalidatePath(`/candidats/${updated[0].candidateId}`);
  return { success: true };
}

export async function deleteInterview(
  interviewId: string
): Promise<{ success: true } | ActionError> {
  const auth = await requireConductor();
  if ("success" in auth) return auth;

  const [existing] = await db
    .select({ id: interviews.id, status: interviews.status, candidateId: interviews.candidateId, trameName: interviews.trameName })
    .from(interviews)
    .where(eq(interviews.id, interviewId))
    .limit(1);
  if (!existing) return { success: false, error: "Entretien introuvable" };

  if (existing.status === "completed" && !can(auth.user.role as AppRole, "candidates:delete")) {
    return { success: false, error: "Seules la direction et l'administration peuvent supprimer un entretien finalisé" };
  }

  await db.delete(interviews).where(eq(interviews.id, interviewId));

  await logActivityEvent({
    candidateId: existing.candidateId,
    actorId: auth.user.id,
    actionType: "interview_deleted",
    summary:
      existing.status === "completed"
        ? `Entretien finalisé « ${existing.trameName} » supprimé`
        : `Brouillon d'entretien « ${existing.trameName} » abandonné`,
  });

  revalidatePath("/entretiens");
  revalidatePath(`/candidats/${existing.candidateId}`);
  return { success: true };
}

// ─── Loaders ──────────────────────────────────────────────────────────────────

export async function listInterviewCandidates(): Promise<InterviewCandidateRow[]> {
  const candidateRows = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      cursusEnvisage: candidates.cursusEnvisage,
      city: candidates.city,
    })
    .from(candidates)
    .where(and(eq(candidates.status, "interview"), isNull(candidates.deletedAt)))
    .orderBy(asc(candidates.firstName), asc(candidates.lastName));

  if (candidateRows.length === 0) return [];

  const candidateIds = candidateRows.map((c) => c.id);
  const interviewRows = await db
    .select({ id: interviews.id, candidateId: interviews.candidateId, status: interviews.status })
    .from(interviews)
    .where(inArray(interviews.candidateId, candidateIds))
    .orderBy(desc(interviews.createdAt));

  const latestInterview = new Map<string, { id: string; status: "draft" | "completed" }>();
  for (const row of interviewRows) {
    if (!latestInterview.has(row.candidateId)) {
      latestInterview.set(row.candidateId, { id: row.id, status: row.status });
    }
  }

  return candidateRows.map((c) => ({
    ...c,
    interview: latestInterview.get(c.id) ?? null,
  }));
}

export async function listCompletedInterviews(): Promise<CompletedInterviewRow[]> {
  const rows = await db
    .select({
      id: interviews.id,
      candidateId: interviews.candidateId,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      trameName: interviews.trameName,
      subcategory: interviews.subcategory,
      cursusName: interviews.cursusName,
      decision: interviews.decision,
      questionsSnapshot: interviews.questionsSnapshot,
      answers: interviews.answers,
      aiSummary: interviews.aiSummary,
      completedAt: interviews.completedAt,
      conductedByName: profiles.fullName,
    })
    .from(interviews)
    .innerJoin(candidates, eq(candidates.id, interviews.candidateId))
    .leftJoin(profiles, eq(profiles.id, interviews.conductedBy))
    .where(and(eq(interviews.status, "completed"), isNull(candidates.deletedAt)))
    .orderBy(desc(interviews.completedAt))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    candidateId: r.candidateId,
    candidateName: `${r.firstName} ${r.lastName}`,
    trameName: r.trameName,
    subcategory: r.subcategory,
    cursusName: r.cursusName,
    decision: r.decision,
    averageScore: computeAverageScore(
      (r.questionsSnapshot ?? []) as InterviewQuestion[],
      (r.answers ?? {}) as InterviewAnswers
    ),
    completedAt: r.completedAt?.toISOString() ?? null,
    conductedByName: r.conductedByName,
    hasAiSummary: !!r.aiSummary,
  }));
}

export async function getInterviewDetail(interviewId: string): Promise<InterviewDetail | null> {
  const [row] = await db
    .select({
      id: interviews.id,
      candidateId: interviews.candidateId,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      candidateStatus: candidates.status,
      trameName: interviews.trameName,
      subcategory: interviews.subcategory,
      cursusName: interviews.cursusName,
      status: interviews.status,
      questionsSnapshot: interviews.questionsSnapshot,
      answers: interviews.answers,
      overallNotes: interviews.overallNotes,
      decision: interviews.decision,
      refusalReason: interviews.refusalReason,
      aiSummary: interviews.aiSummary,
      aiSummaryGeneratedAt: interviews.aiSummaryGeneratedAt,
      conductedByName: profiles.fullName,
      completedAt: interviews.completedAt,
      createdAt: interviews.createdAt,
    })
    .from(interviews)
    .innerJoin(candidates, eq(candidates.id, interviews.candidateId))
    .leftJoin(profiles, eq(profiles.id, interviews.conductedBy))
    .where(eq(interviews.id, interviewId))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    candidateId: row.candidateId,
    candidateName: `${row.firstName} ${row.lastName}`,
    candidateStatus: row.candidateStatus,
    trameName: row.trameName,
    subcategory: row.subcategory,
    isPositioning: isPositioningSubcategory(row.subcategory),
    cursusName: row.cursusName,
    status: row.status,
    questions: (row.questionsSnapshot ?? []) as InterviewQuestion[],
    answers: (row.answers ?? {}) as InterviewAnswers,
    overallNotes: row.overallNotes,
    decision: row.decision,
    refusalReason: row.refusalReason,
    aiSummary: row.aiSummary,
    aiSummaryGeneratedAt: row.aiSummaryGeneratedAt?.toISOString() ?? null,
    conductedByName: row.conductedByName,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listCandidateInterviews(candidateId: string): Promise<CandidateInterviewRow[]> {
  const rows = await db
    .select({
      id: interviews.id,
      status: interviews.status,
      trameName: interviews.trameName,
      subcategory: interviews.subcategory,
      decision: interviews.decision,
      questionsSnapshot: interviews.questionsSnapshot,
      answers: interviews.answers,
      aiSummary: interviews.aiSummary,
      conductedByName: profiles.fullName,
      completedAt: interviews.completedAt,
      createdAt: interviews.createdAt,
    })
    .from(interviews)
    .leftJoin(profiles, eq(profiles.id, interviews.conductedBy))
    .where(eq(interviews.candidateId, candidateId))
    .orderBy(desc(interviews.createdAt));

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    trameName: r.trameName,
    subcategory: r.subcategory,
    decision: r.decision,
    averageScore: computeAverageScore(
      (r.questionsSnapshot ?? []) as InterviewQuestion[],
      (r.answers ?? {}) as InterviewAnswers
    ),
    aiSummary: r.aiSummary,
    conductedByName: r.conductedByName,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}
