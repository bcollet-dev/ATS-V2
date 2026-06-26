"use server";

import { db } from "@/db";
import { candidates, companies, companyContacts } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import {
  createCandidatSchema,
  createEntrepriseSchema,
  type CreateCandidatInput,
  type CreateEntrepriseInput,
} from "./schemas";

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; field?: string };

// ─── Candidat ────────────────────────────────────────────────────────────────

export async function createCandidat(
  input: CreateCandidatInput
): Promise<ActionResult<{ id: string; firstName: string; lastName: string }>> {
  const parsed = createCandidatSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides" };

  const { firstName, lastName, phone, email, cursusEnvisage } = parsed.data;

  const existing = await db.query.candidates.findFirst({
    where: and(eq(candidates.email, email.toLowerCase()), isNull(candidates.deletedAt)),
    columns: { id: true, firstName: true, lastName: true },
  });

  if (existing) {
    return {
      success: false,
      error: `Email déjà utilisé par ${existing.firstName} ${existing.lastName}`,
      field: "email",
    };
  }

  const [created] = await db
    .insert(candidates)
    .values({ firstName, lastName, phone, email: email.toLowerCase(), cursusEnvisage })
    .returning({ id: candidates.id, firstName: candidates.firstName, lastName: candidates.lastName });

  return { success: true, data: created };
}

// ─── Entreprise ───────────────────────────────────────────────────────────────

export async function createEntreprise(
  input: CreateEntrepriseInput
): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = createEntrepriseSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides" };

  const { name, siret, contactFirstName, contactLastName, contactPhone } = parsed.data;

  const existing = await db.query.companies.findFirst({
    where: and(eq(companies.siret, siret), isNull(companies.deletedAt)),
    columns: { id: true, name: true },
  });
  if (existing) {
    return {
      success: false,
      error: `SIRET déjà utilisé par "${existing.name}"`,
      field: "siret",
    };
  }

  const [created] = await db
    .insert(companies)
    .values({ name, siret })
    .returning({ id: companies.id, name: companies.name });

  await db.insert(companyContacts).values({
    companyId: created.id,
    firstName: contactFirstName,
    lastName: contactLastName,
    phone: contactPhone,
  });

  return { success: true, data: created };
}
