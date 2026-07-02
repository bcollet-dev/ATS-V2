"use server";

import { db } from "@/db";
import {
  candidateFormations,
  candidates,
  classes,
  companies,
  companyContacts,
  cursus,
  matchings,
  needCursus,
  needs,
  ypareoLogs,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { decryptNir } from "@/lib/nir";
import { pushPlacementToYpareo } from "@/lib/ypareo/client";
import type {
  YpareoDraftField,
  YpareoDraftSection,
  YpareoPlacementDraft,
  YpareoPlacementSource,
} from "@/lib/ypareo/placement-draft";
import { and, asc, desc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { randomUUID } from "crypto";

type PairRow = {
  matchingId: string;
  propositionStatus: string;
  isWinner: boolean;
  candidateId: string;
  needId: string;
};

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function fullName(firstName: unknown, lastName: unknown) {
  return [clean(firstName), clean(lastName)].filter(Boolean).join(" ") || null;
}

function addressLine(...parts: unknown[]) {
  return parts.map(clean).filter(Boolean).join(", ") || null;
}

function field(label: string, value: unknown, required = false): YpareoDraftField {
  return { label, value: clean(value), required };
}

function addMissing(section: YpareoDraftSection, missing: string[]) {
  for (const f of section.fields) {
    if (f.required && !f.value) missing.push(`${section.title} - ${f.label}`);
  }
}

function rankPair(row: PairRow) {
  if (row.isWinner) return 0;
  if (row.propositionStatus === "placed") return 1;
  if (row.propositionStatus === "waiting_fre") return 2;
  if (row.propositionStatus === "interview") return 3;
  return 4;
}

async function loadCandidate(candidateId: string) {
  const [row] = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      birthName: candidates.birthName,
      title: candidates.title,
      email: candidates.email,
      phone: candidates.phone,
      addressLine1: candidates.addressLine1,
      addressLine2: candidates.addressLine2,
      postalCode: candidates.postalCode,
      city: candidates.city,
      birthDate: candidates.birthDate,
      birthCity: candidates.birthCity,
      birthDepartment: candidates.birthDepartment,
      birthCountry: candidates.birthCountry,
      nationality: candidates.nationality,
      socialRegime: candidates.socialRegime,
      rqth: candidates.rqth,
      hasNir: candidates.nirEncrypted,
      legalRepFirstName: candidates.legalRepFirstName,
      legalRepLastName: candidates.legalRepLastName,
      legalRepPhone: candidates.legalRepPhone,
      legalRepEmail: candidates.legalRepEmail,
      legalRepLink: candidates.legalRepLink,
      ypareoPersonId: candidates.ypareoPersonId,
      cursusEnvisage: candidates.cursusEnvisage,
    })
    .from(candidates)
    .where(and(eq(candidates.id, candidateId), isNull(candidates.deletedAt)))
    .limit(1);

  return row ?? null;
}

