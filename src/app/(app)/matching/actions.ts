"use server";

import { requireAuth } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { db } from "@/db";
import { matchings, candidates, needs, companies, classes, cursus, needCursus, appSettings, documents, profiles, companyContacts, mailTemplates } from "@/db/schema";
import { sendSlackNotification, buildFreBlocks, buildEntretienBlocks } from "@/lib/slack";
import { eq, isNull, isNotNull, and, asc, notInArray, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createStorageClient } from "@/lib/supabase/server";
import { logActivityEvent } from "@/lib/activity";
import { substituteVariables, stripHtml, type MailVariableContext } from "@/lib/mail-variables";
import { renderSignatureHtml } from "@/lib/signature";
import { getGmailAccessToken, sendGmailMessage } from "@/lib/gmail-api";
import { decryptSecret } from "@/lib/secret-box";
import {
  canCandidateBeMatched,
  canNeedBeMatched,
  deriveCandidateStatusFromPropositions,
  deriveNeedStatusFromPropositions,
  winnerDowngradeReleasesFreeze,
  MATCHING_ALLOWED_CANDIDATE_STATUSES,
  MATCHING_ALLOWED_NEED_STATUSES,
} from "./rules";

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
    .where(and(eq(matchings.needId, needId), isNull(candidates.deletedAt)))
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
        inArray(candidates.status, [...MATCHING_ALLOWED_CANDIDATE_STATUSES] as never[]),
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
        isNull(companies.deletedAt),
        inArray(needs.status, [...MATCHING_ALLOWED_NEED_STATUSES] as never[]),
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

// Statuts éligibles au recalcul automatique depuis les matchings
const SYNC_ALLOWED_NEED_STATUSES = new Set([
  "need_in_progress", "a_shooter", "cv_envoye", "interview", "waiting_fre", "client",
]);

export async function syncNeedStatusFromMatchings(needId: string): Promise<void> {
  const [needRow] = await db
    .select({ status: needs.status })
    .from(needs)
    .where(eq(needs.id, needId));

  if (!needRow || !SYNC_ALLOWED_NEED_STATUSES.has(needRow.status)) return;

  const actives = await db
    .select({ propositionStatus: matchings.propositionStatus })
    .from(matchings)
    .where(
      and(
        eq(matchings.needId, needId),
        notInArray(matchings.propositionStatus, ["not_retained"]),
        eq(matchings.isFrozen, false)
      )
    );

  const targetStatus = deriveNeedStatusFromPropositions(
    actives.map((m) => m.propositionStatus)
  );

  if (targetStatus !== needRow.status) {
    await db
      .update(needs)
      .set({ status: targetStatus as never, updatedAt: new Date() })
      .where(eq(needs.id, needId));
    revalidatePath("/besoins");
  }
}

const SYNC_ALLOWED_CANDIDATE_STATUSES = new Set([
  "admissible", "company_interview", "waiting_fre", "placed",
]);

export async function syncCandidateStatusFromMatchings(candidateId: string): Promise<void> {
  const [candidateRow] = await db
    .select({ status: candidates.status })
    .from(candidates)
    .where(eq(candidates.id, candidateId));

  if (!candidateRow || !SYNC_ALLOWED_CANDIDATE_STATUSES.has(candidateRow.status)) return;

  const actives = await db
    .select({ propositionStatus: matchings.propositionStatus })
    .from(matchings)
    .where(
      and(
        eq(matchings.candidateId, candidateId),
        notInArray(matchings.propositionStatus, ["not_retained"]),
        eq(matchings.isFrozen, false)
      )
    );

  const targetStatus = deriveCandidateStatusFromPropositions(
    actives.map((m) => m.propositionStatus)
  );

  if (targetStatus !== candidateRow.status) {
    await db
      .update(candidates)
      .set({ status: targetStatus as never, updatedAt: new Date() })
      .where(eq(candidates.id, candidateId));
    revalidatePath("/candidats");
  }
}

// ─── Slack helpers ───────────────────────────────────────────────────────────

