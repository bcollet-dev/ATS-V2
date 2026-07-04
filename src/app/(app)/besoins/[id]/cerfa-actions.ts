"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, notInArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  candidates,
  companies,
  companyContacts,
  matchings,
  needs,
  type NeedRemunerationLine,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { logActivityEvent } from "@/lib/activity";
import { can, type AppRole } from "@/lib/permissions";
import { resolveFrenchBirthDepartment } from "@/lib/birth-department";
import { normalizeContractDate } from "@/lib/cerfa-mapping";

const updateCerfaFieldSchema = z.object({
  needId: z.string().uuid(),
  candidateId: z.string().uuid().nullable().optional(),
  sectionTitle: z.string().min(1),
  label: z.string().min(1),
  value: z.string(),
});

export type UpdateCerfaFieldInput = z.infer<typeof updateCerfaFieldSchema>;

type Result = { success: true; value: string | null } | { success: false; error: string };

function clean(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function yesNo(value: string | null) {
  const key = clean(value)
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase() ?? "";
  return ["oui", "true", "1", "yes"].includes(key);
}

function splitFullName(value: string | null) {
  const parts = clean(value)?.split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function parseAddress(value: string | null) {
  const text = clean(value);
  if (!text) return { line: null, postalCode: null, city: null };

  const postalCity = text.match(/\b(\d{5})\s+([^,]+)$/);
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  const line = postalCity && parts.length > 1
    ? parts.slice(0, -1).join(", ")
    : text.replace(/\b\d{5}\s+[^,]+$/, "").replace(/,\s*$/, "").trim() || text;

  return {
    line,
    postalCode: postalCity?.[1] ?? null,
    city: postalCity?.[2]?.trim() ?? null,
  };
}

async function needContext(needId: string) {
  const [row] = await db
    .select({
      id: needs.id,
      companyId: needs.companyId,
      contactId: needs.contactId,
      remunerationLines: needs.remunerationLines,
    })
    .from(needs)
    .where(and(eq(needs.id, needId), isNull(needs.deletedAt)))
    .limit(1);
  return row ?? null;
}

async function assertCandidateLinked(needId: string, candidateId: string | null | undefined) {
  if (!candidateId) return false;
  const [row] = await db
    .select({ id: matchings.id })
    .from(matchings)
    .where(
      and(
        eq(matchings.needId, needId),
        eq(matchings.candidateId, candidateId),
        notInArray(matchings.propositionStatus, ["not_retained"]),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function updateNeedField(needId: string, label: string, value: string | null) {
  const dateValue = new Set([
    "Date de conclusion",
    "Date de debut d'execution",
    "Date de debut chez l'employeur",
    "Date de fin",
    "Date de naissance",
  ]).has(label)
    ? normalizeContractDate(value)
    : value;
  const simple: Record<string, Partial<typeof needs.$inferInsert>> = {
    "Besoin": { title: value ?? "" },
    "Ville du besoin": { city: value },
    "Type de contrat ou avenant": { contractType: value },
    "Date de conclusion": { contractConclusionDate: dateValue },
    "Date de debut d'execution": { startDate: dateValue },
    "Date de debut chez l'employeur": { contractPracticalStartDate: dateValue },
    "Fait a": { contractMadeAt: value },
    "Date de fin": { endDate: dateValue },
    "Duree hebdomadaire": { weeklyHours: value },
    "Reference de salaire": { salaryReference: value },
    "Montant SMC": { smcAmount: value },
    "Salaire brut mensuel": { monthlyGrossSalary: value },
    "Salaire brut horaire": { hourlyGrossSalary: value },
    "Avantage nourriture": { benefitFood: value },
    "Avantage logement": { benefitHousing: value },
    "Autre avantage": { benefitOther: value },
    "Heures supplementaires": { overtimeHandling: value },
    "Nom de naissance": { masterBirthName: value },
    "Nom d'usage": { masterLastName: value },
    "Prenom": { masterFirstName: value },
    "Date de naissance": { masterBirthDate: dateValue },
    "Courriel": { masterEmail: value },
    "Telephone": { masterPhone: value },
    "Emploi occupe": { masterJobTitle: value },
    "Diplome le plus eleve obtenu": { masterDiploma: value },
    "Niveau du diplome le plus eleve": { masterDiplomaLevel: value },
    "Code RNCP": { rncpCode: value },
  };

  const patch = simple[label];
  if (patch) {
    await db.update(needs).set({ ...patch, updatedAt: new Date() }).where(eq(needs.id, needId));
    return true;
  }

  const remuneration = label.match(/^Remuneration (\d+) - (Debut|Fin|Pourcentage|Base)$/);
  if (!remuneration) return false;

  const [, positionText, keyText] = remuneration;
  const index = Number(positionText) - 1;
  if (!Number.isInteger(index) || index < 0 || index > 7) return false;

  const context = await needContext(needId);
  if (!context) return false;
  const lines: NeedRemunerationLine[] = Array.isArray(context.remunerationLines)
    ? [...context.remunerationLines]
    : [];
  while (lines.length <= index) lines.push({});

  const keyByLabel = {
    Debut: "startDate",
    Fin: "endDate",
    Pourcentage: "percent",
    Base: "reference",
  } as const;
  const key = keyByLabel[keyText as keyof typeof keyByLabel];
  lines[index] = {
    ...lines[index],
    [key]: key === "startDate" || key === "endDate"
      ? normalizeContractDate(value) ?? undefined
      : value ?? undefined,
  };

  await db
    .update(needs)
    .set({ remunerationLines: lines, updatedAt: new Date() })
    .where(eq(needs.id, needId));
  return true;
}

async function updateCandidateField(candidateId: string, sectionTitle: string, label: string, value: string | null) {
  if (label === "Adresse") {
    const address = parseAddress(value);
    await db
      .update(candidates)
      .set({
        addressLine1: address.line,
        postalCode: address.postalCode,
        city: address.city,
        updatedAt: new Date(),
      })
      .where(eq(candidates.id, candidateId));
    return true;
  }

  if (label === "Nom et prenom") {
    const name = splitFullName(value);
    await db
      .update(candidates)
      .set({
        legalRepFirstName: name.firstName,
        legalRepLastName: name.lastName,
        updatedAt: new Date(),
      })
      .where(eq(candidates.id, candidateId));
    return true;
  }

  if (sectionTitle === "Representant legal") {
    const legalRepFields: Record<string, Partial<typeof candidates.$inferInsert>> = {
      "Telephone": { legalRepPhone: value },
      "Courriel": { legalRepEmail: value },
      "Lien avec l'apprenti": { legalRepLink: value },
    };
    const patch = legalRepFields[label];
    if (!patch) return false;
    await db
      .update(candidates)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(candidates.id, candidateId));
    return true;
  }

  const simple: Record<string, Partial<typeof candidates.$inferInsert>> = {
    "Nom de naissance": { birthName: value },
    "Nom d'usage": { lastName: value ?? "" },
    "Premier prenom": { firstName: value ?? "" },
    "Date de naissance": { birthDate: value },
    "Civilite / sexe": { title: value },
    "Departement de naissance": { birthDepartment: value },
    "Commune de naissance": { birthCity: value },
    "Pays de naissance": { birthCountry: value },
    "Nationalite": { nationality: value },
    "Regime social": { socialRegime: value },
    "Situation avant ce contrat": { situationBeforeContract: value },
    "Dernier diplome ou titre prepare": { lastPreparedDiploma: value },
    "Derniere classe / annee suivie": { lastClassYear: value },
    "Intitule precis du dernier diplome ou titre prepare": { lastDiplomaTitle: value },
    "Diplome ou titre le plus eleve obtenu": { highestDiploma: value },
    "Telephone": { phone: value },
    "Courriel": { email: value },
    "RQTH": { rqth: yesNo(value) },
  };

  const patch = simple[label];
  if (!patch) return false;

  const [candidate] = label === "Commune de naissance" || label === "Pays de naissance"
    ? await db
        .select({
          birthCity: candidates.birthCity,
          birthCountry: candidates.birthCountry,
          birthDepartment: candidates.birthDepartment,
        })
        .from(candidates)
        .where(eq(candidates.id, candidateId))
        .limit(1)
    : [null];
  const resolvedBirthDepartment = candidate
    ? await resolveFrenchBirthDepartment({
        birthCity: label === "Commune de naissance" ? value : candidate.birthCity,
        birthCountry: label === "Pays de naissance" ? value : candidate.birthCountry,
        currentDepartment: label === "Pays de naissance" ? null : candidate.birthDepartment,
      })
    : null;

  await db
    .update(candidates)
    .set({
      ...patch,
      ...(resolvedBirthDepartment ? { birthDepartment: resolvedBirthDepartment } : {}),
      updatedAt: new Date(),
    })
    .where(eq(candidates.id, candidateId));
  return true;
}

async function updateCompanyField(
  needId: string,
  companyId: string,
  contactId: string | null,
  label: string,
  value: string | null,
) {
  if (label === "Adresse d'execution") {
    const address = parseAddress(value);
    await db
      .update(companies)
      .set({
        address: address.line,
        postalCode: address.postalCode,
        city: address.city,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId));
    return true;
  }

  if (label === "Representant employeur") {
    const name = splitFullName(value);
    await db
      .update(companies)
      .set({
        legalRepFirstName: name.firstName,
        legalRepLastName: name.lastName,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId));
    return true;
  }

  if (label === "Contact entreprise") {
    const name = splitFullName(value);
    if (contactId) {
      await db
        .update(companyContacts)
        .set({
          firstName: name.firstName ?? "",
          lastName: name.lastName ?? "",
          updatedAt: new Date(),
        })
        .where(eq(companyContacts.id, contactId));
      return true;
    }

    const [created] = await db
      .insert(companyContacts)
      .values({
        companyId,
        firstName: name.firstName ?? "",
        lastName: name.lastName ?? "",
      })
      .returning({ id: companyContacts.id });
    await db.update(needs).set({ contactId: created.id, updatedAt: new Date() }).where(eq(needs.id, needId));
    return true;
  }

  if (label === "Fonction contact") {
    if (!contactId) throw new Error("Ajoutez d'abord un contact entreprise.");
    await db
      .update(companyContacts)
      .set({ jobTitle: value, updatedAt: new Date() })
      .where(eq(companyContacts.id, contactId));
    return true;
  }

  if (label === "Telephone contact") {
    if (!contactId) throw new Error("Ajoutez d'abord un contact entreprise.");
    await db
      .update(companyContacts)
      .set({ phone: value, updatedAt: new Date() })
      .where(eq(companyContacts.id, contactId));
    return true;
  }

  if (label === "Courriel contact") {
    if (!contactId) throw new Error("Ajoutez d'abord un contact entreprise.");
    await db
      .update(companyContacts)
      .set({ email: value, updatedAt: new Date() })
      .where(eq(companyContacts.id, contactId));
    return true;
  }

  if (label === "Type employeur") {
    const numeric = value ? Number(value.replace(/[^\d.-]/g, "")) : null;
    await db
      .update(companies)
      .set({ ypareoTypeEmployeur: Number.isFinite(numeric) ? numeric : null, updatedAt: new Date() })
      .where(eq(companies.id, companyId));
    return true;
  }

  const simple: Record<string, Partial<typeof companies.$inferInsert>> = {
    "Nom ou denomination": { name: value ?? "" },
    "SIRET": { siret: value },
    "Telephone": { phone: value },
    "Courriel": { email: value },
    "Forme juridique": { legalForm: value },
    "Code APE": { nafCode: value },
    "Effectif": { employeeRange: value },
    "Code IDCC": { idcc: value },
    "Convention collective": { collectiveAgreement: value },
    "OPCO": { opco: value },
    "Caisse retraite complementaire": { retirementFund: value },
  };

  const patch = simple[label];
  if (!patch) return false;
  await db.update(companies).set({ ...patch, updatedAt: new Date() }).where(eq(companies.id, companyId));
  return true;
}

export async function updateCerfaField(input: UpdateCerfaFieldInput): Promise<Result> {
  const actor = await requireAuth();
  const parsed = updateCerfaFieldSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const data = parsed.data;
  const value = clean(data.value);
  const context = await needContext(data.needId);
  if (!context) return { success: false, error: "Besoin introuvable." };

  try {
    let updated = false;

    if (data.sectionTitle === "Employeur") {
      if (!can(actor.role as AppRole, "companies:edit")) return { success: false, error: "Non autorisé." };
      updated = await updateCompanyField(data.needId, context.companyId, context.contactId, data.label, value);
      revalidatePath(`/annuaire/${context.companyId}`);
    } else if (data.sectionTitle === "Apprenti" || data.sectionTitle === "Representant legal") {
      if (!can(actor.role as AppRole, "candidates:edit")) return { success: false, error: "Non autorisé." };
      if (!(await assertCandidateLinked(data.needId, data.candidateId))) {
        return { success: false, error: "Candidat non rattaché à ce besoin." };
      }
      updated = await updateCandidateField(data.candidateId!, data.sectionTitle, data.label, value);
      revalidatePath(`/candidats/${data.candidateId}`);
    } else if (data.sectionTitle === "Contrat" || data.sectionTitle === "Maitre d'apprentissage" || data.sectionTitle === "Formation") {
      if (!can(actor.role as AppRole, "needs:edit")) return { success: false, error: "Non autorisé." };
      updated = await updateNeedField(data.needId, data.label, value);
    }

    if (!updated) {
      return { success: false, error: "Ce champ est calculé depuis une autre donnée source." };
    }

    await logActivityEvent({
      needId: data.needId,
      actorId: actor.id,
      actionType: "need_fields_updated",
      summary: `Champ CERFA mis à jour : ${data.sectionTitle} - ${data.label}`,
    });

    revalidatePath(`/besoins/${data.needId}`);
    revalidatePath("/besoins");
    return { success: true, value };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur lors de la sauvegarde." };
  }
}