async function loadNeed(needId: string) {
  const [row] = await db
    .select({
      id: needs.id,
      title: needs.title,
      city: needs.city,
      startDate: needs.startDate,
      endDate: needs.endDate,
      weeklyHours: needs.weeklyHours,
      contractType: needs.contractType,
      salaryReference: needs.salaryReference,
      smcAmount: needs.smcAmount,
      overtimeHandling: needs.overtimeHandling,
      benefitFood: needs.benefitFood,
      benefitHousing: needs.benefitHousing,
      benefitOther: needs.benefitOther,
      masterFirstName: needs.masterFirstName,
      masterLastName: needs.masterLastName,
      masterBirthName: needs.masterBirthName,
      masterBirthDate: needs.masterBirthDate,
      masterJobTitle: needs.masterJobTitle,
      masterPhone: needs.masterPhone,
      masterEmail: needs.masterEmail,
      targetCursusId: needs.targetCursusId,
      targetCursusName: cursus.name,
      targetCursusCode: cursus.code,
      targetCursusExternalId: cursus.externalId,
      companyId: companies.id,
      companyName: companies.name,
      companySiret: companies.siret,
      companyNafCode: companies.nafCode,
      companyLegalForm: companies.legalForm,
      companyEmployeeRange: companies.employeeRange,
      companyAddress: companies.address,
      companyPostalCode: companies.postalCode,
      companyCity: companies.city,
      companyPhone: companies.phone,
      companyEmail: companies.email,
      companyIdcc: companies.idcc,
      companyCollectiveAgreement: companies.collectiveAgreement,
      companyOpco: companies.opco,
      companyRetirementFund: companies.retirementFund,
      companyLegalRepFirstName: companies.legalRepFirstName,
      companyLegalRepLastName: companies.legalRepLastName,
      contactFirstName: companyContacts.firstName,
      contactLastName: companyContacts.lastName,
      contactJobTitle: companyContacts.jobTitle,
      contactEmail: companyContacts.email,
      contactPhone: companyContacts.phone,
    })
    .from(needs)
    .innerJoin(companies, eq(needs.companyId, companies.id))
    .leftJoin(companyContacts, eq(needs.contactId, companyContacts.id))
    .leftJoin(cursus, eq(needs.targetCursusId, cursus.id))
    .where(and(eq(needs.id, needId), isNull(needs.deletedAt)))
    .limit(1);

  return row ?? null;
}

async function resolveCandidatePair(candidateId: string): Promise<PairRow | null> {
  const rows = await db
    .select({
      matchingId: matchings.id,
      propositionStatus: matchings.propositionStatus,
      isWinner: matchings.isWinner,
      candidateId: matchings.candidateId,
      needId: matchings.needId,
    })
    .from(matchings)
    .innerJoin(needs, eq(matchings.needId, needs.id))
    .where(
      and(
        eq(matchings.candidateId, candidateId),
        isNull(needs.deletedAt),
        notInArray(matchings.propositionStatus, ["not_retained"]),
      )
    );

  return rows.sort((a, b) => rankPair(a) - rankPair(b))[0] ?? null;
}

async function resolveNeedPair(needId: string): Promise<PairRow | null> {
  const rows = await db
    .select({
      matchingId: matchings.id,
      propositionStatus: matchings.propositionStatus,
      isWinner: matchings.isWinner,
      candidateId: matchings.candidateId,
      needId: matchings.needId,
    })
    .from(matchings)
    .innerJoin(candidates, eq(matchings.candidateId, candidates.id))
    .where(
      and(
        eq(matchings.needId, needId),
        isNull(candidates.deletedAt),
        notInArray(matchings.propositionStatus, ["not_retained"]),
      )
    );

  return rows.sort((a, b) => rankPair(a) - rankPair(b))[0] ?? null;
}

async function loadLatestFormation(candidateId: string) {
  const [row] = await db
    .select({
      title: candidateFormations.title,
      institution: candidateFormations.institution,
      startMonth: candidateFormations.startMonth,
      endMonth: candidateFormations.endMonth,
      isCurrent: candidateFormations.isCurrent,
    })
    .from(candidateFormations)
    .where(eq(candidateFormations.candidateId, candidateId))
    .orderBy(desc(candidateFormations.isCurrent), desc(candidateFormations.endMonth), desc(candidateFormations.startMonth))
    .limit(1);

  return row ?? null;
}

async function loadFormationContext(needId: string, targetCursusId: string | null) {
  const selected = await db
    .select({
      id: cursus.id,
      name: cursus.name,
      code: cursus.code,
      externalId: cursus.externalId,
    })
    .from(needCursus)
    .innerJoin(cursus, eq(needCursus.cursusId, cursus.id))
    .where(eq(needCursus.needId, needId))
    .orderBy(asc(cursus.name));

  const ids = [...new Set([targetCursusId, ...selected.map((c) => c.id)].filter(Boolean) as string[])];
  const classRows = ids.length > 0
    ? await db
        .select({
          id: classes.id,
          externalId: classes.externalId,
          name: classes.name,
          code: classes.code,
          site: classes.site,
          startDate: classes.startDate,
          endDate: classes.endDate,
        })
        .from(classes)
        .where(and(inArray(classes.cursusId, ids), eq(classes.active, true)))
        .orderBy(asc(classes.name))
    : [];

  return { selected, classRows };
}