async function sendFreSlackFromMatching(row: {
  firstName: string;
  lastName: string;
  needId: string;
  classId: string | null;
}): Promise<void> {
  try {
    const [needRow] = await db
      .select({ companyId: needs.companyId })
      .from(needs)
      .where(eq(needs.id, row.needId))
      .limit(1);

    const companyId = needRow?.companyId;
    const companyName = companyId
      ? (await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).limit(1))[0]?.name ?? "Entreprise"
      : "Entreprise";

    const candidateName = `${row.firstName} ${row.lastName.toUpperCase()}`;

    let targets: { name: string; slackWebhookUrl: string }[];

    if (row.classId) {
      const [cls] = await db
        .select({ name: classes.name, slackWebhookUrl: classes.slackWebhookUrl })
        .from(classes).where(eq(classes.id, row.classId)).limit(1);
      targets = cls?.slackWebhookUrl ? [{ name: cls.name, slackWebhookUrl: cls.slackWebhookUrl }] : [];
    } else {
      // Classe pas encore choisie : remonter via needCursus pour trouver les canaux liés au besoin
      const rows = await db
        .select({ name: classes.name, slackWebhookUrl: classes.slackWebhookUrl })
        .from(needCursus)
        .innerJoin(cursus, eq(needCursus.cursusId, cursus.id))
        .innerJoin(classes, eq(classes.cursusId, cursus.id))
        .where(and(eq(needCursus.needId, row.needId), eq(classes.active, true), isNotNull(classes.slackWebhookUrl)));
      targets = rows.filter((r): r is { name: string; slackWebhookUrl: string } => r.slackWebhookUrl !== null);
    }

    if (targets.length === 0) return;

    await Promise.all(
      targets.map((cls) =>
        sendSlackNotification(cls.slackWebhookUrl, buildFreBlocks({ candidateName, companyName, className: cls.name }))
      )
    );
  } catch {
    // Non-blocking
  }
}

async function getGlobalWebhookUrl(): Promise<string | null> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, "slack_global_webhook"))
    .limit(1);
  const val = row?.value;
  return typeof val === "string" && val ? val : null;
}

async function sendEntretienSlackNotification(row: {
  firstName: string;
  lastName: string;
  needId: string;
}): Promise<void> {
  try {
    const [webhookUrl, needRow] = await Promise.all([
      getGlobalWebhookUrl(),
      db.select({ companyId: needs.companyId }).from(needs).where(eq(needs.id, row.needId)).limit(1),
    ]);

    if (!webhookUrl) return;

    const companyId = needRow[0]?.companyId;
    const companyName = companyId
      ? (await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).limit(1))[0]?.name ?? "Entreprise"
      : "Entreprise";

    await sendSlackNotification(
      webhookUrl,
      buildEntretienBlocks({
        candidateName: `${row.firstName} ${row.lastName.toUpperCase()}`,
        companyName,
      }),
    );
  } catch {
    // Non-blocking
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

type CreateResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string };

export async function createMatching(candidateId: string, needId: string): Promise<CreateResult> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "matchings:create")) return { success: false, error: "Non autorisé" };
  const existing = await db
    .select({ id: matchings.id })
    .from(matchings)
    .where(and(eq(matchings.candidateId, candidateId), eq(matchings.needId, needId)));
  if (existing.length > 0) return { success: false, error: "Ce candidat est déjà proposé sur ce besoin." };

  const [needRow, candidateRow] = await Promise.all([
    db.select({ status: needs.status }).from(needs).where(eq(needs.id, needId)).limit(1),
    db.select({ firstName: candidates.firstName, lastName: candidates.lastName, status: candidates.status }).from(candidates).where(eq(candidates.id, candidateId)).limit(1),
  ]);

  if (!candidateRow[0] || !canCandidateBeMatched(candidateRow[0].status)) {
    return { success: false, error: "Le candidat doit être au moins Admissible pour être proposé sur un besoin." };
  }

  if (!needRow[0] || !canNeedBeMatched(needRow[0].status)) {
    return { success: false, error: "Le besoin doit etre au moins en statut Besoin en cours pour recevoir un candidat." };
  }

  const [created] = await db.insert(matchings).values({ candidateId, needId }).returning({ id: matchings.id });

  await Promise.all([
    syncCandidateStatusFromMatchings(candidateId),
    syncNeedStatusFromMatchings(needId),
  ]);

  const name = candidateRow[0] ? `${candidateRow[0].firstName} ${candidateRow[0].lastName}` : "Candidat";
  await logActivityEvent({
    needId,
    actorId: actor.id,
    actionType: "matching_added",
    summary: `${name} ajouté à la proposition`,
  });

  revalidatePath("/besoins");
  revalidatePath("/candidats");
  revalidatePath("/matching");
  return { success: true, data: created };
}

