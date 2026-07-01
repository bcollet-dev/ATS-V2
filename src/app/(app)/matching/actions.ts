"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { matchings, candidates, needs, companies, cursus, documents, profiles, companyContacts, mailTemplates } from "@/db/schema";
import { eq, isNull, and, asc, notInArray, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivityEvent } from "@/lib/activity";
import { substituteVariables, stripHtml, type MailVariableContext } from "@/lib/mail-variables";
import { renderSignatureHtml } from "@/lib/signature";

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

// Statuts éligibles au recalcul automatique depuis les matchings
const SYNC_ALLOWED_NEED_STATUSES = new Set([
  "need_in_progress", "a_shooter", "cv_envoye", "interview", "waiting_fre",
]);

// Statuts qui ne doivent pas être downgradés vers need_in_progress quand aucun matching avancé
const NO_DOWNGRADE_STATUSES = new Set(["a_shooter", "cv_envoye"]);

export async function syncNeedStatusFromMatchings(needId: string): Promise<void> {
  const [needRow] = await db
    .select({ status: needs.status })
    .from(needs)
    .where(eq(needs.id, needId));

  if (!needRow || !SYNC_ALLOWED_NEED_STATUSES.has(needRow.status)) return;

  // If a winner (placed) already exists, don't auto-sync
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
    // Don't downgrade from a_shooter or cv_envoye — those are set intentionally
    targetStatus = NO_DOWNGRADE_STATUSES.has(needRow.status)
      ? needRow.status
      : "need_in_progress";
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

// Statuts besoin "bas" — passage automatique à a_shooter dès qu'un matching est créé
const LOW_NEED_STATUSES = ["ad_chase", "prospect", "need_in_progress"] as const;

export async function createMatching(candidateId: string, needId: string): Promise<CreateResult> {
  const actor = await requireAuth();
  const existing = await db
    .select({ id: matchings.id })
    .from(matchings)
    .where(and(eq(matchings.candidateId, candidateId), eq(matchings.needId, needId)));
  if (existing.length > 0) return { success: false, error: "Ce candidat est déjà proposé sur ce besoin." };

  const [needRow, candidateRow] = await Promise.all([
    db.select({ status: needs.status }).from(needs).where(eq(needs.id, needId)).limit(1),
    db.select({ firstName: candidates.firstName, lastName: candidates.lastName }).from(candidates).where(eq(candidates.id, candidateId)).limit(1),
  ]);

  const [created] = await db.insert(matchings).values({ candidateId, needId }).returning({ id: matchings.id });

  // Bump need to a_shooter if currently at a low status
  if (needRow[0] && (LOW_NEED_STATUSES as readonly string[]).includes(needRow[0].status)) {
    await db
      .update(needs)
      .set({ status: "a_shooter", updatedAt: new Date() })
      .where(eq(needs.id, needId));
  }

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
  const [row] = await db
    .select({
      needId: matchings.needId,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
    })
    .from(matchings)
    .innerJoin(candidates, eq(matchings.candidateId, candidates.id))
    .where(eq(matchings.id, id));

  await db
    .update(matchings)
    .set({
      propositionStatus: status as never,
      updatedAt: new Date(),
      ...(refusalReason !== undefined ? { refusalReason } : {}),
    })
    .where(eq(matchings.id, id));

  if (row) {
    await syncNeedStatusFromMatchings(row.needId);
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
  }

  revalidatePath("/besoins");
  revalidatePath("/candidats");
}

export async function markMatchingWinner(matchingId: string): Promise<void> {
  const actor = await requireAuth();

  const [row] = await db
    .select({
      needId: matchings.needId,
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
  await db
    .update(matchings)
    .set({ isFrozen: true, updatedAt: new Date() })
    .where(
      and(
        eq(matchings.needId, row.needId),
        notInArray(matchings.id, [matchingId])
      )
    );

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
  const [row] = await db
    .select({
      needId: matchings.needId,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
    })
    .from(matchings)
    .innerJoin(candidates, eq(matchings.candidateId, candidates.id))
    .where(eq(matchings.id, id));

  await db.delete(matchings).where(eq(matchings.id, id));

  if (row) {
    await syncNeedStatusFromMatchings(row.needId);
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
  await requireAuth();
  await db.delete(matchings).where(eq(matchings.needId, needId));
  revalidatePath("/besoins");
  revalidatePath("/candidats");
  revalidatePath("/matching");
}

export async function deleteAllMatchingsForCandidate(candidateId: string): Promise<void> {
  await requireAuth();
  const rows = await db
    .select({ needId: matchings.needId })
    .from(matchings)
    .where(eq(matchings.candidateId, candidateId));
  await db.delete(matchings).where(eq(matchings.candidateId, candidateId));
  const needIds = [...new Set(rows.map((r) => r.needId as string))];
  await Promise.all(needIds.map(syncNeedStatusFromMatchings));
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
  const newPairs = pairs.filter((p) => !existingSet.has(`${p.candidateId}:${p.needId}`));

  if (newPairs.length > 0) {
    await db.insert(matchings).values(
      newPairs.map((p) => ({ candidateId: p.candidateId, needId: p.needId }))
    );
    const affectedNeedIds = [...new Set(newPairs.map((p) => p.needId))];

    // Bump needs with low status to a_shooter
    await db
      .update(needs)
      .set({ status: "a_shooter", updatedAt: new Date() })
      .where(
        and(
          inArray(needs.id, affectedNeedIds),
          inArray(needs.status, [...LOW_NEED_STATUSES] as never[])
        )
      );

    await Promise.all(affectedNeedIds.map(syncNeedStatusFromMatchings));
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
        notInArray(candidates.status, [
          "to_call", "in_progress", "no_response", "interview", "pvpp",
          "temporary_refusal", "definitive_refusal",
        ])
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
  storagePath: string;
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
          .select({ candidateId: documents.candidateId, id: documents.id, fileName: documents.fileName, storagePath: documents.storagePath })
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
      storagePath: r.storagePath,
    };
  }

  return {
    contactsByCompanyId,
    templates: templateRows,
    cvByCandidate,
    hasGmailConnected: !!user.googleRefreshToken,
  };
}

type GmailAttachment = {
  filename: string;
  content: Buffer;
};

type GmailMessageParams = {
  fromEmail: string;
  fromName: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: GmailAttachment[];
};

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeHeader(value: string): string {
  const safe = sanitizeHeader(value);
  if (/^[\x20-\x7E]*$/.test(safe)) return safe;
  return `=?UTF-8?B?${Buffer.from(safe, "utf8").toString("base64")}?=`;
}

function encodeQuotedParam(value: string): string {
  return sanitizeHeader(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function wrapBase64(value: string): string {
  return value.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildBase64Part(content: string | Buffer): string {
  const raw = typeof content === "string"
    ? Buffer.from(content, "utf8").toString("base64")
    : content.toString("base64");
  return wrapBase64(raw);
}

function buildGmailMimeMessage({
  fromEmail,
  fromName,
  to,
  cc,
  bcc,
  subject,
  html,
  text,
  attachments = [],
}: GmailMessageParams): string {
  const mixedBoundary = `mixed_${crypto.randomUUID()}`;
  const alternativeBoundary = `alt_${crypto.randomUUID()}`;
  const hasAttachments = attachments.length > 0;
  const headers = [
    `From: ${encodeHeader(fromName)} <${sanitizeHeader(fromEmail)}>`,
    `To: ${sanitizeHeader(to)}`,
    cc ? `Cc: ${sanitizeHeader(cc)}` : null,
    bcc ? `Bcc: ${sanitizeHeader(bcc)}` : null,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    hasAttachments
      ? `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`
      : `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
  ].filter((header): header is string => header !== null);

  const alternativeParts = [
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    buildBase64Part(text),
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    buildBase64Part(html),
    `--${alternativeBoundary}--`,
  ].join("\r\n");

  if (!hasAttachments) {
    return [...headers, "", alternativeParts].join("\r\n");
  }

  const attachmentParts = attachments.map((attachment) => {
    const filename = encodeQuotedParam(attachment.filename);
    return [
      `--${mixedBoundary}`,
      `Content-Type: application/octet-stream; name="${filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${filename}"`,
      "",
      buildBase64Part(attachment.content),
    ].join("\r\n");
  });

  return [
    ...headers,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    alternativeParts,
    ...attachmentParts,
    `--${mixedBoundary}--`,
  ].join("\r\n");
}

async function getGmailAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? body.error ?? "Impossible d'obtenir un jeton Gmail valide.");
  }
  return body.access_token;
}

async function sendGmailMessage(accessToken: string, message: GmailMessageParams): Promise<void> {
  const mimeMessage = buildGmailMimeMessage(message);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: toBase64Url(mimeMessage) }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Erreur Gmail API (${response.status})`);
  }
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
        error: "Token Gmail non disponible. Reconnectez-vous avec Google pour autoriser l'envoi d'emails.",
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
  const supabase = await createClient();
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
      refreshToken: user.googleRefreshToken,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Connexion Gmail invalide. Reconnectez votre compte Gmail.";
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

  // Auto-set cv_envoye for needs that were successfully emailed from a_shooter status
  const successNeedIds = results.filter((r) => r.success).map((r) => r.needId);
  if (successNeedIds.length > 0) {
    await db
      .update(needs)
      .set({ status: "cv_envoye", updatedAt: new Date() })
      .where(
        and(
          inArray(needs.id, successNeedIds),
          eq(needs.status, "a_shooter")
        )
      );
    revalidatePath("/besoins");
    revalidatePath("/matching");
  }

  return { results };
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
    revalidatePath("/trames-mail");
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
