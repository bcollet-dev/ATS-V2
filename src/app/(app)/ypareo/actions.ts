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
import { resolveFrenchBirthDepartment } from "@/lib/birth-department";
import { decryptNir } from "@/lib/nir";
import {
  createYpareoEntreprise,
  createYpareoEntreprisePersonnel,
  createYpareoLearnerCursus,
  createYpareoPerson,
  fetchYpareoEntreprise,
  fetchYpareoEntreprisePersonnel,
  fetchYpareoActionFormation,
  fetchYpareoFormation,
  fetchYpareoPersonCursus,
  fetchYpareoPersonCursusContracts,
  fetchYpareoPersonCursusDetails,
  fetchYpareoStatuses,
  pushPlacementToYpareo,
  searchYpareoEntreprises,
  searchYpareoLegalForms,
  searchYpareoPersons,
  searchYpareoRetirementFunds,
  updateYpareoContratApprentissage,
  updateYpareoEntreprise,
  updateYpareoInscription,
} from "@/lib/ypareo/client";
import {
  inferMasterApprenticeshipDiplomaLevel,
  inferPreviousYearFromDate,
  integerCodeFromValue,
  normalizeContractDate,
  normalizeRemunerationLines,
  ypareoDerniereClasse,
  ypareoDiplomeLePlusEleve,
  ypareoDiplomeOuTitrePrepare,
  ypareoSituationAvantContrat,
} from "@/lib/cerfa-mapping";
import type {
  YpareoDraftField,
  YpareoDraftSection,
  YpareoPlacementDraft,
  YpareoPlacementSource,
} from "@/lib/ypareo/placement-draft";
import { and, asc, desc, eq, gte, inArray, isNull, notInArray } from "drizzle-orm";
import { can, type AppRole } from "@/lib/permissions";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { sendSlackNotification, buildPlacementBlocks } from "@/lib/slack";

type PairRow = {
  matchingId: string;
  propositionStatus: string;
  isWinner: boolean;
  candidateId: string;
  needId: string;
};

type JsonRecord = Record<string, unknown>;
const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

type SelectedYpareoClass = {
  externalId: string | null;
  name: string;
  code: string | null;
  startDate: string | null;
  endDate: string | null;
  rawData: unknown;
  cursusExternalId: string | null;
  cursusName: string;
  cursusRawData: unknown;
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

function objectValue(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function arrayValue(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    : [];
}

function apiData(payload: unknown): JsonRecord | null {
  const obj = objectValue(payload);
  if (!obj) return null;
  return objectValue(obj.data) ?? obj;
}

function apiRecords(payload: unknown): JsonRecord[] {
  const obj = objectValue(payload);
  if (!obj) return arrayValue(payload);
  return arrayValue(obj.data).length > 0
    ? arrayValue(obj.data)
    : arrayValue(obj.items).length > 0
      ? arrayValue(obj.items)
      : arrayValue(obj.results);
}

function textPath(record: unknown, path: string) {
  let value: unknown = record;
  for (const part of path.split(".")) {
    const obj = objectValue(value);
    if (!obj) return null;
    value = obj[part];
  }
  return clean(value);
}

function nonEmptyYpareoId(value: unknown) {
  const id = clean(value);
  return id && id !== EMPTY_GUID ? id : null;
}

function firstTextPath(record: unknown, paths: string[]) {
  for (const path of paths) {
    const value = nonEmptyYpareoId(textPath(record, path));
    if (value) return value;
  }
  return null;
}

function numberPath(record: unknown, path: string) {
  return numberValue(textPath(record, path));
}

function responseId(payload: unknown) {
  const data = apiData(payload);
  return clean(data?.id);
}

function draftValue(draft: YpareoPlacementDraft, sectionTitle: string, label: string) {
  return draft.sections
    .find((section) => section.title === sectionTitle)
    ?.fields.find((field) => field.label === label)
    ?.value ?? null;
}

function field(label: string, value: unknown, required = false): YpareoDraftField {
  return { label, value: clean(value), required };
}

function numberValue(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  const normalized = text.replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function integerCodeValue(value: unknown) {
  return integerCodeFromValue(value);
}

function dateValue(value: unknown) {
  return normalizeContractDate(value);
}

function lookupKey(value: unknown) {
  return clean(value)
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? "";
}

function ypareoSex(value: unknown) {
  const key = lookupKey(value);
  if (!key) return null;
  if (["m", "mr", "monsieur", "masculin", "homme"].includes(key)) return "M";
  if (["f", "mme", "madame", "mlle", "mademoiselle", "feminin", "femme"].includes(key)) return "F";
  return null;
}

function ypareoCivilite(value: unknown) {
  const sex = ypareoSex(value);
  if (sex === "M") return 1;
  if (sex === "F") return 2;
  return null;
}

function ypareoNationalite(value: unknown) {
  const numeric = integerCodeValue(value);
  if (numeric !== null) return numeric;

  const key = lookupKey(value);
  if (!key) return null;
  if (["fra", "fr", "france", "francais", "francaise"].includes(key)) return 1;
  if (key.includes("inconnu")) return 9;

  const europeanUnion = new Set([
    "allemagne", "de", "deu", "autriche", "at", "aut", "belgique", "be", "bel",
    "bulgarie", "bg", "bgr", "chypre", "cy", "cyp", "croatie", "hr", "hrv",
    "danemark", "dk", "dnk", "espagne", "es", "esp", "estonie", "ee", "est",
    "finlande", "fi", "fin", "grece", "gr", "grc", "hongrie", "hu", "hun",
    "irlande", "ie", "irl", "italie", "it", "ita", "lettonie", "lv", "lva",
    "lituanie", "lt", "ltu", "luxembourg", "lu", "lux", "malte", "mt", "mlt",
    "pays bas", "nl", "nld", "pologne", "pl", "pol", "portugal", "pt", "prt",
    "republique tcheque", "cz", "cze", "roumanie", "ro", "rou", "slovaquie",
    "sk", "svk", "slovenie", "si", "svn", "suede", "se", "swe",
  ]);
  if (key === "ue" || key === "eu" || key.includes("union europeenne") || europeanUnion.has(key)) {
    return 2;
  }

  return 3;
}

const DERNIERE_CLASSE_LABELS: Record<number, string> = {
  1: "Derniere annee du cycle obtenue",
  11: "1ere annee validee",
  12: "1ere annee non validee",
  21: "2e annee validee",
  22: "2e annee non validee",
  31: "3e annee validee",
  32: "3e annee non validee",
  40: "College acheve",
  41: "Etudes interrompues en 3e",
  42: "Etudes interrompues en 4e",
};

const DIPLOME_LABELS: Record<number, string> = {
  80: "Doctorat",
  73: "Master",
  75: "Diplome d'ingenieur",
  76: "Diplome d'ecole de commerce",
  79: "Autre bac +5 ou plus",
  62: "Licence professionnelle",
  63: "Licence generale",
  64: "Bachelor universitaire de technologie (BUT)",
  69: "Autre bac +3 ou +4",
  54: "BTS",
  55: "DUT",
  58: "Autre bac +2",
  41: "Bac professionnel",
  42: "Bac general",
  43: "Bac technologique",
  44: "Diplome de specialisation professionnelle",
  49: "Autre bac",
  33: "CAP",
  34: "BEP",
  35: "Certificat de specialisation (ex-mention complementaire)",
  38: "Autre CAP/BEP",
  25: "Diplome national du Brevet",
  26: "Certificat de formation generale",
  13: "Aucun diplome ni titre professionnel",
};

function codeLabel(code: number | null, labels: Record<number, string>) {
  return code === null ? null : `${code} - ${labels[code] ?? "Code CERFA"}`;
}

function formationText(formation: Awaited<ReturnType<typeof loadLatestFormation>> | null) {
  if (!formation) return null;
  return [formation.title, formation.institution].map(clean).filter(Boolean).join(" - ") || null;
}

function ypareoTypeContratOuAvenant(value: unknown) {
  const numeric = integerCodeValue(value);
  if (numeric !== null) return numeric;

  const key = lookupKey(value);
  if (!key) return null;

  // Codes CERFA "Type de contrat ou d'avenant"
  if (key.includes("premier") || key.includes("initial")) return 11;
  if (key.includes("meme employeur")) return 21;
  if (key.includes("autre employeur")) return 22;
  if (key.includes("rompu")) return 23;
  if (key.includes("situation juridique")) return 31;
  if (key.includes("saisonnier")) return 32;
  if (key.includes("echec")) return 33;
  if (key.includes("travailleur handicape") || key.includes("reconnaissance")) return 34;
  if (key.includes("diplome supplementaire")) return 35;
  if (key.includes("lieu d execution") || key.includes("lieu execution")) return 37;
  if (key.includes("lieu principal") || key.includes("formation theorique")) return 38;
  if (key.includes("autre") || key.includes("changement")) return 36;
  // "apprentissage" seul (sans autre qualificatif) = premier contrat
  if (key.includes("apprentissage")) return 11;
  return null;
}

function yesNoValue(value: unknown) {
  const text = clean(value)?.toLowerCase();
  if (!text) return false;
  return ["oui", "true", "1", "yes"].includes(text);
}

function ypareoSalaryBase(value: unknown, fallback: string | null = null) {
  const key = lookupKey(value);
  if (key.includes("smc")) return "SMC";
  if (key.includes("smic")) return "SMIC";
  return fallback;
}

function ypareoDiplomeOuTitreVise(formationDetails: JsonRecord | null) {
  const level = numberPath(formationDetails, "sortie.niveauDeSortie.code");
  if (level === 6) return "69";
  if (level === 7) return "79";
  if (level === 8) return "80";
  return null;
}

function addressPayload(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  const postalCityMatch = text.match(/\b(\d{5})\s+([^,]+)/);
  const allPostalMatches = Array.from(text.matchAll(/\b(\d{5})\b/g));
  const lastPostal = allPostalMatches.at(-1)?.[1] ?? null;
  return {
    ligne1: parts.length > 1 ? parts.slice(0, -1).join(", ") : text,
    ligne2: null,
    codePostal: postalCityMatch?.[1] ?? lastPostal,
    commune: postalCityMatch?.[2]?.trim() || null,
    codeInsee: null,
  };
}

function personAddressPayload(value: unknown) {
  const address = addressPayload(value);
  if (!address) return null;
  return {
    ligne1: address.ligne1,
    ligne2: address.ligne2,
    codePostal: address.codePostal,
    ville: address.commune,
    paysAlpha: "FR",
  };
}

function weeklyDuration(value: unknown) {
  const numeric = numberValue(value);
  if (numeric === null) return { hours: null, minutes: null };
  const hours = Math.trunc(numeric);
  const minutes = Math.round((numeric - hours) * 60);
  return { hours, minutes };
}

function collectMissingFields(sections: YpareoDraftSection[]) {
  const missing: string[] = [];
  for (const section of sections) addMissing(section, missing);
  return missing;
}

function compactYpareoPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value
      .map(compactYpareoPayload)
      .filter((item) => item !== null && item !== undefined);
    return items.length > 0 ? items : undefined;
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, compactYpareoPayload(item)] as const)
      .filter(([, item]) => item !== null && item !== undefined && item !== "");
    if (entries.length === 0) return undefined;
    return Object.fromEntries(entries);
  }

  return value;
}

