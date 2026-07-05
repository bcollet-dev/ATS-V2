"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  needs,
  companies,
  companyContacts,
  documents,
  matchings,
  candidates,
  candidateFormations,
} from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { createStorageClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivityEvent } from "@/lib/activity";
import { readFileSync } from "fs";
import { join } from "path";
import { inferPreviousYearFromDate, normalizeContractDate, normalizeRemunerationLines } from "@/lib/cerfa-mapping";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FreDocument = {
  id: string;
  fileName: string;
  extractionStatus: string | null;
  createdAt: string;
  kind: "generated" | "imported";
};

export type FreMissingFields = string[];

function isAiExtractionEnabled(): boolean {
  return process.env.AI_EXTRACTION_ENABLED === "true";
}

// ─── Loaders ──────────────────────────────────────────────────────────────────

export async function loadNeedFreDocuments(needId: string): Promise<FreDocument[]> {
  await requireAuth();
  const rows = await db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      extractionStatus: documents.extractionStatus,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(and(eq(documents.needId, needId), eq(documents.documentType, "fre")))
    .orderBy(desc(documents.createdAt));

  return rows.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    extractionStatus: r.extractionStatus ?? null,
    createdAt: r.createdAt.toISOString(),
    kind: r.fileName.includes("generated") ? "generated" : "imported",
  }));
}

export async function getSignedFreUrl(documentId: string): Promise<string | null> {
  await requireAuth();
  const [row] = await db
    .select({ storagePath: documents.storagePath })
    .from(documents)
    .innerJoin(needs, eq(documents.needId, needs.id))
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.documentType, "fre"),
        isNull(needs.deletedAt)
      )
    )
    .limit(1);

  if (!row) return null;

  const supabase = await createStorageClient();
  const { data } = await supabase.storage
    .from("documents")
    .createSignedUrl(row.storagePath, 60 * 60); // 1h
  return data?.signedUrl ?? null;
}

// ─── Generate FRE ─────────────────────────────────────────────────────────────

type GenerateFreOptions = {
  candidateId?: string;
};

type GenerateFreResult =
  | { success: true; documentId: string; signedUrl: string; fileName: string; createdAt: string }
  | { success: false; error: string };

const FRE_FIELDS = {
  monsieur: "Case \u00e0 cocher4",
  madame: "Case \u00e0 cocher3",
  apprenticeship: "Case \u00e0 cocher1",
  professionalization: "Case \u00e0 cocher2",
  smic: "Case \u00e0 cocher5",
  smc: "Case \u00e0 cocher6",
  candidateLastName: "Nom",
  candidateFirstName: "Pr\u00e9nom",
  candidateSituation: "Pr\u00e9c\u00e9dente situation de lalternant",
  candidatePreviousSchool: "\u00c9tablissement pr\u00e9c\u00e9demment fr\u00e9quent\u00e9",
  candidateNir: "Num\u00e9ro de s\u00e9curit\u00e9 sociale NIR",
  companyName: "D\u00e9nomination",
  companySiret: "NSIRET de l\u00e9tablissement dex\u00e9cution du contrat",
  companySector: "Secteur dactivit\u00e9",
  companyEmployees: "fill_10",
  companyNaf: "Code activit\u00e9 de lentreprise NAF",
  companyIdcc: "Code IDCC de la convention",
  companyAgreement: "Convention collective applicable",
  companyAddress: "Adresse de l\u00e9tablissement dex\u00e9cution du contrat",
  companyOpco: "Nom de lOPCOOPCA",
  companyRetirementFund: "Caisse de retraite compl\u00e9mentaire",
  masterFirstName: "Pr\u00e9nom_2",
  masterLastName: "Nom_2",
  masterBirthDate: "Date de naissance",
  masterJobTitle: "Fonction",
  masterPhone: "T\u00e9l\u00e9phone",
  masterEmail: "Email",
  contactFirstName: "Pr\u00e9nom_3",
  contactLastName: "Nom_3",
  contactJobTitle: "Fonction_2",
  contactPhone: "T\u00e9l\u00e9phone_2",
  contactEmail: "Email_2",
  contractTitle: "Poste occup\u00e9 par lalternant en entreprise",
  weeklyHours: "Dur\u00e9e hebdomadaire du travail",
  startDate: "Date du d\u00e9but du contrat",
  endDate: "fill_4",
  smcAmount: "Si SMC montant du salaire \u00e0 lembauche",
  missions1: "Les missions principales et secondaires de lalternant 1",
  missions2: "Les missions principales et secondaires de lalternant 2",
  missions3: "Les missions principales et secondaires de lalternant 3",
  remunerationStart1: "Date12_af_date",
  remunerationEnd1: "Date13_af_date",
  remunerationReference1: "Texte29",
  remunerationStarts: [
    "Date12_af_date", "Date14_af_date", "Date16_af_date", "Date18_af_date",
    "Date20_af_date", "Date22_af_date", "Date24_af_date", "Date26_af_date",
  ],
  remunerationEnds: [
    "Date13_af_date", "Date15_af_date", "Date17_af_date", "Date19_af_date",
    "Date21_af_date", "Date23_af_date", "Date25_af_date", "Date27_af_date",
  ],
  remunerationPercents: [
    "Texte28", "Texte30", "Texte32", "Texte34",
    "Texte37", "Texte39", "Texte41", "Texte43",
  ],
  remunerationReferences: [
    "Texte29", "Texte31", "Texte33", "Texte36",
    "Texte38", "Texte40", "Texte42", "Texte44",
  ],
  monthlyGrossEuros: "Texte45",
  monthlyGrossCents: "Texte47",
  hourlyGrossEuros: "Texte46",
  hourlyGrossCents: "Texte48",
} as const;

