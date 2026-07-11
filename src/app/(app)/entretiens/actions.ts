"use server";

import { db } from "@/db";
import { interviews, interviewGrids, cursus, candidates, profiles } from "@/db/schema";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, checkPreviewGuard } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { logActivityEvent } from "@/lib/activity";
import { generateAndStoreInterviewSummary } from "@/lib/interview-summary";
import type { InterviewAnswers, InterviewQuestion } from "@/lib/interview-grid";
import {
  saveGridSchema,
  interviewPayloadSchema,
  type SaveGridInput,
  type InterviewPayloadInput,
} from "./schemas";

// ─── Types ────────────────────────────────────────────────────────────────────

export type GridRow = {
  id: string;
  cursusId: string;
  cursusName: string;
  questions: InterviewQuestion[];
  active: boolean;
  updatedAt: string;
};

export type InterviewCandidateRow = {
  id: string;
  firstName: string;
  lastName: string;
  cursusEnvisage: string | null;
  city: string | null;
  hasGrid: boolean;
  interview: { id: string; status: "draft" | "completed" } | null;
};

export type CompletedInterviewRow = {
  id: string;
  candidateId: string;
  candidateName: string;
  cursusName: string | null;
  recommendation: string | null;
  averageScore: number | null;
  completedAt: string | null;
  conductedByName: string | null;
  hasAiSummary: boolean;
};