export async function loadYpareoPlacementDraft(
  source: YpareoPlacementSource,
  sourceId: string,
): Promise<YpareoPlacementDraft> {
  await requireAuth();

  const pair = source === "candidate"
    ? await resolveCandidatePair(sourceId)
    : await resolveNeedPair(sourceId);

  const candidateId = source === "candidate" ? sourceId : pair?.candidateId ?? null;
  const needId = source === "need" ? sourceId : pair?.needId ?? null;

  const [candidate, need, latestFormation] = await Promise.all([
    candidateId ? loadCandidate(candidateId) : Promise.resolve(null),
    needId ? loadNeed(needId) : Promise.resolve(null),
    candidateId ? loadLatestFormation(candidateId) : Promise.resolve(null),
  ]);

  const { selected, classRows } = need
    ? await loadFormationContext(need.id, need.targetCursusId)
    : { selected: [], classRows: [] };

  const missingFields: string[] = [];
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (!candidate) blockingIssues.push("Aucun candidat retenu n'a ete trouve pour ce placement.");
  if (!need) blockingIssues.push("Aucun besoin associe n'a ete trouve pour ce placement.");
  if (!need?.companyId) blockingIssues.push("Aucune entreprise associee au besoin.");
  if (!pair?.matchingId) warnings.push("Aucun rattachement candidat-besoin actif trouve. Le statut peut etre confirme, mais le dossier Ypareo sera incomplet.");
  if (classRows.length === 0) warnings.push("Aucune classe Ypareo active n'est rattachee au cursus du besoin.");

  const employer: YpareoDraftSection = {
    title: "Employeur",
    fields: [
      field("Nom ou denomination", need?.companyName, true),
      field("SIRET", need?.companySiret, true),
      field("Adresse d'execution", addressLine(need?.companyAddress, need?.companyPostalCode, need?.companyCity), true),
      field("Telephone", need?.companyPhone),
      field("Courriel", need?.companyEmail),
      field("Code APE", need?.companyNafCode, true),
      field("Effectif", need?.companyEmployeeRange),
      field("Code IDCC", need?.companyIdcc, true),
      field("Convention collective", need?.companyCollectiveAgreement),
      field("OPCO", need?.companyOpco),
      field("Caisse retraite complementaire", need?.companyRetirementFund),
      field("Representant employeur", fullName(need?.companyLegalRepFirstName, need?.companyLegalRepLastName)),
      field("Contact entreprise", fullName(need?.contactFirstName, need?.contactLastName)),
      field("Fonction contact", need?.contactJobTitle),
    ],
  };

  const apprentice: YpareoDraftSection = {
    title: "Apprenti",
    fields: [
      field("Nom de naissance", candidate?.birthName ?? candidate?.lastName, true),
      field("Nom d'usage", candidate?.lastName),
      field("Premier prenom", candidate?.firstName, true),
      field("NIR", candidate?.hasNir ? "Present dans l'ATS" : null, true),
      field("Date de naissance", candidate?.birthDate, true),
      field("Civilite / sexe", candidate?.title),
      field("Adresse", addressLine(candidate?.addressLine1, candidate?.addressLine2, candidate?.postalCode, candidate?.city), true),
      field("Departement de naissance", candidate?.birthDepartment, true),
      field("Commune de naissance", candidate?.birthCity, true),
      field("Pays de naissance", candidate?.birthCountry),
      field("Nationalite", candidate?.nationality, true),
      field("Regime social", candidate?.socialRegime),
      field("Telephone", candidate?.phone, true),
      field("Courriel", candidate?.email, true),
      field("RQTH", candidate ? (candidate.rqth ? "Oui" : "Non") : null),
      field("Projet de creation/reprise d'entreprise", null),
    ],
  };

  const legalRep: YpareoDraftSection = {
    title: "Representant legal",
    fields: [
      field("Nom et prenom", fullName(candidate?.legalRepFirstName, candidate?.legalRepLastName)),
      field("Lien avec l'apprenti", candidate?.legalRepLink),
      field("Telephone", candidate?.legalRepPhone),
      field("Courriel", candidate?.legalRepEmail),
    ],
  };

  const master: YpareoDraftSection = {
    title: "Maitre d'apprentissage",
    fields: [
      field("Nom de naissance", need?.masterBirthName ?? need?.masterLastName, true),
      field("Nom d'usage", need?.masterLastName),
      field("Prenom", need?.masterFirstName, true),
      field("Date de naissance", need?.masterBirthDate, true),
      field("Courriel", need?.masterEmail, true),
      field("Telephone", need?.masterPhone),
      field("Emploi occupe", need?.masterJobTitle, true),
      field("Diplome le plus eleve obtenu", null),
      field("Niveau du diplome le plus eleve", null),
    ],
  };

  const contract: YpareoDraftSection = {
    title: "Contrat",
    fields: [
      field("Type de contrat ou avenant", need?.contractType, true),
      field("Date de conclusion", null),
      field("Date de debut d'execution", need?.startDate, true),
      field("Date de debut chez l'employeur", need?.startDate),
      field("Date de fin", need?.endDate, true),
      field("Duree hebdomadaire", need?.weeklyHours, true),
      field("Reference de salaire", need?.salaryReference, true),
      field("Montant SMC", need?.smcAmount),
      field("Avantage nourriture", need?.benefitFood),
      field("Avantage logement", need?.benefitHousing),
      field("Autre avantage", need?.benefitOther),
      field("Heures supplementaires", need?.overtimeHandling),
    ],
  };

  const formation: YpareoDraftSection = {
    title: "Formation",
    fields: [
      field("Besoin", need?.title, true),
      field("Cursus cible principal", need?.targetCursusName, true),
      field("Code cursus", need?.targetCursusCode),
      field("Id Ypareo cursus", need?.targetCursusExternalId),
      field("Autres cursus rattaches", selected.map((c) => c.name).join(", ")),
      field("Classe Ypareo", classRows[0]?.name ?? null, true),
      field("Ville du besoin", need?.city),
      field("Derniere formation candidat", latestFormation ? `${latestFormation.title} - ${latestFormation.institution}` : null),
      field("Derniere periode de formation", latestFormation ? [latestFormation.startMonth, latestFormation.endMonth ?? "en cours"].join(" - ") : null),
    ],
  };

  const deposit: YpareoDraftSection = {
    title: "Depot",
    fields: [
      field("Organisme en charge du depot", "Ypareo"),
      field("Statut candidat Ypareo", candidate?.ypareoPersonId ? `Personne existante (${candidate.ypareoPersonId})` : "Nouvelle personne a creer"),
      field("Statut matching", pair?.propositionStatus),
    ],
  };

  const sections = [employer, apprentice, legalRep, master, contract, formation, deposit];
  for (const section of sections) addMissing(section, missingFields);

  return {
    source,
    sourceId,
    candidateId: candidate?.id ?? null,
    needId: need?.id ?? null,
    companyId: need?.companyId ?? null,
    matchingId: pair?.matchingId ?? null,
    title: candidate ? fullName(candidate.firstName, candidate.lastName) ?? "Placement Ypareo" : "Placement Ypareo",
    subtitle: need ? `${need.title} - ${need.companyName}` : "Dossier incomplet",
    sections,
    classOptions: classRows.map((row) => ({
      id: row.id,
      externalId: row.externalId ?? null,
      name: row.name,
      code: row.code ?? null,
      site: row.site ?? null,
      startDate: clean(row.startDate),
      endDate: clean(row.endDate),
    })),
    missingFields,
    blockingIssues,
    warnings,
  };
}