export async function updateMatchingStatus(
  id: string,
  status: string,
  refusalReason?: string
): Promise<void> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "matchings:editStatus")) {
    throw new Error("Vous n'avez pas les droits pour modifier un statut de proposition");
  }
  const [row] = await db
    .select({
      needId: matchings.needId,
      candidateId: matchings.candidateId,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      classId: matchings.classId,
      isWinner: matchings.isWinner,
      isFrozen: matchings.isFrozen,
    })
    .from(matchings)
    .innerJoin(candidates, eq(matchings.candidateId, candidates.id))
    .where(eq(matchings.id, id));
  if (!row) return;

  // Gel en écriture : un matching gelé par la sélection d'un gagnant ne bouge
  // plus tant que le gagnant n'est pas rétrogradé (qui déclenche le dégel).
  if (row.isFrozen) {
    throw new Error("Matching gelé par la sélection d'un gagnant — rétrogradez d'abord le gagnant du besoin");
  }

  const releasesFreeze = winnerDowngradeReleasesFreeze(row.isWinner, status);

  await db
    .update(matchings)
    .set({
      propositionStatus: status as never,
      updatedAt: new Date(),
      ...(releasesFreeze ? { isWinner: false } : {}),
      ...(refusalReason !== undefined ? { refusalReason } : {}),
    })
    .where(eq(matchings.id, id));

  // FRE annulé : libérer les matchings gelés du besoin et resynchroniser
  // leurs candidats (CONTEXT.md — le gel se débloque si le FRE est annulé)
  let releasedCandidateIds: string[] = [];
  if (releasesFreeze) {
    const frozen = await db
      .select({ candidateId: matchings.candidateId })
      .from(matchings)
      .where(and(eq(matchings.needId, row.needId), eq(matchings.isFrozen, true)));
    if (frozen.length > 0) {
      await db
        .update(matchings)
        .set({ isFrozen: false, updatedAt: new Date() })
        .where(and(eq(matchings.needId, row.needId), eq(matchings.isFrozen, true)));
      releasedCandidateIds = [...new Set(frozen.map((m) => m.candidateId as string))];
    }
  }

  {
    await Promise.all([
      syncCandidateStatusFromMatchings(row.candidateId),
      syncNeedStatusFromMatchings(row.needId),
      ...releasedCandidateIds.map(syncCandidateStatusFromMatchings),
    ]);
    const statusLabels: Record<string, string> = {
      cv_sent: "CV envoyé", interview: "Entretien prévu",
      waiting_fre: "Retenu", not_retained: "Non retenu", placed: "Placé",
    };
    await logActivityEvent({
      needId: row.needId,
      actorId: actor.id,
      actionType: "matching_status_changed",
      summary: `${row.firstName} ${row.lastName} passé en ${statusLabels[status] ?? status}`,
    });
    if (status === "waiting_fre") {
      void sendFreSlackFromMatching({
        firstName: row.firstName,
        lastName: row.lastName,
        needId: row.needId,
        classId: row.classId,
      });
    }
    if (status === "interview") {
      void sendEntretienSlackNotification({
        firstName: row.firstName,
        lastName: row.lastName,
        needId: row.needId,
      });
    }
  }

  revalidatePath("/besoins");
  revalidatePath("/candidats");
}

export async function markMatchingWinner(matchingId: string): Promise<void> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "matchings:editStatus")) {
    throw new Error("Vous n'avez pas les droits pour sélectionner un gagnant");
  }

  const [row] = await db
    .select({
      needId: matchings.needId,
      candidateId: matchings.candidateId,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
    })
    .from(matchings)
    .innerJoin(candidates, eq(matchings.candidateId, candidates.id))
    .where(eq(matchings.id, matchingId));
  if (!row) return;

  // Mark winner + placed
  await db
    .update(matchings)
    .set({ isWinner: true, isFrozen: false, propositionStatus: "placed", updatedAt: new Date() })
    .where(eq(matchings.id, matchingId));

  // Freeze all others on same need
  const frozenSiblings = await db
    .update(matchings)
    .set({ isFrozen: true, updatedAt: new Date() })
    .where(
      and(
        eq(matchings.needId, row.needId),
        notInArray(matchings.id, [matchingId])
      )
    )
    .returning({ candidateId: matchings.candidateId });

  // Resynchroniser aussi les candidats gelés : leurs matchings sortent de la
  // dérivation, ils doivent retomber sur leur statut réel (repli Admissible)
  const frozenCandidateIds = [...new Set(frozenSiblings.map((m) => m.candidateId as string))]
    .filter((cid) => cid !== row.candidateId);

  await Promise.all([
    syncCandidateStatusFromMatchings(row.candidateId),
    syncNeedStatusFromMatchings(row.needId),
    ...frozenCandidateIds.map(syncCandidateStatusFromMatchings),
  ]);

  await logActivityEvent({
    needId: row.needId,
    actorId: actor.id,
    actionType: "matching_status_changed",
    summary: `${row.firstName} ${row.lastName} retenu (placé)`,
  });

  revalidatePath("/besoins");
  revalidatePath("/candidats");
}

export async function deleteMatching(id: string): Promise<void> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "matchings:editStatus")) {
    throw new Error("Vous n'avez pas les droits pour retirer une proposition");
  }
  const [row] = await db
    .select({
      needId: matchings.needId,
      candidateId: matchings.candidateId,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      isFrozen: matchings.isFrozen,
    })
    .from(matchings)
    .innerJoin(candidates, eq(matchings.candidateId, candidates.id))
    .where(eq(matchings.id, id));

  if (row?.isFrozen) {
    throw new Error("Matching gelé par la sélection d'un gagnant — rétrogradez d'abord le gagnant du besoin");
  }

  await db.delete(matchings).where(eq(matchings.id, id));

  if (row) {
    await Promise.all([
      syncCandidateStatusFromMatchings(row.candidateId),
      syncNeedStatusFromMatchings(row.needId),
    ]);
    await logActivityEvent({
      needId: row.needId,
      actorId: actor.id,
      actionType: "matching_removed",
      summary: `${row.firstName} ${row.lastName} retiré de la proposition`,
    });
  }

  revalidatePath("/besoins");
  revalidatePath("/candidats");
  revalidatePath("/matching");
}

