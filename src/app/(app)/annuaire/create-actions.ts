"use server";

import { db } from "@/db";
import { candidates, companies, companyContacts } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { requireAuth, checkPreviewGuard } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import {
  createCandidatSchema,
  createEntrepriseSchema,
  type CreateCandidatInput,
  type CreateEntrepriseInput,
} from "./schemas";
import type { RegistryData } from "./siret-actions";

// ─── Helpers doublon ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function isSimilar(a: string, b: string, threshold: number): boolean {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return true;
  const maxLen = Math.max(na.length, nb.length);
  return maxLen > 0 && levenshtein(na, nb) <= threshold;
}

export type SimilarCandidate = { id: string; firstName: string; lastName: string };

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; field?: string; duplicates?: SimilarCandidate[] };

// ─── Candidat ────────────────────────────────────────────────────────────────

export async function createCandidat(
  input: CreateCandidatInput,
  force = false
): Promise<ActionResult<{ id: string; firstName: string; lastName: string }>> {
  const actor = await requireAuth();
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return previewGuard;
  if (!can(actor.role as AppRole, "candidates:edit")) {
    return { success: false, error: "Vous n'avez pas les droits pour créer un candidat" };
  }

  const parsed = createCandidatSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides" };

  const { firstName, lastName, phone, email, cursusEnvisage } = parsed.data;

  // Email exact → blocage dur
  const emailMatch = await db.query.candidates.findFirst({
    where: and(eq(candidates.email, email.toLowerCase()), isNull(candidates.deletedAt)),
    columns: { id: true, firstName: true, lastName: true },
  });
  if (emailMatch) {
    return {
      success: false,
      error: `Email déjà utilisé par ${emailMatch.firstName} ${emailMatch.lastName}`,
      field: "email",
    };
  }

  // Similarité nom/prénom → warning soft (sauf si force)
  if (!force) {
    const all = await db
      .select({ id: candidates.id, firstName: candidates.firstName, lastName: candidates.lastName })
      .from(candidates)
      .where(isNull(candidates.deletedAt));

    const similar = all.filter(
      (c) => isSimilar(c.lastName, lastName, 1) && isSimilar(c.firstName, firstName, 2)
    );

    if (similar.length > 0) {
      return {
        success: false,
        error: "Des candidats au nom similaire existent déjà.",
        duplicates: similar,
      };
    }
  }

  const [created] = await db
    .insert(candidates)
    .values({ firstName, lastName, phone, email: email.toLowerCase(), cursusEnvisage, createdBy: actor.id })
    .returning({ id: candidates.id, firstName: candidates.firstName, lastName: candidates.lastName });

  return { success: true, data: created };
}

// ─── Entreprise ───────────────────────────────────────────────────────────────

export async function createEntreprise(
  input: CreateEntrepriseInput,
  registry?: RegistryData | null
): Promise<ActionResult<{ id: string; name: string }>> {
  const actor = await requireAuth();
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return previewGuard;
  if (!can(actor.role as AppRole, "companies:edit")) {
    return { success: false, error: "Vous n'avez pas les droits pour créer une entreprise" };
  }

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
    .values({
      name,
      siret,
      createdBy: actor.id,
      ...(registry && {
        siren: registry.siren || null,
        address: registry.address,
        postalCode: registry.postalCode,
        city: registry.city,
        nafCode: registry.nafCode,
        legalForm: registry.legalForm,
        employeeRange: registry.employeeRange,
        administrativeStatus: registry.administrativeStatus,
        registrySyncedAt: new Date(),
      }),
    })
    .returning({ id: companies.id, name: companies.name });

  await db.insert(companyContacts).values({
    companyId: created.id,
    firstName: contactFirstName,
    lastName: contactLastName,
    phone: contactPhone,
    createdBy: actor.id,
  });

  return { success: true, data: created };
}