function def(value: string | Date | null | undefined): string {
  return value == null ? "" : String(value);
}

function cleanPdfText(value: string | Date | null | undefined): string {
  return def(value)
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u0153/g, "oe")
    .replace(/\u0152/g, "OE")
    .trim();
}

function normalizeKey(value: string | null | undefined): string {
  return cleanPdfText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDateFr(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${value.getFullYear()}`;
  }
  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatDateShortFr(value: string | Date | null | undefined): string {
  const formatted = formatDateFr(value);
  const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return formatted;
  return `${Number(match[1])}/${Number(match[2])}/${match[3].slice(-2)}`;
}

function normalizeDateForDb(value: string | null | undefined): string {
  return normalizeContractDate(cleanPdfText(value)) ?? "";
}

function normalizeDateForDbWithYear(value: string | null | undefined, fallbackYear: string | null): string {
  return normalizeContractDate(cleanPdfText(value), { fallbackYear }) ?? "";
}

function splitAmount(value: string | null | undefined): [string, string] {
  const raw = cleanPdfText(value);
  if (!raw) return ["", ""];
  const normalized = raw.replace(/\s*€$/i, "").trim();
  const match = normalized.match(/^(.+?)[,.](\d{1,2})$/);
  if (!match) return [normalized, ""];
  return [match[1].trim(), match[2].padEnd(2, "0")];
}

function joinAmount(euros: string, cents: string): string {
  const left = cleanPdfText(euros);
  const right = cleanPdfText(cents);
  if (!left && !right) return "";
  return right ? `${left},${right.padStart(2, "0")}` : left;
}

function formatNir(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13) return value;
  const groups = [1, 2, 2, 2, 3, 3, 2];
  let offset = 0;
  return groups
    .map((length) => {
      const part = digits.slice(offset, offset + length);
      offset += length;
      return part;
    })
    .filter(Boolean)
    .join(" ");
}

function wrapLines(value: string | null | undefined, maxLines = 3, maxLength = 88): string[] {
  const words = cleanPdfText(value).replace(/\s+/g, " ").split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLength && current) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    } else {
      current = candidate;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);
  while (lines.length < maxLines) lines.push("");
  return lines;
}

function safeFilePart(value: string | null | undefined): string {
  const part = normalizeKey(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return part || "fre";
}

async function extractFreFieldsFromPdfForm(buffer: Buffer): Promise<Record<string, string>> {
  const { PDFDocument } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const form = pdfDoc.getForm();

  const text = (fieldName: string) => {
    try {
      return cleanPdfText(form.getTextField(fieldName).getText() ?? "");
    } catch {
      return "";
    }
  };
  const checked = (fieldName: string) => {
    try {
      return form.getCheckBox(fieldName).isChecked();
    } catch {
      return false;
    }
  };
  const put = (target: Record<string, string>, key: string, value: string) => {
    if (value) target[key] = value;
  };

  const data: Record<string, string> = {};
  put(data, "masterFirstName", text(FRE_FIELDS.masterFirstName));
  put(data, "masterLastName", text(FRE_FIELDS.masterLastName));
  put(data, "masterBirthDate", normalizeDateForDb(text(FRE_FIELDS.masterBirthDate)));
  put(data, "masterJobTitle", text(FRE_FIELDS.masterJobTitle));
  put(data, "masterPhone", text(FRE_FIELDS.masterPhone));
  put(data, "masterEmail", text(FRE_FIELDS.masterEmail));
  put(data, "contactFirstName", text(FRE_FIELDS.contactFirstName));
  put(data, "contactLastName", text(FRE_FIELDS.contactLastName));
  put(data, "contactJobTitle", text(FRE_FIELDS.contactJobTitle));
  put(data, "contactPhone", text(FRE_FIELDS.contactPhone));
  put(data, "contactEmail", text(FRE_FIELDS.contactEmail));
  put(data, "weeklyHours", text(FRE_FIELDS.weeklyHours));
  const extractedStartDate = normalizeDateForDb(text(FRE_FIELDS.startDate));
  const extractedEndDate = normalizeDateForDb(text(FRE_FIELDS.endDate));
  const fallbackRemunerationYear = extractedStartDate.slice(0, 4) || inferPreviousYearFromDate(extractedEndDate);
  put(data, "startDate", extractedStartDate);
  put(data, "endDate", extractedEndDate);
  put(data, "smcAmount", text(FRE_FIELDS.smcAmount));
  put(data, "opco", text(FRE_FIELDS.companyOpco));
  put(data, "idcc", text(FRE_FIELDS.companyIdcc));
  put(data, "collectiveAgreement", text(FRE_FIELDS.companyAgreement));
  put(data, "retirementFund", text(FRE_FIELDS.companyRetirementFund));
  put(data, "monthlyGrossSalary", joinAmount(text(FRE_FIELDS.monthlyGrossEuros), text(FRE_FIELDS.monthlyGrossCents)));
  put(data, "hourlyGrossSalary", joinAmount(text(FRE_FIELDS.hourlyGrossEuros), text(FRE_FIELDS.hourlyGrossCents)));

  FRE_FIELDS.remunerationStarts.forEach((fieldName, index) => {
    const position = index + 1;
    put(data, `remunerationStart${position}`, normalizeDateForDbWithYear(text(fieldName), fallbackRemunerationYear));
    put(data, `remunerationEnd${position}`, normalizeDateForDbWithYear(text(FRE_FIELDS.remunerationEnds[index]), fallbackRemunerationYear));
    put(data, `remunerationPercent${position}`, text(FRE_FIELDS.remunerationPercents[index]));
    put(data, `remunerationReference${position}`, text(FRE_FIELDS.remunerationReferences[index]));
  });

  if (checked(FRE_FIELDS.apprenticeship)) data.contractType = "apprentissage";
  if (checked(FRE_FIELDS.professionalization)) data.contractType = "professionnalisation";
  if (checked(FRE_FIELDS.smic)) data.salaryReference = "SMIC";
  if (checked(FRE_FIELDS.smc)) data.salaryReference = "SMC";

  return data;
}

export async function generateFre(
  needId: string,
  options: GenerateFreOptions = {}
): Promise<GenerateFreResult> {
  const actor = await requireAuth();

  const [need] = await db
    .select({
      title: needs.title,
      startDate: needs.startDate,
      endDate: needs.endDate,
      weeklyHours: needs.weeklyHours,
      contractType: needs.contractType,
      salaryReference: needs.salaryReference,
      smcAmount: needs.smcAmount,
      remunerationLines: needs.remunerationLines,
      monthlyGrossSalary: needs.monthlyGrossSalary,
      hourlyGrossSalary: needs.hourlyGrossSalary,
      missions: needs.missions,
      masterFirstName: needs.masterFirstName,
      masterLastName: needs.masterLastName,
      masterBirthDate: needs.masterBirthDate,
      masterJobTitle: needs.masterJobTitle,
      masterPhone: needs.masterPhone,
      masterEmail: needs.masterEmail,
      companyName: companies.name,
      companySiret: companies.siret,
      companyNafCode: companies.nafCode,
      companyEmployeeRange: companies.employeeRange,
      companyAddress: companies.address,
      companyPostalCode: companies.postalCode,
      companyCity: companies.city,
      companySector: companies.sector,
      companyIdcc: companies.idcc,
      companyCollectiveAgreement: companies.collectiveAgreement,
      companyOpco: companies.opco,
      companyRetirementFund: companies.retirementFund,
      contactFirstName: companyContacts.firstName,
      contactLastName: companyContacts.lastName,
      contactJobTitle: companyContacts.jobTitle,
      contactEmail: companyContacts.email,
      contactPhone: companyContacts.phone,
    })
    .from(needs)
    .leftJoin(companies, eq(needs.companyId, companies.id))
    .leftJoin(companyContacts, eq(needs.contactId, companyContacts.id))
    .where(eq(needs.id, needId))
    .limit(1);

  if (!need) return { success: false, error: "Besoin introuvable" };

  const candidateWhere = options.candidateId
    ? and(eq(matchings.needId, needId), eq(matchings.candidateId, options.candidateId), isNull(candidates.deletedAt))
    : and(eq(matchings.needId, needId), eq(matchings.propositionStatus, "waiting_fre"), isNull(candidates.deletedAt));

  const [candidate] = await db
    .select({
      id: candidates.id,
      title: candidates.title,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      socialRegime: candidates.socialRegime,
      nirEncrypted: candidates.nirEncrypted,
      nirIv: candidates.nirIv,
    })
    .from(matchings)
    .innerJoin(candidates, eq(matchings.candidateId, candidates.id))
    .where(candidateWhere)
    .orderBy(desc(matchings.isWinner), desc(matchings.updatedAt))
    .limit(1);

  if (options.candidateId && !candidate) {
    return { success: false, error: "Candidat non lie a ce besoin" };
  }

  const [latestFormation] = candidate
    ? await db
        .select({
          title: candidateFormations.title,
          institution: candidateFormations.institution,
        })
        .from(candidateFormations)
        .where(eq(candidateFormations.candidateId, candidate.id))
        .orderBy(desc(candidateFormations.isCurrent), desc(candidateFormations.endMonth), desc(candidateFormations.startMonth))
        .limit(1)
    : [];

  let nir = "";
  if (candidate?.nirEncrypted && candidate.nirIv) {
    try {
      const { decryptNir } = await import("@/lib/nir");
      nir = formatNir(decryptNir(candidate.nirEncrypted, candidate.nirIv));
    } catch {
      nir = "";
    }
  }

  const fullAddress = [
    need.companyAddress,
    need.companyPostalCode,
    need.companyCity,
  ].filter(Boolean).join(" ");
  const contactFirstName = def(need.contactFirstName) || def(need.masterFirstName);
  const contactLastName = def(need.contactLastName) || def(need.masterLastName);
  const contactJobTitle = def(need.contactJobTitle) || def(need.masterJobTitle);
  const contactPhone = def(need.contactPhone) || def(need.masterPhone);
  const contactEmail = def(need.contactEmail) || def(need.masterEmail);
  const candidateTitle = normalizeKey(candidate?.title);
  const contractType = normalizeKey(need.contractType);
  const salaryReference = normalizeKey(need.salaryReference).toUpperCase();
  const missionLines = wrapLines(need.missions);
  const savedRemunerationLines = Array.isArray(need.remunerationLines)
    ? need.remunerationLines
    : [];
  const fallbackRemunerationLine = {
    startDate: def(need.startDate),
    endDate: def(need.endDate),
    percent: "",
    reference: salaryReference,
  };
  const remunerationLines = savedRemunerationLines.length > 0
    ? savedRemunerationLines
    : [fallbackRemunerationLine];

  const isMonsieur = ["m", "mr", "monsieur"].includes(candidateTitle);
  const isMadame = ["mme", "madame", "mlle", "mademoiselle"].includes(candidateTitle);
  const isApprentissage = contractType.includes("apprentissage");
  const isProfessionalization = contractType.includes("professionnalisation") || contractType.includes("professionnalization");
  const isSmic = salaryReference === "SMIC";
  const isSmc = salaryReference === "SMC";

  const templatePath = join(process.cwd(), "public", "templates", "fre-template.pdf");
  let pdfBuffer: Buffer;
  try {
    const { PDFDocument, PDFTextField, PDFCheckBox, PDFName, PDFBool } = await import("pdf-lib");
    const templateBytes = readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

    for (const field of form.getFields()) {
      try {
        if (field instanceof PDFTextField) field.setText("");
        if (field instanceof PDFCheckBox) field.uncheck();
      } catch {
        // Some Acrobat-created fields may refuse mutation; ignore and continue.
      }
    }

    const setText = (fieldName: string, value: string | Date | null | undefined) => {
      try {
        form.getTextField(fieldName).setText(cleanPdfText(value));
      } catch {
        // The template can evolve; absent optional fields should not block generation.
      }
    };
    const setCheck = (fieldName: string, checked: boolean) => {
      try {
        const checkbox = form.getCheckBox(fieldName);
        if (checked) {
          checkbox.check();
        } else {
          checkbox.uncheck();
        }
      } catch {
        // See setText comment.
      }
    };

    setCheck(FRE_FIELDS.monsieur, isMonsieur);
    setCheck(FRE_FIELDS.madame, isMadame);
    setText(FRE_FIELDS.candidateLastName, candidate?.lastName);
    setText(FRE_FIELDS.candidateFirstName, candidate?.firstName);
    setText(FRE_FIELDS.candidateSituation, candidate?.socialRegime);
    setText(FRE_FIELDS.candidatePreviousSchool, latestFormation?.institution);
    setText(FRE_FIELDS.candidateNir, nir);

    setCheck(FRE_FIELDS.apprenticeship, isApprentissage);
    setCheck(FRE_FIELDS.professionalization, isProfessionalization);
    setText(FRE_FIELDS.companyName, need.companyName);
    setText(FRE_FIELDS.companySiret, need.companySiret);
    setText(FRE_FIELDS.companySector, need.companySector);
    setText(FRE_FIELDS.companyEmployees, need.companyEmployeeRange);
    setText(FRE_FIELDS.companyNaf, need.companyNafCode);
    setText(FRE_FIELDS.companyIdcc, need.companyIdcc);
    setText(FRE_FIELDS.companyAgreement, need.companyCollectiveAgreement);
    setText(FRE_FIELDS.companyAddress, fullAddress);
    setText(FRE_FIELDS.companyOpco, need.companyOpco);
    setText(FRE_FIELDS.companyRetirementFund, need.companyRetirementFund);

    setText(FRE_FIELDS.masterFirstName, need.masterFirstName);
    setText(FRE_FIELDS.masterLastName, need.masterLastName);
    setText(FRE_FIELDS.masterBirthDate, formatDateFr(need.masterBirthDate));
    setText(FRE_FIELDS.masterJobTitle, need.masterJobTitle);
    setText(FRE_FIELDS.masterPhone, need.masterPhone);
    setText(FRE_FIELDS.masterEmail, need.masterEmail);

    setText(FRE_FIELDS.contactFirstName, contactFirstName);
    setText(FRE_FIELDS.contactLastName, contactLastName);
    setText(FRE_FIELDS.contactJobTitle, contactJobTitle);
    setText(FRE_FIELDS.contactPhone, contactPhone);
    setText(FRE_FIELDS.contactEmail, contactEmail);

    setText(FRE_FIELDS.contractTitle, need.title);
    setText(FRE_FIELDS.weeklyHours, need.weeklyHours);
    setCheck(FRE_FIELDS.smic, isSmic);
    setCheck(FRE_FIELDS.smc, isSmc);
    setText(FRE_FIELDS.startDate, formatDateFr(need.startDate));
    setText(FRE_FIELDS.endDate, formatDateFr(need.endDate));
    setText(FRE_FIELDS.smcAmount, isSmc ? need.smcAmount : "");
    setText(FRE_FIELDS.missions1, missionLines[0]);
    setText(FRE_FIELDS.missions2, missionLines[1]);
    setText(FRE_FIELDS.missions3, missionLines[2]);

    remunerationLines.slice(0, 8).forEach((line, index) => {
      setText(FRE_FIELDS.remunerationStarts[index], formatDateShortFr(line.startDate));
      setText(FRE_FIELDS.remunerationEnds[index], formatDateShortFr(line.endDate));
      setText(FRE_FIELDS.remunerationPercents[index], line.percent);
      setText(FRE_FIELDS.remunerationReferences[index], line.reference || salaryReference);
    });
    const [monthlyEuros, monthlyCents] = splitAmount(need.monthlyGrossSalary);
    const [hourlyEuros, hourlyCents] = splitAmount(need.hourlyGrossSalary);
    setText(FRE_FIELDS.monthlyGrossEuros, monthlyEuros);
    setText(FRE_FIELDS.monthlyGrossCents, monthlyCents);
    setText(FRE_FIELDS.hourlyGrossEuros, hourlyEuros);
    setText(FRE_FIELDS.hourlyGrossCents, hourlyCents);

    form.updateFieldAppearances();
    form.acroForm.dict.set(PDFName.of("NeedAppearances"), PDFBool.True);

    pdfBuffer = Buffer.from(await pdfDoc.save());
  } catch (err) {
    return { success: false, error: `Erreur generation PDF : ${(err as Error).message}` };
  }

  const ts = Date.now();
  const fileName = `fre-${safeFilePart(candidate ? `${candidate.firstName}-${candidate.lastName}` : need.title)}-${ts}-generated.pdf`;
  const storagePath = `fre/${needId}/${fileName}`;

  const supabase = await createStorageClient();
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) return { success: false, error: `Erreur upload : ${uploadError.message}` };

  const [inserted] = await db
    .insert(documents)
    .values({
      needId,
      documentType: "fre",
      fileName,
      storagePath,
      mimeType: "application/pdf",
      fileSize: pdfBuffer.length,
      extractionStatus: null,
      createdBy: actor.id,
    })
    .returning({ id: documents.id, createdAt: documents.createdAt });

  const { data: urlData } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 3600);

  await logActivityEvent({
    needId,
    actorId: actor.id,
    actionType: "fre_generated",
    summary: candidate
      ? `FRE generee pour ${candidate.firstName} ${candidate.lastName}`
      : "FRE generee",
  });

  revalidatePath(`/besoins/${needId}`);
  revalidatePath("/besoins");
  if (candidate) {
    revalidatePath(`/candidats/${candidate.id}`);
    revalidatePath("/candidats");
  }

  return {
    success: true,
    documentId: inserted.id,
    signedUrl: urlData?.signedUrl ?? "",
    fileName,
    createdAt: inserted.createdAt.toISOString(),
  };
}

// ─── Missing company fields ───────────────────────────────────────────────────

const FRE_COMPANY_FIELDS: Array<{ field: keyof typeof companies.$inferSelect; label: string }> = [
  { field: "idcc", label: "Code IDCC" },
  { field: "collectiveAgreement", label: "Convention collective" },
  { field: "opco", label: "OPCO" },
  { field: "retirementFund", label: "Caisse de retraite" },
  { field: "providentFund", label: "Organisme de prévoyance" },
  { field: "legalRepFirstName", label: "Prénom représentant légal" },
  { field: "legalRepLastName", label: "Nom représentant légal" },
];

export async function loadFreMissingFields(needId: string): Promise<FreMissingFields> {
  await requireAuth();
  const [row] = await db
    .select({
      idcc: companies.idcc,
      collectiveAgreement: companies.collectiveAgreement,
      opco: companies.opco,
      retirementFund: companies.retirementFund,
      providentFund: companies.providentFund,
      legalRepFirstName: companies.legalRepFirstName,
      legalRepLastName: companies.legalRepLastName,
    })
    .from(needs)
    .leftJoin(companies, eq(needs.companyId, companies.id))
    .where(eq(needs.id, needId));

  if (!row) return [];
  return FRE_COMPANY_FIELDS
    .filter(({ field }) => !row[field as keyof typeof row])
    .map(({ label }) => label);
}

// ─── Import FRE ───────────────────────────────────────────────────────────────

export async function importFre(
  needId: string,
  formData: FormData
): Promise<
  | { success: true; documentId: string; document: FreDocument; extractedData: Record<string, string> }
  | { success: false; error: string }
> {
  const actor = await requireAuth();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, error: "Aucun fichier sélectionné" };

  const allowed = new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/pdf",
    "application/msword",
  ]);
  if (!allowed.has(file.type) && !file.name.endsWith(".docx") && !file.name.endsWith(".pdf")) {
    return { success: false, error: "Format non supporté. Utilisez PDF ou DOCX." };
  }

  const ts = Date.now();
  const ext = file.name.split(".").pop() ?? "docx";
  const fileName = `fre-${ts}-imported.${ext}`;
  const storagePath = `fre/${needId}/${fileName}`;
  const extractionEnabled = isAiExtractionEnabled();

  // Upload file
  const supabase = await createStorageClient();
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return { success: false, error: `Erreur upload : ${uploadError.message}` };

  // Create document record with pending extraction
  const [inserted] = await db
    .insert(documents)
    .values({
      needId,
      documentType: "fre",
      fileName,
      storagePath,
      mimeType: file.type,
      fileSize: file.size,
      extractionStatus: extractionEnabled ? "pending" : "done",
      createdBy: actor.id,
    })
    .returning({ id: documents.id, createdAt: documents.createdAt });

  const buffer = Buffer.from(bytes);
  const isPdf = ext.toLowerCase() === "pdf" || file.type === "application/pdf";
  let formExtractedData: Record<string, string> = {};

  if (isPdf) {
    try {
      formExtractedData = await extractFreFieldsFromPdfForm(buffer);
    } catch {
      formExtractedData = {};
    }
  }

  // Extract text from file only when external AI extraction is explicitly enabled.
  let text = "";
  if (extractionEnabled) {
    try {
      if (isPdf) {
        const pdfParse = (await import("pdf-parse")).default;
        const parsed = await pdfParse(buffer);
        text = parsed.text;
      } else {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      }
    } catch {
      text = "";
    }
  }

  // LLM extraction
  let extractedData: Record<string, string> = {};
  if (extractionEnabled && text.trim()) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic();
      const prompt = `Tu es un assistant d'extraction de données. Voici le texte d'une Fiche de Rémunération de l'Alternant (FRE).
Extrais les informations suivantes et retourne UNIQUEMENT un objet JSON valide, sans texte avant ni après.
Si une valeur n'est pas trouvée, utilise une chaîne vide "".

Champs à extraire (noms exacts en camelCase) :
- masterFirstName : prénom du maître d'apprentissage
- masterLastName : nom du maître d'apprentissage
- masterBirthDate : date de naissance du maître (format YYYY-MM-DD si possible)
- masterJobTitle : fonction/poste du maître d'apprentissage
- masterDiploma : diplôme ou titre le plus élevé obtenu par le maître d'apprentissage
- masterDiplomaLevel : niveau du diplôme le plus élevé du maître (3, 4, 5, 6, 7 ou 8 si possible)
- masterPhone : téléphone du maître d'apprentissage
- masterEmail : email du maître d'apprentissage
- contactFirstName : prénom du contact contrat si différent du maître d'apprentissage
- contactLastName : nom du contact contrat si différent du maître d'apprentissage
- contactJobTitle : fonction/poste du contact contrat
- contactPhone : téléphone du contact contrat
- contactEmail : email du contact contrat
- weeklyHours : durée hebdomadaire en heures (nombre uniquement)
- startDate : date de debut du contrat (format YYYY-MM-DD si possible)
- endDate : date de fin du contrat (format YYYY-MM-DD si possible)
- contractType : type de contrat (apprentissage, professionnalisation, cdi ou cdd)
- salaryReference : SMIC ou SMC
- smcAmount : montant SMC si applicable
- remunerationStart1 : date de début de la 1ère période de rémunération (format YYYY-MM-DD si possible)
- remunerationEnd1 : date de fin de la 1ère période de rémunération (format YYYY-MM-DD si possible)
- remunerationPercent1 : pourcentage de rémunération de la 1ère période
- remunerationReference1 : base de rémunération de la 1ère période (SMIC ou SMC)
- remunerationStart2 a remunerationStart8 : dates de debut des autres periodes si presentes
- remunerationEnd2 a remunerationEnd8 : dates de fin des autres periodes si presentes
- remunerationPercent2 a remunerationPercent8 : pourcentages des autres periodes si presents
- remunerationReference2 a remunerationReference8 : bases des autres periodes si presentes
- monthlyGrossSalary : salaire brut mensuel à l'embauche
- hourlyGrossSalary : salaire brut horaire si renseigné
- overtimeHandling : payées ou récupérées
- benefitFood : avantage repas en €/repas
- benefitHousing : avantage logement en €/mois
- benefitOther : autres avantages
- opco : nom de l'OPCO
- idcc : code IDCC
- collectiveAgreement : nom de la convention collective
- retirementFund : caisse de retraite complémentaire
- providentFund : organisme de prévoyance
- legalRepFirstName : prénom du représentant légal de l'entreprise
- legalRepLastName : nom du représentant légal de l'entreprise

Texte de la FRE :
${text.slice(0, 8000)}`;

      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = message.content[0].type === "text" ? message.content[0].text : "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]) as Record<string, string>;
      }
    } catch {
      // Non-fatal: return empty extraction
    }
  }

  extractedData = {
    ...extractedData,
    ...formExtractedData,
  };
  if (extractedData.masterBirthDate) {
    extractedData.masterBirthDate = normalizeDateForDb(extractedData.masterBirthDate);
  }
  if (extractedData.startDate) {
    extractedData.startDate = normalizeDateForDb(extractedData.startDate);
  }
  if (extractedData.endDate) {
    extractedData.endDate = normalizeDateForDb(extractedData.endDate);
  }
  const fallbackRemunerationYear = extractedData.startDate?.slice(0, 4)
    || inferPreviousYearFromDate(extractedData.endDate);
  for (let index = 1; index <= 8; index += 1) {
    const startKey = `remunerationStart${index}`;
    const endKey = `remunerationEnd${index}`;
    if (extractedData[startKey]) extractedData[startKey] = normalizeDateForDbWithYear(extractedData[startKey], fallbackRemunerationYear);
    if (extractedData[endKey]) extractedData[endKey] = normalizeDateForDbWithYear(extractedData[endKey], fallbackRemunerationYear);
  }
  extractedData = Object.fromEntries(
    Object.entries(extractedData)
      .map(([key, value]) => [key, cleanPdfText(value)] as const)
      .filter(([, value]) => value)
  );

  // Update document with extracted data
  await db
    .update(documents)
    .set({
      extractedData: extractedData as never,
      extractionStatus: "done",
      extractedAt: new Date(),
    })
    .where(eq(documents.id, inserted.id));

  await logActivityEvent({
    needId,
    actorId: actor.id,
    actionType: "fre_imported",
    summary: "FRE importée",
  });

  revalidatePath(`/besoins/${needId}`);
  return {
    success: true,
    documentId: inserted.id,
    document: {
      id: inserted.id,
      fileName,
      extractionStatus: "done",
      createdAt: inserted.createdAt.toISOString(),
      kind: "imported",
    },
    extractedData,
  };
}

// ─── Apply FRE extraction ─────────────────────────────────────────────────────

const needFreFields = [
  "masterFirstName", "masterLastName", "masterBirthDate", "masterJobTitle",
  "masterDiploma", "masterDiplomaLevel", "masterPhone", "masterEmail", "weeklyHours", "contractType", "salaryReference",
  "smcAmount", "overtimeHandling", "startDate", "endDate", "monthlyGrossSalary", "hourlyGrossSalary",
  "benefitFood", "benefitHousing", "benefitOther",
] as const;

const companyFreFields = [
  "opco", "idcc", "collectiveAgreement", "retirementFund", "providentFund",
  "legalRepFirstName", "legalRepLastName",
] as const;

const contactFreFields = [
  "contactFirstName", "contactLastName", "contactJobTitle", "contactPhone", "contactEmail",
] as const;

export async function applyFreExtraction(
  documentId: string,
  needId: string,
  confirmedFields: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();

  const needUpdate: Record<string, unknown> = {};
  for (const field of needFreFields) {
    if (field in confirmedFields) {
      const value = field === "masterBirthDate" || field === "startDate" || field === "endDate"
        ? normalizeDateForDb(confirmedFields[field])
        : confirmedFields[field];
      needUpdate[field as string] = value || null;
    }
  }

  const [needRow] = await db
    .select({
      companyId: needs.companyId,
      contactId: needs.contactId,
      startDate: needs.startDate,
      endDate: needs.endDate,
      salaryReference: needs.salaryReference,
      remunerationLines: needs.remunerationLines,
    })
    .from(needs)
    .where(eq(needs.id, needId));

  const remunerationLines = Array.isArray(needRow?.remunerationLines)
    ? [...needRow.remunerationLines]
    : [];
  let hasRemunerationUpdate = false;
  for (let index = 1; index <= 8; index += 1) {
    const current = remunerationLines[index - 1] ?? {};
    const line: { startDate?: string; endDate?: string; percent?: string; reference?: string } = { ...current };
    const mappings = [
      [`remunerationStart${index}`, "startDate"],
      [`remunerationEnd${index}`, "endDate"],
      [`remunerationPercent${index}`, "percent"],
      [`remunerationReference${index}`, "reference"],
    ] as const;
    for (const [field, property] of mappings) {
      if (field in confirmedFields) {
        hasRemunerationUpdate = true;
        const value = property === "startDate" || property === "endDate"
          ? normalizeDateForDb(confirmedFields[field])
          : confirmedFields[field];
        line[property] = value || undefined;
      }
    }
    if (Object.values(line).some(Boolean)) {
      remunerationLines[index - 1] = line;
    }
  }
  if (hasRemunerationUpdate) {
    const startYear = normalizeDateForDb(confirmedFields.startDate).slice(0, 4)
      || normalizeDateForDb(String(needRow?.startDate ?? "")).slice(0, 4)
      || inferPreviousYearFromDate(confirmedFields.endDate ?? needRow?.endDate);
    needUpdate.remunerationLines = normalizeRemunerationLines(
      remunerationLines.filter((line) => Object.values(line).some(Boolean)),
      {
        defaultReference: confirmedFields.salaryReference ?? needRow?.salaryReference,
        fallbackYear: startYear,
      },
    );
  }
  const companyUpdate: Record<string, string | null> = {};
  for (const field of companyFreFields) {
    if (field in confirmedFields) {
      companyUpdate[field as string] = confirmedFields[field] || null;
    }
  }

  const contactUpdate: Record<string, string | null> = {};
  const contactFieldMap = {
    contactFirstName: "firstName",
    contactLastName: "lastName",
    contactJobTitle: "jobTitle",
    contactPhone: "phone",
    contactEmail: "email",
  } as const;
  for (const field of contactFreFields) {
    if (field in confirmedFields) {
      const value = confirmedFields[field]?.trim() ?? "";
      if ((field === "contactFirstName" || field === "contactLastName") && !value) continue;
      contactUpdate[contactFieldMap[field]] = value || null;
    }
  }

  let contactIdToUpdate = needRow?.contactId ?? null;
  if (
    !contactIdToUpdate &&
    needRow?.companyId &&
    contactUpdate.firstName &&
    contactUpdate.lastName
  ) {
    const [createdContact] = await db
      .insert(companyContacts)
      .values({
        companyId: needRow.companyId,
        firstName: contactUpdate.firstName,
        lastName: contactUpdate.lastName,
        jobTitle: contactUpdate.jobTitle ?? null,
        phone: contactUpdate.phone ?? null,
        email: contactUpdate.email ?? null,
        createdBy: actor.id,
      })
      .returning({ id: companyContacts.id });
    contactIdToUpdate = createdContact.id;
    needUpdate.contactId = createdContact.id;
  }

  await Promise.all([
    Object.keys(needUpdate).length > 0
      ? db.update(needs).set({ ...needUpdate, updatedAt: new Date() } as never).where(eq(needs.id, needId))
      : Promise.resolve(),
    Object.keys(companyUpdate).length > 0 && needRow?.companyId
      ? db.update(companies).set({ ...companyUpdate, updatedAt: new Date() } as never).where(eq(companies.id, needRow.companyId))
      : Promise.resolve(),
    Object.keys(contactUpdate).length > 0 && needRow?.contactId && contactIdToUpdate
      ? db.update(companyContacts).set({ ...contactUpdate, updatedAt: new Date() } as never).where(eq(companyContacts.id, contactIdToUpdate))
      : Promise.resolve(),
  ]);

  await logActivityEvent({
    needId,
    actorId: actor.id,
    actionType: "fre_fields_applied",
    summary: `Champs extraits de la FRE appliqués (${Object.keys(confirmedFields).filter((k) => confirmedFields[k]).length} champs)`,
  });

  revalidatePath(`/besoins/${needId}`);
  return { success: true };
}
