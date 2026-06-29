"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { matchings, candidates, needs, companies, cursus, documents, profiles, companyContacts, mailTemplates } from "@/db/schema";
import { eq, isNull, and, asc, notInArray, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  status: string;
  cursusEnvisage: string | null;
  city: string | null;
  ownerId: string | null;
  ownerName: string | null;
  updatedAt: string;
  hasCV: boolean;
  activeMatchingNeedIds: string[];
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
  activeMatchingCandidateIds: string[];
};

export async function loadCandidatesForMatching(): Promise<MatchingCandidateRow[]> {
  await requireAuth();

  const rows = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
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
};

export async function loadEmailModalData(
  companyIds: string[],
  candidateIds: string[]
): Promise<EmailModalData> {
  await requireAuth();

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
      .where(and(eq(mailTemplates.active, true), isNull(mailTemplates.deletedAt)))
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
  };
}

// ─── Send emails ──────────────────────────────────────────────────────────────

export async function sendMatchingEmails(params: {
  emails: {
    needId: string;
    recipientEmail: string;
    subject: string;
    body: string;
    cvDocumentIds: string[];
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

  // Gather all needed document IDs and fetch their metadata + content
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

  // Create nodemailer transporter with OAuth2
  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: user.email,
      clientId,
      clientSecret,
      refreshToken: user.googleRefreshToken,
    },
  });

  const results: { needId: string; success: boolean; error?: string }[] = [];

  for (const email of params.emails) {
    const attachments = email.cvDocumentIds
      .map((id) => {
        const doc = docMap.get(id);
        const content = fileCache.get(id);
        if (!doc || !content) return null;
        return { filename: doc.fileName, content };
      })
      .filter((a): a is { filename: string; content: Buffer } => a !== null);

    try {
      await transporter.sendMail({
        from: `"EDA Groupe" <${user.email}>`,
        to: email.recipientEmail,
        subject: email.subject,
        text: email.body,
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

  return { results };
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
    .select({ needId: matchings.needId, candidateId: matchings.candidateId })
    .from(matchings)
    .where(
      and(
        inArray(matchings.needId, needIds),
        notInArray(matchings.propositionStatus, ["not_retained"]),
      )
    );

  const matchingsByNeed = new Map<string, string[]>();
  for (const r of matchingRows) {
    const nid = r.needId as string;
    if (!matchingsByNeed.has(nid)) matchingsByNeed.set(nid, []);
    matchingsByNeed.get(nid)!.push(r.candidateId as string);
  }

  return rows.map((r) => {
    const candidateIds = matchingsByNeed.get(r.id) ?? [];
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
      activeMatchingsCount: candidateIds.length,
      activeMatchingCandidateIds: candidateIds,
    };
  });
}
