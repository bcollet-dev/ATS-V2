"use server";

import { requireAuth, checkPreviewGuard } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { db } from "@/db";
import {
  companies, companyContacts, needs, matchings, candidates, activityEvents,
} from "@/db/schema";
import { eq, isNull, and, asc, inArray, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { lookupSiret } from "@/app/(app)/annuaire/siret-actions";
import { sectorFromNafCode } from "@/lib/naf-sectors";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CompanyContact = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
};

export type CompanyNeed = {
  id: string;
  title: string;
  status: string;
  city: string | null;
  positionsCount: number;
};

export type AlternantRow = {
  matchingId: string;
  candidateId: string;
  firstName: string;
  lastName: string;
  needId: string;
  needTitle: string;
  endDate: string | null;
  badge: "en_cours" | "termine" | "rupture";
};

export type CompanyDetail = {
  id: string;
  name: string;
  siret: string | null;
  siren: string | null;
  nafCode: string | null;
  legalForm: string | null;
  employeeRange: string | null;
  administrativeStatus: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  sector: string | null;
  website: string | null;
  notes: string | null;
  idcc: string | null;
  collectiveAgreement: string | null;
  opco: string | null;
  retirementFund: string | null;
  providentFund: string | null;
  legalRepFirstName: string | null;
  legalRepLastName: string | null;
  ownerId: string | null;
  registrySyncedAt: string | null;
  deletedAt: string | null;
};

export type ContactInput = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
  isPrimary: boolean;
};

// ─── Loader ───────────────────────────────────────────────────────────────────

export async function loadCompany(id: string): Promise<{
  company: CompanyDetail;
  contacts: CompanyContact[];
  linkedNeeds: CompanyNeed[];
} | null> {
  await requireAuth();

  const [row] = await db
    .select({
      id: companies.id,
      name: companies.name,
      siret: companies.siret,
      siren: companies.siren,
      nafCode: companies.nafCode,
      legalForm: companies.legalForm,
      employeeRange: companies.employeeRange,
      administrativeStatus: companies.administrativeStatus,
      address: companies.address,
      postalCode: companies.postalCode,
      city: companies.city,
      phone: companies.phone,
      email: companies.email,
      sector: companies.sector,
      website: companies.website,
      notes: companies.notes,
      idcc: companies.idcc,
      collectiveAgreement: companies.collectiveAgreement,
      opco: companies.opco,
      retirementFund: companies.retirementFund,
      providentFund: companies.providentFund,
      legalRepFirstName: companies.legalRepFirstName,
      legalRepLastName: companies.legalRepLastName,
      ownerId: companies.ownerId,
      registrySyncedAt: companies.registrySyncedAt,
      deletedAt: companies.deletedAt,
    })
    .from(companies)
    .where(eq(companies.id, id));

  if (!row) return null;

  const [contactRows, needRows] = await Promise.all([
    db
      .select({
        id: companyContacts.id,
        firstName: companyContacts.firstName,
        lastName: companyContacts.lastName,
        jobTitle: companyContacts.jobTitle,
        email: companyContacts.email,
        phone: companyContacts.phone,
        isPrimary: companyContacts.isPrimary,
      })
      .from(companyContacts)
      .where(and(eq(companyContacts.companyId, id), isNull(companyContacts.deletedAt)))
      .orderBy(asc(companyContacts.createdAt)),
    db
      .select({
        id: needs.id,
        title: needs.title,
        status: needs.status,
        city: needs.city,
        positionsCount: needs.positionsCount,
      })
      .from(needs)
      .where(and(eq(needs.companyId, id), isNull(needs.deletedAt)))
      .orderBy(asc(needs.title)),
  ]);

  return {
    company: {
      ...row,
      registrySyncedAt: row.registrySyncedAt?.toISOString() ?? null,
      deletedAt: row.deletedAt?.toISOString() ?? null,
    },
    contacts: contactRows.map((c) => ({
      ...c,
      isPrimary: c.isPrimary !== null && c.isPrimary !== "",
    })),
    linkedNeeds: needRows,
  };
}