// Revalidate need-specific path
export async function deleteAllMatchingsForNeed(needId: string): Promise<void> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "needs:edit")) {
    throw new Error("Vous n'avez pas les droits pour retirer les propositions de ce besoin");
  }
  const rows = await db
    .select({ candidateId: matchings.candidateId })
    .from(matchings)
    .where(eq(matchings.needId, needId));
  await db.delete(matchings).where(eq(matchings.needId, needId));
  const candidateIds = [...new Set(rows.map((r) => r.candidateId as string))];
  await Promise.all([
    syncNeedStatusFromMatchings(needId),
    ...candidateIds.map(syncCandidateStatusFromMatchings),
  ]);
  revalidatePath("/besoins");
  revalidatePath("/candidats");
  revalidatePath("/matching");
}

export async function deleteAllMatchingsForCandidate(candidateId: string): Promise<void> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "candidates:edit")) {
    throw new Error("Vous n'avez pas les droits pour retirer les propositions de ce candidat");
  }
  const rows = await db
    .select({ needId: matchings.needId })
    .from(matchings)
    .where(eq(matchings.candidateId, candidateId));
  await db.delete(matchings).where(eq(matchings.candidateId, candidateId));
  const needIds = [...new Set(rows.map((r) => r.needId as string))];
  await Promise.all([
    syncCandidateStatusFromMatchings(candidateId),
    ...needIds.map(syncNeedStatusFromMatchings),
  ]);
  revalidatePath("/besoins");
  revalidatePath("/candidats");
  revalidatePath("/matching");
}

export async function revalidateNeed(needId: string): Promise<void> {
  revalidatePath(`/besoins/${needId}`);
  revalidatePath("/besoins");
}

export async function revalidateCandidat(candidateId: string): Promise<void> {
  revalidatePath(`/candidats/${candidateId}`);
  revalidatePath("/candidats");
}

// ─── Batch create ────────────────────────────────────────────────────────────

export async function batchCreateMatchings(
  pairs: { candidateId: string; needId: string }[]
): Promise<{ created: number; skipped: number }> {
  await requireAuth();
  if (pairs.length === 0) return { created: 0, skipped: 0 };

  const candidateIds = [...new Set(pairs.map((p) => p.candidateId))];
  const needIds = [...new Set(pairs.map((p) => p.needId))];

  const existingPairs = await db
    .select({ candidateId: matchings.candidateId, needId: matchings.needId })
    .from(matchings)
    .where(
      and(
        inArray(matchings.candidateId, candidateIds),
        inArray(matchings.needId, needIds)
      )
    );

  const existingSet = new Set(existingPairs.map((p) => `${p.candidateId}:${p.needId}`));
  const allowedCandidateRows = await db
    .select({ id: candidates.id })
    .from(candidates)
    .where(
      and(
        inArray(candidates.id, candidateIds),
        isNull(candidates.deletedAt),
        inArray(candidates.status, [...MATCHING_ALLOWED_CANDIDATE_STATUSES] as never[])
      )
    );
  const allowedCandidateIds = new Set(allowedCandidateRows.map((c) => c.id));
  const allowedNeedRows = await db
    .select({ id: needs.id })
    .from(needs)
    .where(
      and(
        inArray(needs.id, needIds),
        isNull(needs.deletedAt),
        inArray(needs.status, [...MATCHING_ALLOWED_NEED_STATUSES] as never[])
      )
    );
  const allowedNeedIds = new Set(allowedNeedRows.map((n) => n.id));

  const newPairs = pairs.filter(
    (p) =>
      allowedCandidateIds.has(p.candidateId) &&
      allowedNeedIds.has(p.needId) &&
      !existingSet.has(`${p.candidateId}:${p.needId}`)
  );

  if (newPairs.length > 0) {
    await db.insert(matchings).values(
      newPairs.map((p) => ({ candidateId: p.candidateId, needId: p.needId }))
    );
    const affectedNeedIds = [...new Set(newPairs.map((p) => p.needId))];
    const affectedCandidateIds = [...new Set(newPairs.map((p) => p.candidateId))];

    await Promise.all([
      ...affectedNeedIds.map(syncNeedStatusFromMatchings),
      ...affectedCandidateIds.map(syncCandidateStatusFromMatchings),
    ]);
  }

  revalidatePath("/matching");
  revalidatePath("/besoins");
  revalidatePath("/candidats");

  return { created: newPairs.length, skipped: pairs.length - newPairs.length };
}