function buildPersonPayload(draft: YpareoPlacementDraft) {
  const section = (title: string) => draft.sections.find((s) => s.title === title);
  const val = (sectionTitle: string, label: string) =>
    section(sectionTitle)?.fields.find((f) => f.label === label)?.value ?? null;
  const email = val("Apprenti", "Courriel");
  const phone = val("Apprenti", "Telephone");

  return compactYpareoPayload({
    nom: val("Apprenti", "Nom d'usage"),
    nomNaissance: val("Apprenti", "Nom de naissance"),
    prenom: val("Apprenti", "Premier prenom"),
    idCivilite: ypareoCivilite(val("Apprenti", "Civilite / sexe")),
    idNationalite: ypareoNationalite(val("Apprenti", "Nationalite")),
    isRqth: yesNoValue(val("Apprenti", "RQTH")),
    dateNaissance: dateValue(val("Apprenti", "Date de naissance")),
    adresse: personAddressPayload(val("Apprenti", "Adresse")),
    lieuNaissance: {
      codeDepartement: val("Apprenti", "Departement de naissance"),
      nomCommune: val("Apprenti", "Commune de naissance"),
      paysAlpha: "FR",
    },
    emails: email ? [{ adresse: email, isDefault: true }] : [],
    telephones: phone ? [{ numero: phone, indicatif: "+33", isDefaultAppel: true, isDefaultSms: true }] : [],
  }) as JsonRecord;
}

function buildLearnerCursusPayload(
  selectedClass: SelectedYpareoClass,
  actionDetails: JsonRecord | null,
  organismeId: string,
  apprenticeshipStatusId: string,
  draft: YpareoPlacementDraft,
) {
  const formationId = textPath(actionDetails, "formation.id") ?? selectedClass.cursusExternalId;

  return compactYpareoPayload({
    idFormation: formationId,
    idOrganisme: organismeId,
    idStatut: apprenticeshipStatusId,
    nom: selectedClass.name,
    idSituationAvantApprentissage: ypareoSituationAvantContrat(
      draftValue(draft, "Apprenti", "Situation avant ce contrat"),
      false,
    ),
    resultatCertification: 2,
  }) as JsonRecord;
}

function resolveYpareoOrganismeId(
  selectedClass: SelectedYpareoClass,
  actionDetails: JsonRecord | null,
) {
  const paths = [
    "organisme.id",
    "idOrganisme",
    "organismeId",
    "idOrganismeFormation",
    "organismeFormation.id",
    "cfa.id",
    "cfaResponsable.id",
    "formation.organisme.id",
    "lieuFormation.organisme.id",
  ];

  return firstTextPath(actionDetails, paths)
    ?? firstTextPath(selectedClass.rawData, paths)
    ?? firstTextPath(selectedClass.cursusRawData, paths);
}

function findExistingLearnerCursus(
  existingCursus: JsonRecord[],
  selectedClass: SelectedYpareoClass,
  actionDetails: JsonRecord | null,
) {
  const formationId = textPath(actionDetails, "formation.id") ?? selectedClass.cursusExternalId;
  return existingCursus.find((item) => (
    textPath(item, "formation.id") === formationId ||
    textPath(item, "idFormation") === formationId ||
    textPath(item, "nom") === selectedClass.name
  )) ?? null;
}