export async function loadAlternants(companyId: string): Promise<AlternantRow[]> {
  await requireAuth();

  const rows = await db
    .select({
      matchingId: matchings.id,
      candidateId: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      needId: needs.id,
      needTitle: needs.title,
      needStatus: needs.status,
      endDate: needs.endDate,
    })
    .from(matchings)
    .innerJoin(needs, eq(matchings.needId, needs.id))
    .innerJoin(candidates, eq(matchings.candidateId, candidates.id))
    .where(
      and(
        eq(needs.companyId, companyId),
        eq(matchings.isWinner, true),
        inArray(needs.status, ["client", "rupture"]),
        isNull(needs.deletedAt),
        isNull(candidates.deletedAt)
      )
    )
    .orderBy(desc(needs.endDate));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return rows.map((r) => {
    let badge: AlternantRow["badge"];
    if (r.needStatus === "rupture") {
      badge = "rupture";
    } else if (r.endDate && new Date(r.endDate) < today) {
      badge = "termine";
    } else {
      badge = "en_cours";
    }
    return {
      matchingId: r.matchingId,
      candidateId: r.candidateId,
      firstName: r.firstName,
      lastName: r.lastName,
      needId: r.needId,
      needTitle: r.needTitle,
      endDate: r.endDate,
      badge,
    };
  });
}

// ─── Company Mutations ────────────────────────────────────────────────────────

export async function updateCompanyInfo(
  id: string,
  data: {
    name: string;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    sector: string | null;
    website: string | null;
    notes: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "companies:edit")) return { success: false, error: "Non autorisé" };
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return previewGuard;
  await db.update(companies).set({ ...data, updatedAt: new Date() }).where(eq(companies.id, id));
  await db.insert(activityEvents).values({
    actorId: actor.id,
    companyId: id,
    actionType: "company.updated",
    summary: `Informations mises à jour par ${actor.fullName}`,
  });
  revalidatePath(`/annuaire/${id}`);
  revalidatePath("/annuaire");
  return { success: true };
}

export async function updateCompanyFRE(
  id: string,
  data: {
    idcc: string | null;
    collectiveAgreement: string | null;
    opco: string | null;
    retirementFund: string | null;
    providentFund: string | null;
    legalRepFirstName: string | null;
    legalRepLastName: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "companies:edit")) return { success: false, error: "Non autorisé" };
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return previewGuard;
  await db.update(companies).set({ ...data, updatedAt: new Date() }).where(eq(companies.id, id));
  await db.insert(activityEvents).values({
    actorId: actor.id,
    companyId: id,
    actionType: "company.fre_updated",
    summary: `Données FRE mises à jour par ${actor.fullName}`,
  });
  revalidatePath(`/annuaire/${id}`);
  return { success: true };
}

export async function updateCompanyOwner(
  companyId: string,
  ownerId: string | null
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "companies:edit")) return { success: false, error: "Non autorisé" };
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return previewGuard;
  await db
    .update(companies)
    .set({ ownerId: ownerId || null, updatedAt: new Date() })
    .where(eq(companies.id, companyId));
  await db.insert(activityEvents).values({
    actorId: actor.id,
    companyId,
    actionType: "company.owner_updated",
    summary: `Consultant référent mis à jour par ${actor.fullName}`,
  });
  revalidatePath(`/annuaire/${companyId}`);
  return { success: true };
}

export async function syncFromPappers(
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "companies:edit")) return { success: false, error: "Non autorisé" };
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return previewGuard;

  const [row] = await db
    .select({ siret: companies.siret })
    .from(companies)
    .where(eq(companies.id, companyId));

  if (!row?.siret) return { success: false, error: "SIRET manquant sur la fiche" };

  const result = await lookupSiret(row.siret);
  if (!result.found) return { success: false, error: "Entreprise introuvable dans le registre public" };

  const nafCode = result.data.nafCode || null;
  await db.update(companies).set({
    siren: result.data.siren || null,
    nafCode,
    legalForm: result.data.legalForm || null,
    employeeRange: result.data.employeeRange || null,
    administrativeStatus: result.data.administrativeStatus || null,
    address: result.data.address || null,
    postalCode: result.data.postalCode || null,
    city: result.data.city || null,
    sector: sectorFromNafCode(nafCode),
    registrySyncedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(companies.id, companyId));

  await db.insert(activityEvents).values({
    actorId: actor.id,
    companyId,
    actionType: "company.registry_synced",
    summary: `Synchronisation Pappers par ${actor.fullName}`,
  });

  revalidatePath(`/annuaire/${companyId}`);
  return { success: true };
}