// ─── Matching page loaders ────────────────────────────────────────────────────

export type MatchingCandidateRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
  cursusEnvisage: string | null;
  city: string | null;
  ownerId: string | null;
  ownerName: string | null;
  updatedAt: string;
  hasCV: boolean;
  activeMatchingNeedIds: string[];
};

export type ActiveMatchingInfo = {
  matchingId: string;
  candidateId: string;
  candidateFirstName: string;
  candidateLastName: string;
  propositionStatus: string;
  hasCV: boolean;
};

export type MatchingNeedRow = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  targetCursusId: string | null;
  targetCursusName: string | null;
  city: string | null;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  updatedAt: string;
  activeMatchingsCount: number;
  activeMatchings: ActiveMatchingInfo[];
};

export async function loadCandidatesForMatching(): Promise<MatchingCandidateRow[]> {
  await requireAuth();

  const rows = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      email: candidates.email,
      status: candidates.status,
      cursusEnvisage: candidates.cursusEnvisage,
      city: candidates.city,
      ownerId: candidates.ownerId,
      ownerName: profiles.fullName,
      updatedAt: candidates.updatedAt,
    })
    .from(candidates)
    .leftJoin(profiles, eq(candidates.ownerId, profiles.id))
    .where(
      and(
        isNull(candidates.deletedAt),
        inArray(candidates.status, [...MATCHING_ALLOWED_CANDIDATE_STATUSES] as never[])
      )
    )
    .orderBy(asc(candidates.firstName));

  if (rows.length === 0) return [];

  const candidateIds = rows.map((r) => r.id);

  const [cvRows, matchingRows] = await Promise.all([
    db
      .select({ candidateId: documents.candidateId })
      .from(documents)
      .where(and(inArray(documents.candidateId, candidateIds), eq(documents.documentType, "cv"))),
    db
      .select({ candidateId: matchings.candidateId, needId: matchings.needId })
      .from(matchings)
      .where(
        and(
          inArray(matchings.candidateId, candidateIds),
          notInArray(matchings.propositionStatus, ["not_retained"]),
        )
      ),
  ]);

  const cvSet = new Set(cvRows.map((r) => r.candidateId as string));
  const matchingNeedsByCandidate = new Map<string, string[]>();
  for (const r of matchingRows) {
    const cid = r.candidateId as string;
    if (!matchingNeedsByCandidate.has(cid)) matchingNeedsByCandidate.set(cid, []);
    matchingNeedsByCandidate.get(cid)!.push(r.needId as string);
  }

  return rows.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email ?? null,
    status: r.status,
    cursusEnvisage: r.cursusEnvisage ?? null,
    city: r.city ?? null,
    ownerId: r.ownerId ?? null,
    ownerName: r.ownerName ?? null,
    updatedAt: r.updatedAt.toISOString(),
    hasCV: cvSet.has(r.id),
    activeMatchingNeedIds: matchingNeedsByCandidate.get(r.id) ?? [],
  }));
}

// ─── Email modal types ────────────────────────────────────────────────────────

export type EmailModalContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  isPrimary: boolean;
};

export type EmailModalTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export type EmailModalCVInfo = {
  documentId: string;
  fileName: string;
};

export type EmailModalData = {
  contactsByCompanyId: Record<string, EmailModalContact[]>;
  templates: EmailModalTemplate[];
  cvByCandidate: Record<string, EmailModalCVInfo | null>;
  hasGmailConnected: boolean;
};

export async function loadEmailModalData(
  companyIds: string[],
  candidateIds: string[]
): Promise<EmailModalData> {
  const user = await requireAuth();

  const [contactRows, templateRows, cvRows] = await Promise.all([
    companyIds.length > 0
      ? db
          .select({
            id: companyContacts.id,
            companyId: companyContacts.companyId,
            firstName: companyContacts.firstName,
            lastName: companyContacts.lastName,
            email: companyContacts.email,
            isPrimary: companyContacts.isPrimary,
          })
          .from(companyContacts)
          .where(and(inArray(companyContacts.companyId, companyIds), isNull(companyContacts.deletedAt)))
          .orderBy(asc(companyContacts.firstName))
      : Promise.resolve([]),
    db
      .select({ id: mailTemplates.id, name: mailTemplates.name, subject: mailTemplates.subject, body: mailTemplates.body })
      .from(mailTemplates)
      .where(and(
        eq(mailTemplates.active, true),
        isNull(mailTemplates.deletedAt),
        inArray(mailTemplates.audience, ["company", "need", "all"]),
        eq(mailTemplates.isDefaultCvNotification, false)
      ))
      .orderBy(asc(mailTemplates.name)),
    candidateIds.length > 0
      ? db
          .select({ candidateId: documents.candidateId, id: documents.id, fileName: documents.fileName })
          .from(documents)
          .where(and(inArray(documents.candidateId, candidateIds), eq(documents.documentType, "cv")))
      : Promise.resolve([]),
  ]);

  const contactsByCompanyId: Record<string, EmailModalContact[]> = {};
  for (const r of contactRows) {
    if (!contactsByCompanyId[r.companyId]) contactsByCompanyId[r.companyId] = [];
    contactsByCompanyId[r.companyId].push({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      isPrimary: r.isPrimary !== null && r.isPrimary !== "",
    });
  }
  for (const contacts of Object.values(contactsByCompanyId)) {
    contacts.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  }

  const cvByCandidate: Record<string, EmailModalCVInfo | null> = {};
  for (const id of candidateIds) cvByCandidate[id] = null;
  for (const r of cvRows) {
    cvByCandidate[r.candidateId as string] = {
      documentId: r.id,
      fileName: r.fileName,
    };
  }

  return {
    contactsByCompanyId,
    templates: templateRows,
    cvByCandidate,
    hasGmailConnected: !!user.googleRefreshToken,
  };
}

