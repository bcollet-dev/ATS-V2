"use server";

import { db } from "@/db";
import { candidates, activityEvents, documents, taskLinks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { encryptNir, decryptNir } from "@/lib/nir";
import { createClient } from "@/lib/supabase/server";

export type CommuneResult = {
  nom: string;
  code: string;
  departement: string;
  departementNom: string;
};

export async function searchCommune(query: string): Promise<CommuneResult[]> {
  if (query.trim().length < 2) return [];
  try {
    const res = await fetch(
      `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query.trim())}&fields=nom,code,departement&limit=8`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const data = await res.json() as Array<{
      nom: string;
      code: string;
      departement?: { code: string; nom: string };
    }>;
    return data.map((c) => ({
      nom: c.nom,
      code: c.code,
      departement: c.departement?.code ?? "",
      departementNom: c.departement?.nom ?? "",
    }));
  } catch {
    return [];
  }
}

export type UpdateIdentiteInput = {
  title: string;
  firstName: string;
  lastName: string;
  birthName: string;
  birthDate: string;
  birthCity: string;
  birthDepartment: string;
  birthCountry: string;
  nationality: string;
  rqth: boolean;
  nir: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  legalRepFirstName: string;
  legalRepLastName: string;
  legalRepLink: string;
  legalRepPhone: string;
  legalRepEmail: string;
};

const s = (v: string) => v.trim() || null;

export async function updateIdentite(
  candidateId: string,
  input: UpdateIdentiteInput
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  await db.update(candidates).set({
    title: s(input.title),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    birthName: s(input.birthName),
    birthDate: s(input.birthDate),
    birthCity: s(input.birthCity),
    birthDepartment: s(input.birthDepartment),
    birthCountry: s(input.birthCountry),
    nationality: s(input.nationality),
    rqth: input.rqth,
    addressLine1: s(input.addressLine1),
    addressLine2: s(input.addressLine2),
    postalCode: s(input.postalCode),
    city: s(input.city),
    legalRepFirstName: s(input.legalRepFirstName),
    legalRepLastName: s(input.legalRepLastName),
    legalRepLink: s(input.legalRepLink),
    legalRepPhone: s(input.legalRepPhone),
    legalRepEmail: s(input.legalRepEmail),
    updatedAt: new Date(),
  }).where(eq(candidates.id, candidateId));

  if (input.nir.trim() && (user.role === "admin" || user.role === "admissions")) {
    const { encrypted, iv } = encryptNir(input.nir.replace(/\s/g, ""));
    await db.update(candidates).set({ nirEncrypted: encrypted, nirIv: iv })
      .where(eq(candidates.id, candidateId));
  }

  await db.insert(activityEvents).values({
    actorId: user.id,
    candidateId,
    actionType: "candidate.updated",
    summary: `Identité modifiée par ${user.fullName}`,
  });

  revalidatePath(`/candidats/${candidateId}`);
  return { success: true };
}

// ─── Contact ──────────────────────────────────────────────────────────────────

export type UpdateContactInput = {
  email: string;
  phone: string;
};

export async function updateContact(
  candidateId: string,
  input: UpdateContactInput
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  await db.update(candidates).set({
    email: s(input.email),
    phone: s(input.phone),
    updatedAt: new Date(),
  }).where(eq(candidates.id, candidateId));

  await db.insert(activityEvents).values({
    actorId: user.id,
    candidateId,
    actionType: "candidate.updated",
    summary: `Contact modifié par ${user.fullName}`,
  });

  revalidatePath(`/candidats/${candidateId}`);
  return { success: true };
}

// ─── Recrutement ──────────────────────────────────────────────────────────────

export type UpdateRecrutementInput = {
  cursusEnvisage: string;
  source: string;
};

export async function updateRecrutement(
  candidateId: string,
  input: UpdateRecrutementInput
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  await db.update(candidates).set({
    cursusEnvisage: s(input.cursusEnvisage),
    source: s(input.source),
    updatedAt: new Date(),
  }).where(eq(candidates.id, candidateId));

  await db.insert(activityEvents).values({
    actorId: user.id,
    candidateId,
    actionType: "candidate.updated",
    summary: `Recrutement modifié par ${user.fullName}`,
  });

  revalidatePath(`/candidats/${candidateId}`);
  return { success: true };
}

// ─── Représentant légal ───────────────────────────────────────────────────────

export async function deleteCandidate(
  candidateId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifie" };

  const [candidate] = await db
    .select({
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      deletedAt: candidates.deletedAt,
    })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);

  if (!candidate) return { success: false, error: "Candidat introuvable" };
  if (candidate.deletedAt) return { success: true };

  await db
    .update(candidates)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(candidates.id, candidateId));

  await db.insert(activityEvents).values({
    actorId: user.id,
    candidateId,
    actionType: "candidate.deleted",
    summary: `Candidat ${candidate.firstName} ${candidate.lastName} supprime par ${user.fullName}`,
  });

  revalidatePath(`/candidats/${candidateId}`);
  revalidatePath("/candidats");
  revalidatePath("/annuaire");
  revalidatePath("/besoins");
  revalidatePath("/matching");
  revalidatePath("/taches");
  return { success: true };
}