// ─── Push placement ───────────────────────────────────────────────────────────

export async function pushYpareoPlacement(
  draft: YpareoPlacementDraft,
  selectedClassId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();

  if (!draft.candidateId || !draft.needId || !draft.companyId) {
    return { success: false, error: "Dossier incomplet — candidat, besoin ou entreprise manquant." };
  }

  // Load NIR server-side (never exposed in draft)
  const [candidateRow] = await db
    .select({ nirEncrypted: candidates.nirEncrypted, nirIv: candidates.nirIv })
    .from(candidates)
    .where(eq(candidates.id, draft.candidateId))
    .limit(1);

  let nir: string | null = null;
  if (candidateRow?.nirEncrypted && candidateRow?.nirIv) {
    try {
      nir = decryptNir(candidateRow.nirEncrypted, candidateRow.nirIv);
    } catch {
      // NIR decryption failure is non-fatal — push without NIR
    }
  }

  // Resolve selected class externalId
  let selectedClass: { externalId: string | null; name: string; code: string | null } | null = null;
  if (selectedClassId) {
    const [cls] = await db
      .select({ externalId: classes.externalId, name: classes.name, code: classes.code })
      .from(classes)
      .where(eq(classes.id, selectedClassId))
      .limit(1);
    selectedClass = cls ?? null;
  }

  // Build payload
  const payload: Record<string, unknown> = {
    candidat: buildCandidatPayload(draft, nir),
    employeur: buildEmployeurPayload(draft),
    maitreApprentissage: buildMaitrePayload(draft),
    contrat: buildContratPayload(draft),
    formation: {
      cursus: buildCursusFromDraft(draft),
      classe: selectedClass
        ? { id: selectedClass.externalId, code: selectedClass.code, nom: selectedClass.name }
        : null,
    },
    meta: {
      source: draft.source,
      sourceId: draft.sourceId,
      matchingId: draft.matchingId,
      missingFields: draft.missingFields,
    },
  };

  // Mask NIR before logging
  const logPayload = {
    ...payload,
    candidat: { ...(payload.candidat as Record<string, unknown>), nir: nir ? "[MASKED]" : null },
  };

  const correlationId = randomUUID();
  const endpoint = process.env.YPAREO_PLACEMENT_PATH ?? "/placement";

  const [log] = await db
    .insert(ypareoLogs)
    .values({
      correlationId,
      candidateId: draft.candidateId,
      companyId: draft.companyId,
      operation: "placement",
      endpoint,
      method: "POST",
      requestPayload: logPayload,
      status: "pending",
      createdBy: actor.id,
    })
    .returning({ id: ypareoLogs.id });

  try {
    const response = await pushPlacementToYpareo(payload) as Record<string, unknown> | null;

    await db
      .update(ypareoLogs)
      .set({ status: "success", responsePayload: response ?? {}, responseStatus: 200 })
      .where(eq(ypareoLogs.id, log.id));

    // Update ypareoPersonId if returned
    const personId = response?.personId ?? response?.id ?? response?.ypareoPersonId;
    if (personId && typeof personId === "string") {
      await db
        .update(candidates)
        .set({ ypareoPersonId: personId, updatedAt: new Date() })
        .where(eq(candidates.id, draft.candidateId));
    }

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
    await db
      .update(ypareoLogs)
      .set({ status: "error", errorMessage, retryable: true })
      .where(eq(ypareoLogs.id, log.id));
    return { success: false, error: errorMessage };
  }
}