// ─── Send emails ──────────────────────────────────────────────────────────────

export async function sendMatchingEmails(params: {
  notifyCandidates: boolean;
  emails: {
    needId: string;
    recipientEmail: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    cvDocumentIds: string[];
    candidateIds: string[];
  }[];
}): Promise<{ results: { needId: string; success: boolean; error?: string }[] }> {
  const user = await requireAuth();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      results: params.emails.map((e) => ({
        needId: e.needId,
        success: false,
        error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET manquants dans l'environnement",
      })),
    };
  }

  if (!user.googleRefreshToken) {
    return {
      results: params.emails.map((e) => ({
        needId: e.needId,
        success: false,
        error: "Gmail n'est pas connecte. Cliquez sur Connecter Gmail dans Trames mail, puis retentez l'envoi.",
      })),
    };
  }

  // ── Build variable context ────────────────────────────────────────────────
  const needIds = params.emails.map((e) => e.needId);
  const recipientEmails = [...new Set(params.emails.map((e) => e.recipientEmail))];

  const [needRows, contactRows] = await Promise.all([
    db
      .select({
        id: needs.id,
        title: needs.title,
        city: needs.city,
        startDate: needs.startDate,
        endDate: needs.endDate,
        contractType: needs.contractType,
        companyName: companies.name,
        companyCity: companies.city,
        companySiret: companies.siret,
      })
      .from(needs)
      .leftJoin(companies, eq(needs.companyId, companies.id))
      .where(inArray(needs.id, needIds)),
    recipientEmails.length > 0
      ? db
          .select({
            email: companyContacts.email,
            firstName: companyContacts.firstName,
            lastName: companyContacts.lastName,
          })
          .from(companyContacts)
          .where(inArray(companyContacts.email, recipientEmails))
      : Promise.resolve([]),
  ]);

  const needCtxMap = new Map(needRows.map((r) => [r.id, r]));
  const contactCtxMap = new Map(contactRows.map((r) => [r.email ?? "", r]));

  const consultantParts = user.fullName.trim().split(/\s+/);
  const consultantPrenom = consultantParts[0] ?? "";
  const consultantNom = consultantParts.slice(1).join(" ");

  // ── Gather all needed document IDs and fetch their metadata + content ─────
  const allDocIds = [...new Set(params.emails.flatMap((e) => e.cvDocumentIds))];

  const docRows = allDocIds.length > 0
    ? await db
        .select({ id: documents.id, fileName: documents.fileName, storagePath: documents.storagePath })
        .from(documents)
        .where(inArray(documents.id, allDocIds))
    : [];

  const docMap = new Map(docRows.map((r) => [r.id, r]));

  // Download files from Supabase Storage
  const supabase = await createStorageClient();
  const fileCache = new Map<string, Buffer>();
  await Promise.all(
    docRows.map(async (doc) => {
      const { data, error } = await supabase.storage.from("documents").download(doc.storagePath);
      if (!error && data) {
        fileCache.set(doc.id, Buffer.from(await data.arrayBuffer()));
      }
    })
  );

  let accessToken: string;
  try {
    accessToken = await getGmailAccessToken({
      clientId,
      clientSecret,
      refreshToken: decryptSecret(user.googleRefreshToken),
    });
  } catch (err) {
    const error = err instanceof Error
      ? `${err.message} Reconnectez Gmail puis retentez l'envoi.`
      : "Connexion Gmail invalide. Reconnectez Gmail puis retentez l'envoi.";
    return {
      results: params.emails.map((e) => ({
        needId: e.needId,
        success: false,
        error,
      })),
    };
  }

  const results: { needId: string; success: boolean; error?: string }[] = [];

  // Signature HTML computed once — same for all emails in the batch
  const hasSig = !!(user.sigJobTitle || user.sigPhone || user.sigEntity || user.sigLinkedinUrl || user.sigInstagramUrl);
  const sigHtml = hasSig
    ? renderSignatureHtml({
        fullName:     user.fullName,
        jobTitle:     user.sigJobTitle,
        entity:       user.sigEntity,
        phone:        user.sigPhone,
        photoUrl:     user.sigPhotoUrl,
        linkedinUrl:  user.sigLinkedinUrl,
        instagramUrl: user.sigInstagramUrl,
      })
    : null;

  for (const email of params.emails) {
    const attachments = email.cvDocumentIds
      .map((id) => {
        const doc = docMap.get(id);
        const content = fileCache.get(id);
        if (!doc || !content) return null;
        return { filename: doc.fileName, content };
      })
      .filter((a): a is { filename: string; content: Buffer } => a !== null);

    // Build variable context for this email
    const needCtx = needCtxMap.get(email.needId);
    const contact = contactCtxMap.get(email.recipientEmail);
    const context: MailVariableContext = {
      nom_besoin:        needCtx?.title        ?? "",
      titre_poste:       needCtx?.title        ?? "",
      ville_poste:       needCtx?.city         ?? "",
      date_debut:        needCtx?.startDate     ?? "",
      date_fin:          needCtx?.endDate       ?? "",
      type_contrat:      needCtx?.contractType  ?? "",
      entreprise_associee: needCtx?.companyName ?? "",
      nom_entreprise:    needCtx?.companyName   ?? "",
      ville_entreprise:  needCtx?.companyCity   ?? "",
      siret_entreprise:  needCtx?.companySiret  ?? "",
      prenom_contact:    contact?.firstName     ?? "",
      nom_contact:       contact?.lastName      ?? "",
      prenom_consultant: consultantPrenom,
      nom_consultant:    consultantNom,
      nom_ecole:         "EDA Groupe",
    };

    const finalSubject = substituteVariables(email.subject, context);
    const substitutedBody = substituteVariables(email.body, context);
    const finalHtml = sigHtml
      ? `${substitutedBody}<br><br><hr style="border:none;border-top:1px solid #eee;margin:16px 0"><br>${sigHtml}`
      : substitutedBody;

    try {
      await sendGmailMessage(accessToken, {
        fromEmail: user.email,
        fromName: "EDA Groupe",
        to: email.recipientEmail,
        cc: email.cc,
        bcc: email.bcc,
        subject: finalSubject,
        html: finalHtml,
        text: stripHtml(finalHtml),
        attachments,
      });
      results.push({ needId: email.needId, success: true });
    } catch (err) {
      results.push({
        needId: email.needId,
        success: false,
        error: err instanceof Error ? err.message : "Erreur d'envoi inconnue",
      });
    }
  }

  // ── Candidate notifications ───────────────────────────────────────────────
  if (params.notifyCandidates) {
    const [defaultTpl] = await db
      .select({ id: mailTemplates.id, subject: mailTemplates.subject, body: mailTemplates.body })
      .from(mailTemplates)
      .where(and(eq(mailTemplates.isDefaultCvNotification, true), isNull(mailTemplates.deletedAt)))
      .limit(1);

    if (defaultTpl) {
      const allCandidateIds = [...new Set(params.emails.flatMap((e) => e.candidateIds))];
      const candRows = allCandidateIds.length > 0
        ? await db
            .select({ id: candidates.id, firstName: candidates.firstName, lastName: candidates.lastName, email: candidates.email })
            .from(candidates)
            .where(inArray(candidates.id, allCandidateIds))
        : [];
      const candMap = new Map(candRows.map((c) => [c.id, c]));

      for (const email of params.emails) {
        const wasSuccess = results.find((r) => r.needId === email.needId)?.success;
        if (!wasSuccess) continue;
        const needCtx = needCtxMap.get(email.needId);
        const contact  = contactCtxMap.get(email.recipientEmail);

        for (const candidateId of email.candidateIds) {
          const cand = candMap.get(candidateId);
          if (!cand?.email) continue;

          const notifContext: MailVariableContext = {
            prenom_candidat:   cand.firstName,
            nom_candidat:      cand.lastName,
            nom_besoin:        needCtx?.title        ?? "",
            titre_poste:       needCtx?.title        ?? "",
            ville_poste:       needCtx?.city         ?? "",
            date_debut:        needCtx?.startDate     ?? "",
            date_fin:          needCtx?.endDate       ?? "",
            type_contrat:      needCtx?.contractType  ?? "",
            entreprise_associee: needCtx?.companyName ?? "",
            nom_entreprise:    needCtx?.companyName   ?? "",
            ville_entreprise:  needCtx?.companyCity   ?? "",
            siret_entreprise:  needCtx?.companySiret  ?? "",
            prenom_contact:    contact?.firstName     ?? "",
            nom_contact:       contact?.lastName      ?? "",
            prenom_consultant: consultantPrenom,
            nom_consultant:    consultantNom,
            nom_ecole:         "EDA Groupe",
          };

          const notifSubject = substituteVariables(defaultTpl.subject, notifContext);
          const notifBody    = substituteVariables(defaultTpl.body,    notifContext);
          const notifHtml    = sigHtml
            ? `${notifBody}<br><br><hr style="border:none;border-top:1px solid #eee;margin:16px 0"><br>${sigHtml}`
            : notifBody;

          try {
            await sendGmailMessage(accessToken, {
              fromEmail: user.email,
              fromName: "EDA Groupe",
              to: cand.email,
              subject: notifSubject,
              html: notifHtml,
              text: stripHtml(notifHtml),
            });
          } catch (err) {
            console.error(`[notif-candidat] Échec envoi à ${cand.email}:`, err);
          }
        }
      }
    }
  }

  return { results };
}