const HARD_DELETE_STATUSES = new Set(["temporary_refusal", "definitive_refusal"]);

export async function permanentlyDeleteCandidate(
  candidateId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifie" };

  const [candidate] = await db
    .select({
      status: candidates.status,
    })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);

  if (!candidate) return { success: false, error: "Candidat introuvable" };
  if (!HARD_DELETE_STATUSES.has(candidate.status)) {
    return { success: false, error: "Le candidat doit d'abord etre archive" };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(taskLinks)
      .where(and(eq(taskLinks.entityType, "candidate"), eq(taskLinks.entityId, candidateId)));

    await tx
      .delete(candidates)
      .where(eq(candidates.id, candidateId));
  });

  revalidatePath("/candidats");
  revalidatePath("/annuaire");
  revalidatePath("/besoins");
  revalidatePath("/matching");
  revalidatePath("/taches");
  return { success: true };
}

export type UpdateRepresentantLegalInput = {
  legalRepFirstName: string;
  legalRepLastName: string;
  legalRepLink: string;
  legalRepPhone: string;
  legalRepEmail: string;
};

export async function updateRepresentantLegal(
  candidateId: string,
  input: UpdateRepresentantLegalInput
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  await db.update(candidates).set({
    legalRepFirstName: s(input.legalRepFirstName),
    legalRepLastName: s(input.legalRepLastName),
    legalRepLink: s(input.legalRepLink),
    legalRepPhone: s(input.legalRepPhone),
    legalRepEmail: s(input.legalRepEmail),
    updatedAt: new Date(),
  }).where(eq(candidates.id, candidateId));

  await db.insert(activityEvents).values({
    actorId: user.id,
    candidateId,
    actionType: "candidate.updated",
    summary: `Représentant légal modifié par ${user.fullName}`,
  });

  revalidatePath(`/candidats/${candidateId}`);
  return { success: true };
}

// ─── NIR ──────────────────────────────────────────────────────────────────────

export async function revealNir(
  candidateId: string
): Promise<{ nir: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "admissions")) {
    return { error: "Non autorisé" };
  }
  const row = await db.query.candidates.findFirst({
    where: eq(candidates.id, candidateId),
    columns: { nirEncrypted: true, nirIv: true },
  });
  if (!row?.nirEncrypted || !row?.nirIv) return { error: "Aucun NIR enregistré" };
  try {
    return { nir: decryptNir(row.nirEncrypted, row.nirIv) };
  } catch {
    return { error: "Erreur de déchiffrement" };
  }
}

// ─── CV upload ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo

function getExtension(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/msword") return "doc";
  return "docx";
}

export type CVDocument = {
  id: string;
  fileName: string;
  storagePath: string;
  createdAt: string;
};

export async function getCandidateCV(candidateId: string): Promise<CVDocument | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const [row] = await db
    .select({ id: documents.id, fileName: documents.fileName, storagePath: documents.storagePath, createdAt: documents.createdAt })
    .from(documents)
    .where(and(eq(documents.candidateId, candidateId), eq(documents.documentType, "cv")))
    .limit(1);
  if (!row) return null;
  return { id: row.id, fileName: row.fileName, storagePath: row.storagePath, createdAt: row.createdAt.toISOString() };
}

export async function uploadCandidateCV(
  candidateId: string,
  formData: FormData
): Promise<{ success: true; documentId: string } | { success: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, error: "Aucun fichier sélectionné" };

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { success: false, error: "Format non supporté. Utilisez PDF, DOC ou DOCX." };
  }
  if (file.size > MAX_SIZE) {
    return { success: false, error: "Fichier trop volumineux (max 10 Mo)" };
  }

  const ext = getExtension(file.type);
  const uuid = crypto.randomUUID();
  const storagePath = `candidates/${candidateId}/${uuid}.${ext}`;

  const supabase = await createClient();
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { success: false, error: `Erreur d'upload : ${uploadError.message}` };
  }

  // Upsert : one CV record per candidate
  const existing = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.candidateId, candidateId), eq(documents.documentType, "cv")))
    .limit(1);

  let documentId: string;
  if (existing.length > 0) {
    documentId = existing[0].id;
    await db
      .update(documents)
      .set({ fileName: file.name, storagePath, mimeType: file.type, fileSize: file.size })
      .where(eq(documents.id, documentId));
  } else {
    const [inserted] = await db
      .insert(documents)
      .values({
        candidateId,
        documentType: "cv",
        fileName: file.name,
        storagePath,
        mimeType: file.type,
        fileSize: file.size,
        createdBy: user.id,
      })
      .returning({ id: documents.id });
    documentId = inserted.id;
  }

  revalidatePath(`/candidats/${candidateId}`);
  revalidatePath("/matching");
  return { success: true, documentId };
}