async function findYpareoPersonByEmail(email: string | null) {
  if (!email) return null;
  const rows = apiRecords(await searchYpareoPersons(email));
  const normalizedEmail = email.toLowerCase();
  const exact = rows.find((row) => (
    clean(row.emailParDefaut)?.toLowerCase() === normalizedEmail ||
    arrayValue(row.emails).some((entry) => (
      clean(entry.adresse)?.toLowerCase() === normalizedEmail ||
      clean(entry.email)?.toLowerCase() === normalizedEmail
    ))
  ));
  return clean(exact?.id);
}

function isYpareoMissingEntityError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const key = lookupKey(message);
  return key.includes("entite specifiee n existe pas")
    || key.includes("specified entity does not exist");
}

async function fetchYpareoPersonCursusOrNull(personId: string) {
  try {
    return apiRecords(await fetchYpareoPersonCursus(personId));
  } catch (err) {
    if (isYpareoMissingEntityError(err)) return null;
    throw err;
  }
}

async function fetchYpareoPersonCursusContractsOrNull(personId: string, cursusId: string) {
  try {
    return apiRecords(await fetchYpareoPersonCursusContracts(personId, cursusId));
  } catch (err) {
    if (isYpareoMissingEntityError(err)) return null;
    throw err;
  }
}

async function findExistingYpareoContratApprentissage(
  personId: string,
  learnerCursusId: string,
  draft: YpareoPlacementDraft,
) {
  const rows = await fetchYpareoPersonCursusContractsOrNull(personId, learnerCursusId);
  if (!rows || rows.length === 0) return null;

  const siret = normalizeSiret(draftValue(draft, "Employeur", "SIRET"));
  const bySiret = rows.find((row) => clean(row.id) && normalizeSiret(textPath(row, "employeur.siret")) === siret);
  if (bySiret) return bySiret;

  const entrepriseId = nonEmptyYpareoId(draftValue(draft, "Employeur", "Id Ypareo entreprise"));
  const byEntreprise = rows.find((row) => (
    clean(row.id)
    && entrepriseId
    && nonEmptyYpareoId(textPath(row, "employeur.idEntreprise")) === entrepriseId
  ));
  if (byEntreprise) return byEntreprise;

  const withId = rows.filter((row) => clean(row.id));
  return withId.length === 1 ? withId[0] : null;
}

function isApprenticeshipContractStatus(value: unknown) {
  const code = numberPath(value, "typeStatut.code");
  if (code === 3) return true;

  const key = lookupKey(
    textPath(value, "typeStatut.nom")
      ?? textPath(value, "statut.typeStatut.nom")
      ?? textPath(value, "statut.nom")
      ?? textPath(value, "nom")
      ?? textPath(value, "reference"),
  );
  return key.includes("contrat d apprentissage") || key === "ap";
}

async function findYpareoApprenticeshipStatusId() {
  const rows = apiRecords(await fetchYpareoStatuses());
  const match = rows.find(isApprenticeshipContractStatus);
  return clean(match?.id);
}

function findInscriptionWithApprenticeshipStatus(inscriptions: JsonRecord[]) {
  return inscriptions.find((inscription) => isApprenticeshipContractStatus(inscription)) ?? null;
}

async function ensureYpareoCursusHasApprenticeshipStatus(
  personId: string,
  cursusId: string,
  apprenticeshipStatusId: string,
) {
  const details = apiData(await fetchYpareoPersonCursusDetails(personId, cursusId));
  const inscriptions = arrayValue(details?.inscriptions);
  const current = findInscriptionWithApprenticeshipStatus(inscriptions);
  if (current) {
    return { inscriptionId: clean(current.id), mode: "existing" };
  }

  const inscription = inscriptions.find((item) => clean(item.id)) ?? null;
  const inscriptionId = clean(inscription?.id);
  if (!inscriptionId) {
    throw new Error("Ypareo n'a pas retourne d'inscription sur le cursus apprenant.");
  }

  await updateYpareoInscription(inscriptionId, compactYpareoPayload({
    idStatut: apprenticeshipStatusId,
    etatInscription: numberPath(inscription, "etatInscription.code") ?? 2,
  }) as JsonRecord);

  return { inscriptionId, mode: "updated" };
}

function normalizeSiret(value: unknown) {
  return clean(value)?.replace(/\s/g, "") ?? null;
}

async function findYpareoEntrepriseBySiret(siret: string | null) {
  if (!siret) return null;
  const rows = apiRecords(await searchYpareoEntreprises(siret));
  const exact = rows.find((row) => normalizeSiret(row.siret) === siret);
  return clean((exact ?? rows[0])?.id);
}

function normalizeYpareoLegalFormSearch(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  const numeric = text.match(/^\d+/)?.[0];
  if (numeric?.length === 4) return numeric.slice(0, 2);
  if (numeric) return numeric;
  return text;
}

function ypareoActivityCode(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  const normalized = text.replace(/[\s.]/g, "").toUpperCase();
  return /^[0-9]{4}[A-Z]$/.test(normalized) ? normalized : null;
}

async function resolveYpareoLegalFormCode(value: unknown) {
  const searchValue = normalizeYpareoLegalFormSearch(value);
  if (!searchValue) return null;
  const rows = apiRecords(await searchYpareoLegalForms(searchValue));
  const key = lookupKey(searchValue);
  const exact = rows.find((row) => (
    clean(row.code) === searchValue ||
    lookupKey(row.nom) === key ||
    lookupKey(row.abrege) === key
  ));
  return clean((exact ?? rows[0])?.code);
}