export async function getCVPreviewUrl(
  candidateId: string
): Promise<{ url: string; fileName: string } | null> {
  await requireAuth();

  const [doc] = await db
    .select({ storagePath: documents.storagePath, fileName: documents.fileName })
    .from(documents)
    .where(and(eq(documents.candidateId, candidateId), eq(documents.documentType, "cv")))
    .limit(1);

  if (!doc) return null;

  const supabase = await createStorageClient();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storagePath, 300);

  if (error || !data) return null;
  return { url: data.signedUrl, fileName: doc.fileName };
}

export async function saveMailTemplate(
  name: string,
  subject: string,
  body: string
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const actor = await requireAuth();
  try {
    const [created] = await db
      .insert(mailTemplates)
      .values({ name: name.trim(), subject, body, audience: "company", createdBy: actor.id })
      .returning({ id: mailTemplates.id });
    revalidatePath("/trames/mail");
    return { success: true, id: created.id };
  } catch {
    return { success: false, error: "Erreur lors de l'enregistrement" };
  }
}

export async function loadNeedsForMatching(): Promise<MatchingNeedRow[]> {
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
      status: needs.status,
      ownerId: needs.ownerId,
      ownerName: profiles.fullName,
      updatedAt: needs.updatedAt,
    })
    .from(needs)
    .leftJoin(companies, eq(needs.companyId, companies.id))
    .leftJoin(cursus, eq(needs.targetCursusId, cursus.id))
    .leftJoin(profiles, eq(needs.ownerId, profiles.id))
    .where(
      and(
        isNull(needs.deletedAt),
        isNull(companies.deletedAt),
        notInArray(needs.status, ["lost", "ad_chase", "prospect"])
      )
    )
    .orderBy(asc(needs.title));

  if (rows.length === 0) return [];

  const needIds = rows.map((r) => r.id);

  const matchingRows = await db
    .select({
      needId: matchings.needId,
      matchingId: matchings.id,
      candidateId: matchings.candidateId,
      candidateFirstName: candidates.firstName,
      candidateLastName: candidates.lastName,
      propositionStatus: matchings.propositionStatus,
    })
    .from(matchings)
    .innerJoin(candidates, eq(matchings.candidateId, candidates.id))
    .where(
      and(
        inArray(matchings.needId, needIds),
        notInArray(matchings.propositionStatus, ["not_retained"]),
        isNull(candidates.deletedAt),
      )
    );

  // Fetch CV status for matched candidates
  const matchedCandidateIds = [...new Set(matchingRows.map((r) => r.candidateId as string))];
  const cvRows = matchedCandidateIds.length > 0
    ? await db
        .select({ candidateId: documents.candidateId })
        .from(documents)
        .where(and(inArray(documents.candidateId, matchedCandidateIds), eq(documents.documentType, "cv")))
    : [];
  const cvSet = new Set(cvRows.map((r) => r.candidateId as string));

  const matchingsByNeed = new Map<string, ActiveMatchingInfo[]>();
  for (const r of matchingRows) {
    const nid = r.needId as string;
    if (!matchingsByNeed.has(nid)) matchingsByNeed.set(nid, []);
    matchingsByNeed.get(nid)!.push({
      matchingId: r.matchingId as string,
      candidateId: r.candidateId as string,
      candidateFirstName: r.candidateFirstName,
      candidateLastName: r.candidateLastName,
      propositionStatus: r.propositionStatus,
      hasCV: cvSet.has(r.candidateId as string),
    });
  }

  return rows.map((r) => {
    const activeMatchings = matchingsByNeed.get(r.id) ?? [];
    return {
      id: r.id,
      title: r.title,
      companyId: r.companyId,
      companyName: r.companyName ?? "—",
      targetCursusId: r.targetCursusId ?? null,
      targetCursusName: r.targetCursusName ?? null,
      city: r.city ?? null,
      status: r.status,
      ownerId: r.ownerId ?? null,
      ownerName: r.ownerName ?? null,
      updatedAt: r.updatedAt.toISOString(),
      activeMatchingsCount: activeMatchings.length,
      activeMatchings,
    };
  });
}