function buildCandidatPayload(draft: YpareoPlacementDraft, nir: string | null) {
  const section = (title: string) => draft.sections.find((s) => s.title === title);
  const val = (sectionTitle: string, label: string) =>
    section(sectionTitle)?.fields.find((f) => f.label === label)?.value ?? null;

  return {
    nom: val("Apprenti", "Nom d'usage"),
    nomNaissance: val("Apprenti", "Nom de naissance"),
    prenom: val("Apprenti", "Premier prenom"),
    civilite: val("Apprenti", "Civilite / sexe"),
    dateNaissance: val("Apprenti", "Date de naissance"),
    departementNaissance: val("Apprenti", "Departement de naissance"),
    communeNaissance: val("Apprenti", "Commune de naissance"),
    paysNaissance: val("Apprenti", "Pays de naissance"),
    nationalite: val("Apprenti", "Nationalite"),
    nir,
    rqth: val("Apprenti", "RQTH"),
    email: val("Apprenti", "Courriel"),
    telephone: val("Apprenti", "Telephone"),
    adresse: val("Apprenti", "Adresse"),
    regimeSocial: val("Apprenti", "Regime social"),
    representantLegal: {
      nom: val("Representant legal", "Nom et prenom"),
      lien: val("Representant legal", "Lien avec l'apprenti"),
      telephone: val("Representant legal", "Telephone"),
      email: val("Representant legal", "Courriel"),
    },
  };
}