export type InterviewDetail = {
  id: string;
  candidateId: string;
  candidateName: string;
  cursusName: string | null;
  status: "draft" | "completed";
  questions: InterviewQuestion[];
  answers: InterviewAnswers;
  overallNotes: string | null;
  recommendation: string | null;
  aiSummary: string | null;
  aiSummaryGeneratedAt: string | null;
  conductedByName: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type CandidateInterviewRow = {
  id: string;
  status: "draft" | "completed";
  cursusName: string | null;
  recommendation: string | null;
  averageScore: number | null;
  aiSummary: string | null;
  conductedByName: string | null;
  completedAt: string | null;
  createdAt: string;
};

type ActionError = { success: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeAverageScore(
  questions: InterviewQuestion[],
  answers: InterviewAnswers
): number | null {
  const scores = questions
    .filter((q) => q.kind === "score")
    .map((q) => answers[q.id]?.score)
    .filter((s): s is number => typeof s === "number");
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

async function requireInterviewEditor(): Promise<
  { user: Awaited<ReturnType<typeof requireAuth>> } | ActionError
> {
  const user = await requireAuth();
  if (!can(user.role as AppRole, "candidates:edit")) {
    return { success: false, error: "Vous n'avez pas les droits pour gérer les entretiens" };
  }
  const guard = await checkPreviewGuard();
  if (guard) return guard;
  return { user };
}

async function findGridForCursusName(
  cursusName: string
): Promise<{ id: string; questions: InterviewQuestion[] } | null> {
  const [row] = await db
    .select({ id: interviewGrids.id, questions: interviewGrids.questions })
    .from(interviewGrids)
    .innerJoin(cursus, eq(cursus.id, interviewGrids.cursusId))
    .where(and(eq(cursus.name, cursusName), eq(interviewGrids.active, true)))
    .limit(1);
  if (!row) return null;
  return { id: row.id, questions: (row.questions ?? []) as InterviewQuestion[] };
}

// ─── Grilles ──────────────────────────────────────────────────────────────────

export async function getInterviewGrids(): Promise<GridRow[]> {
  const rows = await db
    .select({
      id: interviewGrids.id,
      cursusId: interviewGrids.cursusId,
      cursusName: cursus.name,
      questions: interviewGrids.questions,
      active: interviewGrids.active,
      updatedAt: interviewGrids.updatedAt,
    })
    .from(interviewGrids)
    .innerJoin(cursus, eq(cursus.id, interviewGrids.cursusId))
    .orderBy(asc(cursus.name));

  return rows.map((r) => ({
    id: r.id,
    cursusId: r.cursusId,
    cursusName: r.cursusName,
    questions: (r.questions ?? []) as InterviewQuestion[],
    active: r.active,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function saveInterviewGrid(
  input: SaveGridInput
): Promise<{ success: true } | ActionError> {
  const auth = await requireInterviewEditor();
  if ("success" in auth) return auth;

  const parsed = saveGridSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }

  const now = new Date();
  await db
    .insert(interviewGrids)
    .values({
      cursusId: parsed.data.cursusId,
      questions: parsed.data.questions,
      createdBy: auth.user.id,
    })
    .onConflictDoUpdate({
      target: interviewGrids.cursusId,
      set: { questions: parsed.data.questions, active: true, updatedAt: now },
    });

  revalidatePath("/entretiens");
  revalidatePath("/entretiens/grilles");
  return { success: true };
}

export async function deleteInterviewGrid(
  gridId: string
): Promise<{ success: true } | ActionError> {
  const auth = await requireInterviewEditor();
  if ("success" in auth) return auth;

  const deleted = await db
    .delete(interviewGrids)
    .where(eq(interviewGrids.id, gridId))
    .returning({ id: interviewGrids.id });
  if (deleted.length === 0) return { success: false, error: "Grille introuvable" };

  revalidatePath("/entretiens");
  revalidatePath("/entretiens/grilles");
  return { success: true };
}

// ─── Candidats en entretien ───────────────────────────────────────────────────

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
  const [interviewRows, gridCursusNames] = await Promise.all([
    db
      .select({
        id: interviews.id,
        candidateId: interviews.candidateId,
        status: interviews.status,
      })
      .from(interviews)
      .where(inArray(interviews.candidateId, candidateIds))
      .orderBy(desc(interviews.createdAt)),
    db
      .select({ name: cursus.name })
      .from(interviewGrids)
      .innerJoin(cursus, eq(cursus.id, interviewGrids.cursusId))
      .where(eq(interviewGrids.active, true)),
  ]);

  const latestInterview = new Map<string, { id: string; status: "draft" | "completed" }>();
  for (const row of interviewRows) {
    if (!latestInterview.has(row.candidateId)) {
      latestInterview.set(row.candidateId, { id: row.id, status: row.status });
    }
  }
  const gridNames = new Set(gridCursusNames.map((g) => g.name));

  return candidateRows.map((c) => ({
    ...c,
    hasGrid: !!c.cursusEnvisage && gridNames.has(c.cursusEnvisage),
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
      cursusName: interviews.cursusName,
      recommendation: interviews.recommendation,
      gridSnapshot: interviews.gridSnapshot,
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
    cursusName: r.cursusName,
    recommendation: r.recommendation,
    averageScore: computeAverageScore(
      (r.gridSnapshot ?? []) as InterviewQuestion[],
      (r.answers ?? {}) as InterviewAnswers
    ),
    completedAt: r.completedAt?.toISOString() ?? null,
    conductedByName: r.conductedByName,
    hasAiSummary: !!r.aiSummary,
  }));
}

// ─── Cycle de vie d'un entretien ──────────────────────────────────────────────

export async function startInterview(
  candidateId: string
): Promise<{ success: true; interviewId: string } | ActionError> {
  const auth = await requireInterviewEditor();
  if ("success" in auth) return auth;

  const candidat = await db.query.candidates.findFirst({
    where: and(eq(candidates.id, candidateId), isNull(candidates.deletedAt)),
    columns: { id: true, cursusEnvisage: true },
  });
  if (!candidat) return { success: false, error: "Candidat introuvable" };

  // Reprendre un brouillon existant plutôt que d'en créer un second
  const [existingDraft] = await db
    .select({ id: interviews.id })
    .from(interviews)
    .where(and(eq(interviews.candidateId, candidateId), eq(interviews.status, "draft")))
    .limit(1);
  if (existingDraft) return { success: true, interviewId: existingDraft.id };

  if (!candidat.cursusEnvisage) {
    return {
      success: false,
      error: "Aucun cursus envisagé renseigné pour ce candidat — complétez sa fiche avant l'entretien",
    };
  }

  const grid = await findGridForCursusName(candidat.cursusEnvisage);
  if (!grid || grid.questions.length === 0) {
    return {
      success: false,
      error: `Aucune grille d'entretien définie pour le cursus « ${candidat.cursusEnvisage} »`,
    };
  }

  const [created] = await db
    .insert(interviews)
    .values({
      candidateId,
      gridId: grid.id,
      cursusName: candidat.cursusEnvisage,
      gridSnapshot: grid.questions,
      conductedBy: auth.user.id,
    })
    .returning({ id: interviews.id });

  revalidatePath("/entretiens");
  revalidatePath(`/candidats/${candidateId}`);
  return { success: true, interviewId: created.id };
}

export async function getInterviewDetail(interviewId: string): Promise<InterviewDetail | null> {
  const [row] = await db
    .select({
      id: interviews.id,
      candidateId: interviews.candidateId,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      cursusName: interviews.cursusName,
      status: interviews.status,
      gridSnapshot: interviews.gridSnapshot,
      answers: interviews.answers,
      overallNotes: interviews.overallNotes,
      recommendation: interviews.recommendation,
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
    cursusName: row.cursusName,
    status: row.status,
    questions: (row.gridSnapshot ?? []) as InterviewQuestion[],
    answers: (row.answers ?? {}) as InterviewAnswers,
    overallNotes: row.overallNotes,
    recommendation: row.recommendation,
    aiSummary: row.aiSummary,
    aiSummaryGeneratedAt: row.aiSummaryGeneratedAt?.toISOString() ?? null,
    conductedByName: row.conductedByName,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function saveInterviewDraft(
  interviewId: string,
  payload: InterviewPayloadInput
): Promise<{ success: true } | ActionError> {
  const auth = await requireInterviewEditor();
  if ("success" in auth) return auth;

  const parsed = interviewPayloadSchema.safeParse(payload);
  if (!parsed.success) return { success: false, error: "Données invalides" };

  const updated = await db
    .update(interviews)
    .set({
      answers: parsed.data.answers,
      overallNotes: parsed.data.overallNotes?.trim() || null,
      recommendation: parsed.data.recommendation ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(interviews.id, interviewId), eq(interviews.status, "draft")))
    .returning({ id: interviews.id });

  if (updated.length === 0) {
    return { success: false, error: "Entretien introuvable ou déjà finalisé" };
  }
  return { success: true };
}

export async function completeInterview(
  interviewId: string,
  payload: InterviewPayloadInput
): Promise<{ success: true; aiSummaryError?: string } | ActionError> {
  const auth = await requireInterviewEditor();
  if ("success" in auth) return auth;

  const parsed = interviewPayloadSchema.safeParse(payload);
  if (!parsed.success) return { success: false, error: "Données invalides" };

  const now = new Date();
  const [updated] = await db
    .update(interviews)
    .set({
      answers: parsed.data.answers,
      overallNotes: parsed.data.overallNotes?.trim() || null,
      recommendation: parsed.data.recommendation ?? null,
      status: "completed",
      conductedBy: auth.user.id,
      completedAt: now,
      updatedAt: now,
    })
    .where(and(eq(interviews.id, interviewId), eq(interviews.status, "draft")))
    .returning({ id: interviews.id, candidateId: interviews.candidateId });

  if (!updated) return { success: false, error: "Entretien introuvable ou déjà finalisé" };

  const summaryResult = await generateAndStoreInterviewSummary(interviewId);

  const recommendationLabel =
    parsed.data.recommendation === "favorable"
      ? "avis favorable"
      : parsed.data.recommendation === "reserve"
        ? "avis réservé"
        : parsed.data.recommendation === "defavorable"
          ? "avis défavorable"
          : "sans avis";
  await logActivityEvent({
    candidateId: updated.candidateId,
    actorId: auth.user.id,
    actionType: "interview_completed",
    summary: `Entretien EDA réalisé (${recommendationLabel})`,
  });

  revalidatePath("/entretiens");
  revalidatePath(`/entretiens/${interviewId}`);
  revalidatePath(`/candidats/${updated.candidateId}`);

  return summaryResult.success
    ? { success: true }
    : { success: true, aiSummaryError: summaryResult.error };
}

export async function regenerateInterviewSummary(
  interviewId: string
): Promise<{ success: true; summary: string } | ActionError> {
  const auth = await requireInterviewEditor();
  if ("success" in auth) return auth;

  const [row] = await db
    .select({ status: interviews.status, candidateId: interviews.candidateId })
    .from(interviews)
    .where(eq(interviews.id, interviewId))
    .limit(1);
  if (!row) return { success: false, error: "Entretien introuvable" };
  if (row.status !== "completed") {
    return { success: false, error: "L'entretien doit être finalisé avant de générer un résumé" };
  }

  const result = await generateAndStoreInterviewSummary(interviewId);
  if (!result.success) return result;

  revalidatePath(`/entretiens/${interviewId}`);
  revalidatePath(`/candidats/${row.candidateId}`);
  return { success: true, summary: result.summary };
}

export async function deleteDraftInterview(
  interviewId: string
): Promise<{ success: true } | ActionError> {
  const auth = await requireInterviewEditor();
  if ("success" in auth) return auth;

  const deleted = await db
    .delete(interviews)
    .where(and(eq(interviews.id, interviewId), eq(interviews.status, "draft")))
    .returning({ candidateId: interviews.candidateId });
  if (deleted.length === 0) {
    return { success: false, error: "Seul un entretien en brouillon peut être supprimé" };
  }

  revalidatePath("/entretiens");
  revalidatePath(`/candidats/${deleted[0].candidateId}`);
  return { success: true };
}

// ─── Fiche candidat ───────────────────────────────────────────────────────────

export async function listCandidateInterviews(
  candidateId: string
): Promise<CandidateInterviewRow[]> {
  const rows = await db
    .select({
      id: interviews.id,
      status: interviews.status,
      cursusName: interviews.cursusName,
      recommendation: interviews.recommendation,
      gridSnapshot: interviews.gridSnapshot,
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
    cursusName: r.cursusName,
    recommendation: r.recommendation,
    averageScore: computeAverageScore(
      (r.gridSnapshot ?? []) as InterviewQuestion[],
      (r.answers ?? {}) as InterviewAnswers
    ),
    aiSummary: r.aiSummary,
    conductedByName: r.conductedByName,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}