export async function archiveCompany(
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  const guard = await checkPreviewGuard();
  if (guard) return guard;
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "companies:delete")) return { success: false, error: "Non autorisé" };

  await db
    .update(companies)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(companies.id, companyId));

  await db.insert(activityEvents).values({
    actorId: actor.id,
    companyId,
    actionType: "company.archived",
    summary: `Entreprise archivée par ${actor.fullName}`,
  });

  revalidatePath(`/annuaire/${companyId}`);
  revalidatePath("/annuaire");
  revalidatePath("/besoins");
  revalidatePath("/matching");
  revalidatePath("/taches");
  return { success: true };
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function addContact(
  companyId: string,
  data: ContactInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "companies:edit")) return { success: false, error: "Non autorisé" };
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return previewGuard;

  if (data.isPrimary) {
    await db
      .update(companyContacts)
      .set({ isPrimary: null })
      .where(and(eq(companyContacts.companyId, companyId), isNull(companyContacts.deletedAt)));
  }

  const [created] = await db
    .insert(companyContacts)
    .values({
      companyId,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      jobTitle: data.jobTitle.trim() || null,
      email: data.email.trim() || null,
      phone: data.phone.trim() || null,
      isPrimary: data.isPrimary ? "true" : null,
      createdBy: actor.id,
    })
    .returning({ id: companyContacts.id });

  await db.insert(activityEvents).values({
    actorId: actor.id,
    companyId,
    actionType: "company.contact_added",
    summary: `Contact ${data.firstName.trim()} ${data.lastName.trim()} ajouté par ${actor.fullName}`,
  });

  revalidatePath(`/annuaire/${companyId}`);
  return { success: true, id: created.id };
}

export async function updateContact(
  contactId: string,
  companyId: string,
  data: ContactInput
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "companies:edit")) return { success: false, error: "Non autorisé" };
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return previewGuard;

  if (data.isPrimary) {
    await db
      .update(companyContacts)
      .set({ isPrimary: null })
      .where(and(eq(companyContacts.companyId, companyId), isNull(companyContacts.deletedAt)));
  }

  await db
    .update(companyContacts)
    .set({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      jobTitle: data.jobTitle.trim() || null,
      email: data.email.trim() || null,
      phone: data.phone.trim() || null,
      isPrimary: data.isPrimary ? "true" : null,
      updatedAt: new Date(),
    })
    .where(eq(companyContacts.id, contactId));

  await db.insert(activityEvents).values({
    actorId: actor.id,
    companyId,
    actionType: "company.contact_updated",
    summary: `Contact ${data.firstName.trim()} ${data.lastName.trim()} modifié par ${actor.fullName}`,
  });

  revalidatePath(`/annuaire/${companyId}`);
  return { success: true };
}

export async function deleteContact(contactId: string, companyId: string): Promise<void> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "companies:edit")) return;
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return;

  const [contact] = await db
    .select({ firstName: companyContacts.firstName, lastName: companyContacts.lastName })
    .from(companyContacts)
    .where(eq(companyContacts.id, contactId));

  await db
    .update(companyContacts)
    .set({ deletedAt: new Date() })
    .where(eq(companyContacts.id, contactId));

  if (contact) {
    await db.insert(activityEvents).values({
      actorId: actor.id,
      companyId,
      actionType: "company.contact_deleted",
      summary: `Contact ${contact.firstName} ${contact.lastName} supprimé par ${actor.fullName}`,
    });
  }

  revalidatePath(`/annuaire/${companyId}`);
}