function buildEmployeurPayload(draft: YpareoPlacementDraft) {
  const section = draft.sections.find((s) => s.title === "Employeur");
  const val = (label: string) => section?.fields.find((f) => f.label === label)?.value ?? null;
  return {
    nom: val("Nom ou denomination"),
    siret: val("SIRET"),
    adresse: val("Adresse d'execution"),
    telephone: val("Telephone"),
    email: val("Courriel"),
    codeApe: val("Code APE"),
    effectif: val("Effectif"),
    idcc: val("Code IDCC"),
    conventionCollective: val("Convention collective"),
    opco: val("OPCO"),
    caisseRetraite: val("Caisse retraite complementaire"),
    representant: val("Representant employeur"),
    contact: val("Contact entreprise"),
    fonctionContact: val("Fonction contact"),
  };
}

function buildMaitrePayload(draft: YpareoPlacementDraft) {
  const section = draft.sections.find((s) => s.title === "Maitre d'apprentissage");
  const val = (label: string) => section?.fields.find((f) => f.label === label)?.value ?? null;
  return {
    nomNaissance: val("Nom de naissance"),
    nomUsage: val("Nom d'usage"),
    prenom: val("Prenom"),
    dateNaissance: val("Date de naissance"),
    email: val("Courriel"),
    telephone: val("Telephone"),
    emploi: val("Emploi occupe"),
  };
}

function buildContratPayload(draft: YpareoPlacementDraft) {
  const section = draft.sections.find((s) => s.title === "Contrat");
  const val = (label: string) => section?.fields.find((f) => f.label === label)?.value ?? null;
  return {
    typeContrat: val("Type de contrat ou avenant"),
    dateDebutExecution: val("Date de debut d'execution"),
    dateDebutEmployeur: val("Date de debut chez l'employeur"),
    dateFin: val("Date de fin"),
    dureeHebdomadaire: val("Duree hebdomadaire"),
    referenceSalaire: val("Reference de salaire"),
    montantSmc: val("Montant SMC"),
    avantagNourriture: val("Avantage nourriture"),
    avantagLogement: val("Avantage logement"),
    autreAvantage: val("Autre avantage"),
    heuresSupplementaires: val("Heures supplementaires"),
  };
}

function buildCursusFromDraft(draft: YpareoPlacementDraft) {
  const section = draft.sections.find((s) => s.title === "Formation");
  const val = (label: string) => section?.fields.find((f) => f.label === label)?.value ?? null;
  return {
    nom: val("Cursus cible principal"),
    code: val("Code cursus"),
    id: val("Id Ypareo cursus"),
  };
}