async function resolveYpareoRetirementFundId(value: unknown) {
  const searchValue = clean(value);
  if (!searchValue) return null;
  const rows = apiRecords(await searchYpareoRetirementFunds(searchValue));
  const key = lookupKey(searchValue);
  const exact = rows.find((row) => (
    lookupKey(row.nom) === key ||
    lookupKey(row.reference) === key ||
    clean(row.id) === searchValue
  ));
  return clean((exact ?? rows[0])?.id);
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
      situationBeforeContract: candidates.situationBeforeContract,
      lastPreparedDiploma: candidates.lastPreparedDiploma,
      lastClassYear: candidates.lastClassYear,
      lastDiplomaTitle: candidates.lastDiplomaTitle,
      highestDiploma: candidates.highestDiploma,
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
      contractConclusionDate: needs.contractConclusionDate,
      contractPracticalStartDate: needs.contractPracticalStartDate,
      contractMadeAt: needs.contractMadeAt,
      endDate: needs.endDate,
      weeklyHours: needs.weeklyHours,
      contractType: needs.contractType,
      salaryReference: needs.salaryReference,
      smcAmount: needs.smcAmount,
      remunerationLines: needs.remunerationLines,
      monthlyGrossSalary: needs.monthlyGrossSalary,
      hourlyGrossSalary: needs.hourlyGrossSalary,
      rncpCode: needs.rncpCode,
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
      masterDiploma: needs.masterDiploma,
      masterDiplomaLevel: needs.masterDiplomaLevel,
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
      companyYpareoTypeEmployeur: companies.ypareoTypeEmployeur,
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

async function applyYpareoPlacementPipelineState(
  draft: YpareoPlacementDraft,
  state: "placed" | "waiting_fre",
  selectedClassId: string | null,
  ypareoIds?: { contratId: string | null; inscriptionId: string | null },
) {
  if (!draft.candidateId || !draft.needId) return;

  const now = new Date();
  const matchingValues = {
    propositionStatus: state as never,
    isWinner: true,
    isFrozen: false,
    updatedAt: now,
    ...(selectedClassId ? { classId: selectedClassId } : {}),
    ...(ypareoIds?.contratId ? { ypareoContratId: ypareoIds.contratId } : {}),
    ...(ypareoIds?.inscriptionId ? { ypareoInscriptionId: ypareoIds.inscriptionId } : {}),
  };

  if (draft.matchingId) {
    await db
      .update(matchings)
      .set(matchingValues)
      .where(eq(matchings.id, draft.matchingId));
  } else {
    await db
      .update(matchings)
      .set(matchingValues)
      .where(and(eq(matchings.candidateId, draft.candidateId), eq(matchings.needId, draft.needId)));
  }

  await Promise.all([
    db
      .update(candidates)
      .set({ status: state === "placed" ? "placed" : "waiting_fre", updatedAt: now })
      .where(eq(candidates.id, draft.candidateId)),
    db
      .update(needs)
      .set({ status: state === "placed" ? "client" : "waiting_fre", updatedAt: now })
      .where(eq(needs.id, draft.needId)),
  ]);

  revalidatePath("/candidats");
  revalidatePath(`/candidats/${draft.candidateId}`);
  revalidatePath("/besoins");
  revalidatePath(`/besoins/${draft.needId}`);
  revalidatePath("/matching");
}

function ypareoStatusFromErrorMessage(message: string) {
  const match = message.match(/Ypareo a repondu\s+(\d+)/i);
  return match ? Number(match[1]) : null;
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

  const birthDepartment = await resolveFrenchBirthDepartment({
    currentDepartment: candidate?.birthDepartment,
    birthCity: candidate?.birthCity,
    birthCountry: candidate?.birthCountry,
  });
  if (candidate && birthDepartment && birthDepartment !== candidate.birthDepartment) {
    await db
      .update(candidates)
      .set({ birthDepartment, updatedAt: new Date() })
      .where(eq(candidates.id, candidate.id));
    candidate.birthDepartment = birthDepartment;
  }

  const latestFormationText = formationText(latestFormation);
  const situationAvantContrat = candidate?.situationBeforeContract ?? null;
  const dernierDiplomePrepare = candidate?.lastPreparedDiploma
    ?? codeLabel(ypareoDiplomeOuTitrePrepare(null, latestFormationText), DIPLOME_LABELS);
  const derniereClasseSuivie = candidate?.lastClassYear
    ?? codeLabel(ypareoDerniereClasse(null, latestFormation), DERNIERE_CLASSE_LABELS);
  const intituleDernierDiplome = candidate?.lastDiplomaTitle ?? latestFormationText;
  const diplomePlusEleve = candidate?.highestDiploma
    ?? codeLabel(ypareoDiplomeLePlusEleve(null, latestFormationText), DIPLOME_LABELS);

  const employer: YpareoDraftSection = {
    title: "Employeur",
    fields: [
      field("Nom ou denomination", need?.companyName, true),
      field("SIRET", need?.companySiret, true),
      field("Adresse d'execution", addressLine(need?.companyAddress, need?.companyPostalCode, need?.companyCity), true),
      field("Telephone", need?.companyPhone),
      field("Courriel", need?.companyEmail),
      field("Type employeur", need?.companyYpareoTypeEmployeur),
      field("Forme juridique", need?.companyLegalForm),
      field("Code APE", need?.companyNafCode, true),
      field("Effectif", need?.companyEmployeeRange),
      field("Code IDCC", need?.companyIdcc, true),
      field("Convention collective", need?.companyCollectiveAgreement),
      field("OPCO", need?.companyOpco),
      field("Caisse retraite complementaire", need?.companyRetirementFund),
      field("Representant employeur", fullName(need?.companyLegalRepFirstName, need?.companyLegalRepLastName)),
      field("Contact entreprise", fullName(need?.contactFirstName, need?.contactLastName)),
      field("Fonction contact", need?.contactJobTitle),
      field("Telephone contact", need?.contactPhone),
      field("Courriel contact", need?.contactEmail),
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
      field("Departement de naissance", birthDepartment ?? candidate?.birthDepartment, true),
      field("Commune de naissance", candidate?.birthCity, true),
      field("Pays de naissance", candidate?.birthCountry),
      field("Nationalite", candidate?.nationality, true),
      field("Regime social", candidate?.socialRegime),
      field("Situation avant ce contrat", situationAvantContrat),
      field("Dernier diplome ou titre prepare", dernierDiplomePrepare),
      field("Derniere classe / annee suivie", derniereClasseSuivie),
      field("Intitule precis du dernier diplome ou titre prepare", intituleDernierDiplome),
      field("Diplome ou titre le plus eleve obtenu", diplomePlusEleve),
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
      field("Diplome le plus eleve obtenu", need?.masterDiploma, true),
      field("Niveau du diplome le plus eleve", need?.masterDiplomaLevel, true),
    ],
  };

  const isApprenticeship = clean(need?.contractType)?.toLowerCase().includes("apprentissage") ?? false;
  const remunerationLines = normalizeRemunerationLines(
    Array.isArray(need?.remunerationLines) ? need.remunerationLines : [],
    {
      defaultReference: need?.salaryReference,
      fallbackYear: clean(need?.startDate)?.slice(0, 4) ?? inferPreviousYearFromDate(need?.endDate),
    },
  );
  const remunerationFieldRows = (remunerationLines.length > 0 ? remunerationLines : [{
    startDate: clean(need?.startDate) ?? undefined,
    endDate: clean(need?.endDate) ?? undefined,
    percent: undefined,
    reference: clean(need?.salaryReference) ?? undefined,
  }]).slice(0, 8);
  const remunerationFields = remunerationFieldRows.flatMap((line, index) => {
    const position = index + 1;
    const firstLineRequired = isApprenticeship && position === 1;
    return [
      field(`Remuneration ${position} - Debut`, line.startDate, firstLineRequired),
      field(`Remuneration ${position} - Fin`, line.endDate, firstLineRequired),
      field(`Remuneration ${position} - Pourcentage`, line.percent, firstLineRequired),
      field(`Remuneration ${position} - Base`, line.reference, firstLineRequired),
    ];
  });

  const contract: YpareoDraftSection = {
    title: "Contrat",
    fields: [
      field("Type de contrat ou avenant", need?.contractType, true),
      field("Date de conclusion", need?.contractConclusionDate ?? need?.startDate, true),
      field("Date de debut d'execution", need?.startDate, true),
      field("Date de debut chez l'employeur", need?.contractPracticalStartDate ?? need?.startDate),
      field("Fait a", need?.contractMadeAt ?? "Courbevoie"),
      field("Date de fin", need?.endDate, true),
      field("Duree hebdomadaire", need?.weeklyHours, true),
      field("Reference de salaire", need?.salaryReference, true),
      field("Montant SMC", need?.smcAmount),
      ...remunerationFields,
      field("Salaire brut mensuel", need?.monthlyGrossSalary, true),
      field("Salaire brut horaire", need?.hourlyGrossSalary),
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
      field("Code RNCP", need?.rncpCode),
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

// ─── Slack notification helpers ───────────────────────────────────────────────

async function sendPlacementSlackNotification(
  draft: YpareoPlacementDraft,
  selectedClassId: string | null,
): Promise<void> {
  try {
    if (!selectedClassId) return;
    const [classRow, candidateRow, companyRow] = await Promise.all([
      db.select({ name: classes.name, slackWebhookUrl: classes.slackWebhookUrl })
        .from(classes).where(eq(classes.id, selectedClassId)).limit(1),
      draft.candidateId
        ? db.select({ firstName: candidates.firstName, lastName: candidates.lastName })
            .from(candidates).where(eq(candidates.id, draft.candidateId)).limit(1)
        : Promise.resolve([]),
      draft.companyId
        ? db.select({ name: companies.name })
            .from(companies).where(eq(companies.id, draft.companyId)).limit(1)
        : Promise.resolve([]),
    ]);

    const cls = classRow[0];
    if (!cls?.slackWebhookUrl) return;

    const contractSection = draft.sections.find((s) => s.title === "Contrat");
    const contractStartDate =
      contractSection?.fields.find((f) => f.label === "Date de debut d'execution")?.value ?? null;

    const cand = (candidateRow as { firstName: string; lastName: string }[])[0];
    const comp = (companyRow as { name: string }[])[0];
    const candidateName = cand ? `${cand.firstName} ${cand.lastName.toUpperCase()}` : "Candidat";
    const companyName = comp?.name ?? "Entreprise";

    await sendSlackNotification(
      cls.slackWebhookUrl,
      buildPlacementBlocks({ candidateName, companyName, className: cls.name, contractStartDate }),
    );
  } catch {
    // Non-blocking — Slack errors must never break the placement flow
  }
}

// ─── Push placement ───────────────────────────────────────────────────────────

export async function pushYpareoPlacement(
  draft: YpareoPlacementDraft,
  selectedClassId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "matchings:editStatus")) {
    return { success: false, error: "Vous n'avez pas les droits pour envoyer un placement à Ypareo." };
  }

  if (!draft.candidateId || !draft.needId || !draft.companyId) {
    return { success: false, error: "Dossier incomplet — candidat, besoin ou entreprise manquant." };
  }

  // Verrou anti double-envoi : un placement du même candidat encore "pending"
  // (moins de 5 min) signifie qu'un envoi est en cours — un double envoi
  // créerait des personnes/entreprises en doublon dans Ypareo.
  const [pendingLog] = await db
    .select({ id: ypareoLogs.id })
    .from(ypareoLogs)
    .where(
      and(
        eq(ypareoLogs.candidateId, draft.candidateId),
        eq(ypareoLogs.operation, "placement"),
        eq(ypareoLogs.status, "pending"),
        gte(ypareoLogs.createdAt, new Date(Date.now() - 5 * 60 * 1000)),
      )
    )
    .limit(1);
  if (pendingLog) {
    return { success: false, error: "Un envoi Ypareo est déjà en cours pour ce candidat — patientez quelques instants." };
  }

  const missingFields = collectMissingFields(draft.sections);
  if (missingFields.length > 0) {
    await applyYpareoPlacementPipelineState(draft, "waiting_fre", selectedClassId);
    return {
      success: false,
      error: `Champs obligatoires manquants : ${missingFields.join(", ")}`,
    };
  }

  // Load NIR server-side (never exposed in draft)
  const [candidateRow] = await db
    .select({
      nirEncrypted: candidates.nirEncrypted,
      nirIv: candidates.nirIv,
      ypareoPersonId: candidates.ypareoPersonId,
    })
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

  const [companyRow] = await db
    .select({
      ypareoEntrepriseId: companies.ypareoEntrepriseId,
      ypareoTypeEmployeur: companies.ypareoTypeEmployeur,
    })
    .from(companies)
    .where(eq(companies.id, draft.companyId))
    .limit(1);

  const typeEmployeur = companyRow?.ypareoTypeEmployeur ?? 12;

  // Resolve selected Ypareo class/action context.
  let selectedClass: SelectedYpareoClass | null = null;
  if (selectedClassId) {
    const [cls] = await db
      .select({
        externalId: classes.externalId,
        name: classes.name,
        code: classes.code,
        startDate: classes.startDate,
        endDate: classes.endDate,
        rawData: classes.rawData,
        cursusExternalId: cursus.externalId,
        cursusName: cursus.name,
        cursusRawData: cursus.rawData,
      })
      .from(classes)
      .innerJoin(cursus, eq(classes.cursusId, cursus.id))
      .where(eq(classes.id, selectedClassId))
      .limit(1);
    selectedClass = cls ?? null;
  }

  if (!selectedClass?.externalId) {
    await applyYpareoPlacementPipelineState(draft, "waiting_fre", selectedClassId);
    return { success: false, error: "Classe Ypareo manquante pour creer le cursus apprenant." };
  }

  const correlationId = randomUUID();
  const endpoint = process.env.YPAREO_PLACEMENT_PATH?.trim() || "/contrat-apprentissage";
  const baseMeta = {
    source: draft.source,
    sourceId: draft.sourceId,
    matchingId: draft.matchingId,
    selectedClass: {
      id: selectedClass.externalId,
      code: selectedClass.code,
      nom: selectedClass.name,
    },
    missingFields,
  };
  let logId: string | null = null;

  try {
    const actionDetails = apiData(await fetchYpareoActionFormation(selectedClass.externalId));
    const formationId = textPath(actionDetails, "formation.id") ?? selectedClass.cursusExternalId;
    const formationDetails = formationId ? apiData(await fetchYpareoFormation(formationId)) : null;
    const personPayload = buildPersonPayload(draft);
    const organismeId = resolveYpareoOrganismeId(selectedClass, actionDetails);

    if (!organismeId) {
      await applyYpareoPlacementPipelineState(draft, "waiting_fre", selectedClassId);
      return {
        success: false,
        error: "Organisme Ypareo introuvable pour la classe selectionnee. Relancez la synchronisation des cursus/classes ou choisissez une autre classe Ypareo.",
      };
    }

    const apprenticeshipStatusId = await findYpareoApprenticeshipStatusId();
    if (!apprenticeshipStatusId) {
      await applyYpareoPlacementPipelineState(draft, "waiting_fre", selectedClassId);
      return {
        success: false,
        error: "Statut Ypareo 'Contrat d'apprentissage' introuvable. Verifiez les statuts Ypareo avant l'envoi du contrat.",
      };
    }

    const learnerCursusPayload = buildLearnerCursusPayload(
      selectedClass,
      actionDetails,
      organismeId,
      apprenticeshipStatusId,
      draft,
    );

    const meta = {
      ...baseMeta,
      selectedClass: {
        ...baseMeta.selectedClass,
        organismeId,
        apprenticeshipStatusId,
      },
    };

    const [log] = await db
      .insert(ypareoLogs)
      .values({
        correlationId,
        candidateId: draft.candidateId,
        companyId: draft.companyId,
        operation: "placement",
        endpoint,
        method: "POST",
        requestPayload: {
          meta,
          personne: candidateRow?.ypareoPersonId ? { id: candidateRow.ypareoPersonId, mode: "existing" } : personPayload,
          cursus: learnerCursusPayload,
        },
        status: "pending",
        createdBy: actor.id,
      })
      .returning({ id: ypareoLogs.id });
    logId = log.id;

    let personId = candidateRow?.ypareoPersonId ?? null;
    let existingCursus: JsonRecord[] | null = null;
    let personLinkMode: "stored" | "found" | "created" | null = personId ? "stored" : null;

    if (personId) {
      existingCursus = await fetchYpareoPersonCursusOrNull(personId);
      if (!existingCursus) {
        personId = null;
        personLinkMode = null;
        await db
          .update(candidates)
          .set({ ypareoPersonId: null, updatedAt: new Date() })
          .where(eq(candidates.id, draft.candidateId));
      }
    }

    if (!personId) {
      const foundPersonId = await findYpareoPersonByEmail(draftValue(draft, "Apprenti", "Courriel"));
      if (foundPersonId) {
        const foundCursus = await fetchYpareoPersonCursusOrNull(foundPersonId);
        if (foundCursus) {
          personId = foundPersonId;
          existingCursus = foundCursus;
          personLinkMode = "found";
        }
      }
    }

    if (!personId) {
      const personResponse = await createYpareoPerson(personPayload);
      personId = responseId(personResponse);
      if (!personId) throw new Error("Ypareo n'a pas retourne l'identifiant de la personne creee.");
      existingCursus = [];
      personLinkMode = "created";
    }

    if (personId !== candidateRow?.ypareoPersonId) {
      await db
        .update(candidates)
        .set({ ypareoPersonId: personId, updatedAt: new Date() })
        .where(eq(candidates.id, draft.candidateId));
    }

    // Resolve the Ypareo Entreprise entity (find-or-create) — its GUID is
    // required as employeur.idEntreprise on the contrat-apprentissage.
    let entrepriseId = companyRow?.ypareoEntrepriseId ?? null;
    entrepriseId = entrepriseId ?? await findYpareoEntrepriseBySiret(normalizeSiret(draftValue(draft, "Employeur", "SIRET")));
    if (!entrepriseId) {
      const entrepriseResponse = await createYpareoEntreprise(buildEntreprisePayload(draft, typeEmployeur));
      entrepriseId = responseId(entrepriseResponse);
      if (!entrepriseId) throw new Error("Ypareo n'a pas retourne l'identifiant de l'entreprise creee.");
    }

    if (entrepriseId !== companyRow?.ypareoEntrepriseId) {
      await db
        .update(companies)
        .set({ ypareoEntrepriseId: entrepriseId, updatedAt: new Date() })
        .where(eq(companies.id, draft.companyId));
    }

    let entrepriseSyncError: string | null = null;
    try {
      await syncYpareoEntreprise(entrepriseId, draft, typeEmployeur);
    } catch (err) {
      entrepriseSyncError = err instanceof Error ? err.message : "Synchronisation entreprise Ypareo refusee.";
    }
    const idPersonnelEntreprise = await resolveYpareoMaitrePersonnelId(entrepriseId, draft);

    existingCursus = existingCursus ?? apiRecords(await fetchYpareoPersonCursus(personId));
    const matchingCursus = findExistingLearnerCursus(existingCursus, selectedClass, actionDetails);
    const cursusResponse = matchingCursus
      ? null
      : await createYpareoLearnerCursus(personId, learnerCursusPayload);
    const learnerCursusId = clean(matchingCursus?.id) ?? responseId(cursusResponse);
    if (!learnerCursusId) {
      throw new Error("Ypareo n'a pas retourne l'identifiant du cursus apprenant.");
    }
    const inscriptionStatus = await ensureYpareoCursusHasApprenticeshipStatus(
      personId,
      learnerCursusId,
      apprenticeshipStatusId,
    );

    const rawPayload: Record<string, unknown> = {
      apprenti: buildApprentiPayload(draft, nir),
      employeur: buildEmployeurPayload(draft, { idEntreprise: entrepriseId, typeEmployeur }),
      maitresApprentissages: {
        employeurAttesteEligibilite: true,
        maitreApprentissage1: buildMaitrePayload(draft, idPersonnelEntreprise),
      },
      contrat: buildContratPayload(draft),
      formation: buildFormationPayload(draft, selectedClass, actionDetails, formationDetails, organismeId),
      idCursus: learnerCursusId,
      versionCerfa: "10103*14",
    };
    const payload = compactYpareoPayload(rawPayload) as Record<string, unknown>;
    const existingContract = await findExistingYpareoContratApprentissage(personId, learnerCursusId, draft);
    const existingContractId = clean(existingContract?.id);
    const contractEndpoint = existingContractId ? `/contrat-apprentissage/${existingContractId}` : endpoint;
    const contractMethod = existingContractId ? "PUT" : "POST";
    const logPayload = {
      ...payload,
      apprenti: { ...(payload.apprenti as Record<string, unknown>), nir: nir ? "[MASKED]" : null },
      meta: {
        ...meta,
        personId,
        personLinkMode,
        learnerCursusId,
        learnerCursusMode: matchingCursus ? "existing" : "created",
        inscriptionId: inscriptionStatus.inscriptionId,
        inscriptionStatusMode: inscriptionStatus.mode,
        entrepriseSyncError,
        idPersonnelEntreprise,
        contractId: existingContractId,
        contractMode: existingContractId ? "updated" : "created",
      },
    };

    await db
      .update(ypareoLogs)
      .set({ requestPayload: logPayload, endpoint: contractEndpoint, method: contractMethod })
      .where(eq(ypareoLogs.id, log.id));

    const response = existingContractId
      ? await updateYpareoContratApprentissage(existingContractId, payload) as Record<string, unknown> | null
      : await pushPlacementToYpareo(payload) as Record<string, unknown> | null;

    await db
      .update(ypareoLogs)
      .set({ status: "success", responsePayload: response ?? {}, responseStatus: 200 })
      .where(eq(ypareoLogs.id, log.id));

    const finalContratId = existingContractId ?? clean((response as Record<string, unknown> | null)?.id);
    await applyYpareoPlacementPipelineState(draft, "placed", selectedClassId, {
      contratId: finalContratId ?? null,
      inscriptionId: inscriptionStatus.inscriptionId ?? null,
    });

    void sendPlacementSlackNotification(draft, selectedClassId);

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
    await applyYpareoPlacementPipelineState(draft, "waiting_fre", selectedClassId);
    const errorLogPayload = {
      status: "error" as const,
      errorMessage,
      responseStatus: ypareoStatusFromErrorMessage(errorMessage),
      responsePayload: { message: errorMessage },
      retryable: true,
    };
    if (logId) {
      await db
        .update(ypareoLogs)
        .set(errorLogPayload)
        .where(eq(ypareoLogs.id, logId));
    } else {
      await db
        .insert(ypareoLogs)
        .values({
          correlationId,
          candidateId: draft.candidateId,
          companyId: draft.companyId,
          operation: "placement",
          endpoint,
          method: "POST",
          requestPayload: { meta: baseMeta },
          ...errorLogPayload,
          createdBy: actor.id,
        });
    }
    return { success: false, error: errorMessage };
  }
}

function buildApprentiPayload(draft: YpareoPlacementDraft, nir: string | null) {
  const section = (title: string) => draft.sections.find((s) => s.title === title);
  const val = (sectionTitle: string, label: string) =>
    section(sectionTitle)?.fields.find((f) => f.label === label)?.value ?? null;

  return {
    nom: val("Apprenti", "Nom de naissance"),
    nomUsage: val("Apprenti", "Nom d'usage"),
    prenom: val("Apprenti", "Premier prenom"),
    sexe: ypareoSex(val("Apprenti", "Civilite / sexe")),
    dateNaissance: dateValue(val("Apprenti", "Date de naissance")),
    departementNaissance: val("Apprenti", "Departement de naissance"),
    communeNaissance: val("Apprenti", "Commune de naissance"),
    nationalite: ypareoNationalite(val("Apprenti", "Nationalite")),
    nir,
    isTravailleurHandicape: yesNoValue(val("Apprenti", "RQTH")),
    courriel: val("Apprenti", "Courriel"),
    telephone: val("Apprenti", "Telephone"),
    adresse: addressPayload(val("Apprenti", "Adresse")),
    regimeSocial: integerCodeValue(val("Apprenti", "Regime social")),
    situationAvantContrat: ypareoSituationAvantContrat(val("Apprenti", "Situation avant ce contrat"), false),
    dernierDiplomeOuTitrePrepare: ypareoDiplomeOuTitrePrepare(
      val("Apprenti", "Dernier diplome ou titre prepare"),
      val("Apprenti", "Intitule precis du dernier diplome ou titre prepare"),
    ),
    derniereClasseOuAnneeSuivie: ypareoDerniereClasse(val("Apprenti", "Derniere classe / annee suivie")),
    intitulePrecisDernierDiplome: val("Apprenti", "Intitule precis du dernier diplome ou titre prepare"),
    diplomeLePlusEleveObtenu: ypareoDiplomeLePlusEleve(
      val("Apprenti", "Diplome ou titre le plus eleve obtenu"),
      val("Apprenti", "Intitule precis du dernier diplome ou titre prepare"),
    ),
    hasProjetCreationOuRepriseEntreprise: yesNoValue(val("Apprenti", "Projet de creation/reprise d'entreprise")),
    responsableLegal: {
      nom: val("Representant legal", "Nom et prenom"),
      courriel: val("Representant legal", "Courriel"),
    },
  };
}

function buildEmployeurPayload(
  draft: YpareoPlacementDraft,
  ypareo: { idEntreprise: string | null; typeEmployeur: number | null },
) {
  const section = draft.sections.find((s) => s.title === "Employeur");
  const val = (label: string) => section?.fields.find((f) => f.label === label)?.value ?? null;
  const typeEmployeur = integerCodeValue(val("Type employeur")) ?? ypareo.typeEmployeur;
  return {
    idEntreprise: ypareo.idEntreprise,
    typeEmployeur,
    raisonSociale: val("Nom ou denomination"),
    siret: val("SIRET"),
    adresse: addressPayload(val("Adresse d'execution")),
    telephone: val("Telephone"),
    courriel: val("Courriel"),
    activite: val("Code APE"),
    effectif: numberValue(val("Effectif")),
    conventionCollective: val("Code IDCC") ?? val("Convention collective"),
  };
}

function buildEntreprisePayload(
  draft: YpareoPlacementDraft,
  typeEmployeur: number | null,
) {
  const section = draft.sections.find((s) => s.title === "Employeur");
  const val = (label: string) => section?.fields.find((f) => f.label === label)?.value ?? null;
  const email = val("Courriel");
  const phone = val("Telephone");
  const typeEmployeurValue = integerCodeValue(val("Type employeur")) ?? typeEmployeur;
  return compactYpareoPayload({
    raisonSociale: val("Nom ou denomination"),
    siret: normalizeSiret(val("SIRET")),
    adresse: personAddressPayload(val("Adresse d'execution")),
    codeActivite: ypareoActivityCode(val("Code APE")),
    codeFormeJuridique: normalizeYpareoLegalFormSearch(val("Forme juridique")),
    effectif: numberValue(val("Effectif")),
    idTypeEmployeur: typeEmployeurValue,
    codeConventionCollective: val("Code IDCC"),
    emails: email ? [{ adresse: email, isDefault: true }] : [],
    telephones: phone ? [{ numero: phone, indicatif: "+33", isDefaultAppel: true, isDefaultSms: true }] : [],
  }) as JsonRecord;
}

function responseAddressToRequest(value: unknown) {
  const obj = objectValue(value);
  if (!obj) return null;
  return compactYpareoPayload({
    ligne1: textPath(obj, "ligne1"),
    ligne2: textPath(obj, "ligne2"),
    codePostal: textPath(obj, "codePostal"),
    ville: textPath(obj, "ville"),
    paysAlpha: textPath(obj, "pays.codeAlpha2") ?? "FR",
  }) as JsonRecord;
}

function responseEmailsToRequest(value: unknown) {
  return arrayValue(value)
    .map((entry) => compactYpareoPayload({
      adresse: textPath(entry, "email") ?? textPath(entry, "adresse"),
      isDefault: entry.isDefaut ?? entry.isDefault ?? true,
    }))
    .filter(Boolean) as JsonRecord[];
}

function responsePhonesToRequest(value: unknown) {
  return arrayValue(value)
    .map((entry) => compactYpareoPayload({
      numero: textPath(entry, "numero"),
      indicatif: textPath(entry, "indicatif") ?? "+33",
      isDefaultAppel: entry.isDefautAppel ?? entry.isDefaultAppel ?? true,
      isDefaultSms: entry.isDefautSMS ?? entry.isDefaultSms ?? true,
    }))
    .filter(Boolean) as JsonRecord[];
}

async function buildEntrepriseUpdatePayload(
  draft: YpareoPlacementDraft,
  typeEmployeur: number | null,
  existing: JsonRecord | null,
) {
  const base = buildEntreprisePayload(draft, typeEmployeur);
  const section = draft.sections.find((s) => s.title === "Employeur");
  const val = (label: string) => section?.fields.find((f) => f.label === label)?.value ?? null;
  const legalFormCode = await resolveYpareoLegalFormCode(val("Forme juridique"));
  const retirementFundId = await resolveYpareoRetirementFundId(val("Caisse retraite complementaire"));
  return compactYpareoPayload({
    raisonSociale: base.raisonSociale ?? textPath(existing, "raisonSociale"),
    siret: base.siret ?? textPath(existing, "siret"),
    adresse: base.adresse ?? responseAddressToRequest(existing?.adresse),
    codeActivite: base.codeActivite ?? textPath(existing, "activite.code"),
    codeFormeJuridique: legalFormCode ?? base.codeFormeJuridique ?? textPath(existing, "formeJuridique.code"),
    effectif: base.effectif ?? numberPath(existing, "nombreDeSalarie"),
    idTypeEmployeur: base.idTypeEmployeur ?? numberPath(existing, "typeEmployeur.code"),
    codeConventionCollective: base.codeConventionCollective ?? textPath(existing, "idcc.code"),
    idCaisseRetraiteComplementaire: retirementFundId ?? textPath(existing, "caisseRetraiteComplementaire.id"),
    emails: arrayValue(base.emails).length > 0 ? base.emails : responseEmailsToRequest(existing?.emails),
    telephones: arrayValue(base.telephones).length > 0 ? base.telephones : responsePhonesToRequest(existing?.telephones),
  }) as JsonRecord;
}

async function syncYpareoEntreprise(entrepriseId: string, draft: YpareoPlacementDraft, typeEmployeur: number | null) {
  const existing = apiData(await fetchYpareoEntreprise(entrepriseId));
  await updateYpareoEntreprise(entrepriseId, await buildEntrepriseUpdatePayload(draft, typeEmployeur, existing));
}

function ypareoEmails(value: unknown) {
  return arrayValue(value)
    .map((entry) => clean(entry.email) ?? clean(entry.adresse))
    .filter(Boolean)
    .map((email) => email!.toLowerCase());
}

function personnelMatchesMaster(personnel: JsonRecord, draft: YpareoPlacementDraft) {
  const section = draft.sections.find((s) => s.title === "Maitre d'apprentissage");
  const val = (label: string) => section?.fields.find((f) => f.label === label)?.value ?? null;
  const email = clean(val("Courriel"))?.toLowerCase();
  if (email) {
    const emails = [
      ...ypareoEmails(personnel.emails),
      ...ypareoEmails(objectValue(personnel.personne)?.emails),
    ];
    if (emails.includes(email)) return true;
  }

  const firstName = lookupKey(val("Prenom"));
  const lastName = lookupKey(val("Nom d'usage") ?? val("Nom de naissance"));
  const person = objectValue(personnel.personne);
  return Boolean(firstName && lastName
    && lookupKey(person?.prenom) === firstName
    && (lookupKey(person?.nom) === lastName || lookupKey(person?.nomNaissance) === lastName));
}

async function resolveYpareoMaitrePersonnelId(entrepriseId: string, draft: YpareoPlacementDraft) {
  try {
    const rows = apiRecords(await fetchYpareoEntreprisePersonnel(entrepriseId));
    const existing = rows.find((row) => personnelMatchesMaster(row, draft));
    if (existing) return clean(existing.id);

    const section = draft.sections.find((s) => s.title === "Maitre d'apprentissage");
    const val = (label: string) => section?.fields.find((f) => f.label === label)?.value ?? null;
    const firstName = val("Prenom");
    const lastName = val("Nom d'usage") ?? val("Nom de naissance");
    if (!firstName || !lastName) return null;

    const email = val("Courriel");
    const phone = val("Telephone");
    const response = await createYpareoEntreprisePersonnel(entrepriseId, compactYpareoPayload({
      reference: fullName(firstName, lastName),
      personne: {
        prenom: firstName,
        nom: lastName,
        nomNaissance: val("Nom de naissance") ?? lastName,
        dateNaissance: dateValue(val("Date de naissance")),
      },
      emails: email ? [{ adresse: email, isDefault: true }] : [],
      telephones: phone ? [{ numero: phone, indicatif: "+33", isDefaultAppel: true, isDefaultSms: true }] : [],
    }) as JsonRecord);
    return responseId(response);
  } catch {
    return null;
  }
}

function buildMaitrePayload(draft: YpareoPlacementDraft, idPersonnelEntreprise: string | null) {
  const section = draft.sections.find((s) => s.title === "Maitre d'apprentissage");
  const val = (label: string) => section?.fields.find((f) => f.label === label)?.value ?? null;
  const diploma = val("Diplome le plus eleve obtenu");
  return {
    idPersonnelEntreprise,
    nom: val("Nom d'usage") ?? val("Nom de naissance"),
    prenom: val("Prenom"),
    dateNaissance: dateValue(val("Date de naissance")),
    courriel: val("Courriel"),
    emploiOccupe: val("Emploi occupe"),
    intituleDiplomeObtenu: diploma,
    niveauDiplomeObtenu: inferMasterApprenticeshipDiplomaLevel(
      val("Niveau du diplome le plus eleve"),
      diploma,
    ),
  };
}

function buildContratPayload(draft: YpareoPlacementDraft) {
  const section = draft.sections.find((s) => s.title === "Contrat");
  const val = (label: string) => section?.fields.find((f) => f.label === label)?.value ?? null;
  type RemunerationLine = {
    debut: string | null;
    fin: string | null;
    pourcentage: number | null;
    base: string | null;
  };
  const remuneration = Array.from({ length: 8 }, (_, index) => {
    const position = index + 1;
    const defaultSalaryBase = ypareoSalaryBase(val("Reference de salaire"), "SMIC");
    const line = {
      debut: dateValue(val(`Remuneration ${position} - Debut`)),
      fin: dateValue(val(`Remuneration ${position} - Fin`)),
      pourcentage: numberValue(val(`Remuneration ${position} - Pourcentage`))
        ?? numberValue(val(`Remuneration ${position} - Base`)),
      base: ypareoSalaryBase(val(`Remuneration ${position} - Base`), defaultSalaryBase),
    };
    return line.debut && line.fin && line.pourcentage !== null ? line : null;
  }).filter((line): line is RemunerationLine => Boolean(line));
  const duration = weeklyDuration(val("Duree hebdomadaire"));
  const dateDebutContrat = dateValue(val("Date de debut d'execution"));

  return {
    typeContratOuAvenant: ypareoTypeContratOuAvenant(val("Type de contrat ou avenant")),
    caisseRetraiteComplementaire: draft.sections.find((s) => s.title === "Employeur")?.fields.find((f) => f.label === "Caisse retraite complementaire")?.value ?? null,
    dateConclusion: dateValue(val("Date de conclusion")),
    dateDebutContrat,
    dateDebutFormationPratique: dateValue(val("Date de debut chez l'employeur")) ?? dateDebutContrat,
    dateFinContrat: dateValue(val("Date de fin")),
    faitA: val("Fait a") ?? "Courbevoie",
    dureeHebdomadaireTravailHeures: duration.hours,
    dureeHebdomadaireTravailMinutes: duration.minutes,
    remunerationsAnnuelles: remuneration.map((line, index) => ({
      ordre: String(index + 1),
      dateDebut: line.debut,
      dateFin: line.fin,
      taux: line.pourcentage,
      typeSalaire: line.base,
    })),
    salaireBrutEmbauche: numberValue(val("Salaire brut mensuel")) ?? numberValue(val("Salaire brut horaire")),
    avantageNatureNourriture: numberValue(val("Avantage nourriture")),
    avantageNatureLogement: numberValue(val("Avantage logement")),
    hasAutresAvantagesNature: Boolean(val("Autre avantage")),
  };
}

function buildFormationPayload(
  draft: YpareoPlacementDraft,
  selectedClass: SelectedYpareoClass | null,
  actionDetails: JsonRecord | null,
  formationDetails: JsonRecord | null,
  organismeId: string,
) {
  const section = draft.sections.find((s) => s.title === "Formation");
  const val = (label: string) => section?.fields.find((f) => f.label === label)?.value ?? null;
  return {
    adresseCfaResponsable: addressPayload(null),
    codeDiplome: textPath(formationDetails, "sortie.codeDiplome") ?? val("Code cursus"),
    codeRNCP: val("Code RNCP")
      ?? textPath(formationDetails, "sortie.codeRncp")
      ?? textPath(formationDetails, "sortie.codeRNCP")
      ?? textPath(formationDetails, "sortie.codeRncpRs")
      ?? textPath(formationDetails, "sortie.codeCertifInfo"),
    dateDebutCycleFormation: dateValue(selectedClass?.startDate ?? textPath(actionDetails, "calendrier.dateDebut")),
    dateFinEpreuvesExamens: dateValue(selectedClass?.endDate ?? textPath(actionDetails, "calendrier.dateFin")),
    denominationCfaResponsable: textPath(actionDetails, "organisme.nom"),
    diplomeOuTitreVise: ypareoDiplomeOuTitreVise(formationDetails),
    dureeFormation: numberPath(formationDetails, "dureeMinute")
      ? Math.round((numberPath(formationDetails, "dureeMinute") ?? 0) / 60)
      : null,
    employeurAttestePiecesJustificatives: true,
    idCfaResponsable: organismeId,
    intitulePrecisDiplome: val("Cursus cible principal") ?? textPath(formationDetails, "nom"),
    isCfaEntreprise: false,
    isCfaResponsableLieuFormationPrincipal: true,
    siret: textPath(actionDetails, "organisme.siret"),
  };
}

