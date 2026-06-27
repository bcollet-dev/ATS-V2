"use server";

import { db } from "@/db";
import { candidates, activityEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { encryptNir, decryptNir } from "@/lib/nir";

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
