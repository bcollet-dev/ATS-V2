"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { needs, companies, needCursus, cursus, documents } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivityEvent } from "@/lib/activity";
import { readFileSync } from "fs";
import { join } from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FreDocument = {
  id: string;
  fileName: string;
  storagePath: string;
  extractionStatus: string | null;
  createdAt: string;
  kind: "generated" | "imported";
};

export type FreMissingFields = string[];

// ─── Loaders ──────────────────────────────────────────────────────────────────

export async function loadNeedFreDocuments(needId: string): Promise<FreDocument[]> {
  await requireAuth();
  const rows = await db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      storagePath: documents.storagePath,
      extractionStatus: documents.extractionStatus,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(and(eq(documents.needId, needId), eq(documents.documentType, "fre")))
    .orderBy(desc(documents.createdAt));

  return rows.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    storagePath: r.storagePath,
    extractionStatus: r.extractionStatus ?? null,
    createdAt: r.createdAt.toISOString(),
    kind: r.fileName.includes("generated") ? "generated" : "imported",
  }));
}

export async function getSignedFreUrl(storagePath: string): Promise<string | null> {
  await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 60 * 60); // 1h
  return data?.signedUrl ?? null;
}

// ─── Generate FRE ─────────────────────────────────────────────────────────────

export async function generateFre(
  needId: string
): Promise<{ success: true; documentId: string; signedUrl: string } | { success: false; error: string }> {
  const actor = await requireAuth();

  // Load all data needed for the template
  const [needRows, cursusRows] = await Promise.all([
    db
      .select({
        title: needs.title,
        city: needs.city,
        startDate: needs.startDate,
        endDate: needs.endDate,
        weeklyHours: needs.weeklyHours,
        contractType: needs.contractType,
        salaryReference: needs.salaryReference,
        smcAmount: needs.smcAmount,
        overtimeHandling: needs.overtimeHandling,
        masterFirstName: needs.masterFirstName,
        masterLastName: needs.masterLastName,
        masterBirthDate: needs.masterBirthDate,
        masterJobTitle: needs.masterJobTitle,
        masterPhone: needs.masterPhone,
        masterEmail: needs.masterEmail,
        benefitFood: needs.benefitFood,
        benefitHousing: needs.benefitHousing,
        benefitOther: needs.benefitOther,
        companyName: companies.name,
        companySiret: companies.siret,
        companyNafCode: companies.nafCode,
        companyAddress: companies.address,
        companyPostalCode: companies.postalCode,
        companyCity: companies.city,
        companyIdcc: companies.idcc,
        companyCollectiveAgreement: companies.collectiveAgreement,
        companyOpco: companies.opco,
        companyRetirementFund: companies.retirementFund,
        companyProvidentFund: companies.providentFund,
        companyLegalRepFirstName: companies.legalRepFirstName,
        companyLegalRepLastName: companies.legalRepLastName,
      })
      .from(needs)
      .leftJoin(companies, eq(needs.companyId, companies.id))
      .where(eq(needs.id, needId)),
    db
      .select({ name: cursus.name })
      .from(needCursus)
      .innerJoin(cursus, eq(needCursus.cursusId, cursus.id))
      .where(eq(needCursus.needId, needId)),
  ]);

  const need = needRows[0];
  if (!need) return { success: false, error: "Besoin introuvable" };

  const def = (v: string | null | undefined) => v ?? "";
  const cursusName = cursusRows.map((c) => c.name).join(", ");
  const fullAddress = [need.companyAddress, need.companyPostalCode, need.companyCity].filter(Boolean).join(", ");
  const isApprentissage = def(need.contractType).toLowerCase().includes("apprentissage");

  // Fill PDF form fields
  const templatePath = join(process.cwd(), "public", "templates", "fre-template.pdf");
  let pdfBuffer: Buffer;
  try {
    const { PDFDocument, PDFName, PDFBool } = await import("pdf-lib");
    const templateBytes = readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

    const setText = (fieldName: string, value: string) => {
      try { if (value) form.getTextField(fieldName).setText(value); } catch { /* champ absent */ }
    };
    const setCheck = (fieldName: string, checked: boolean) => {
      try { checked ? form.getCheckBox(fieldName).check() : form.getCheckBox(fieldName).uncheck(); } catch { /* champ absent */ }
    };

    // ── PAGE 1 — L'ALTERNANT ──────────────────────────────────────────────────
    setCheck("Case à cocher 129", false);   // Monsieur (vide, rempli manuellement)
    setCheck("Case à cocher 128", false);   // Madame
    // Nom, Prénom, NIR, établissement précédent → laissés vides (rempli par le candidat)

    // ── PAGE 1 — EMPLOYEUR ────────────────────────────────────────────────────
    setText("Champ de texte 158", def(need.companyName));
    setText("Champ de texte 159", def(need.companySiret));
    setText("Champ de texte 160", def(need.companyNafCode));
    setText("Champ de texte 161", def(need.companyIdcc));
    setText("Champ de texte 172", def(need.companyCollectiveAgreement));
    setText("Champ de texte 163", fullAddress);
    setText("Champ de texte 164", def(need.companyOpco));
    setText("Champ de texte 165", def(need.companyRetirementFund));
    setText("Champ de texte 166", def(need.companyProvidentFund));
    setText("Champ de texte 182", def(need.companyLegalRepFirstName));
    setText("Champ de texte 183", def(need.companyLegalRepLastName));

    // ── PAGE 1 — MAÎTRE D'APPRENTISSAGE ──────────────────────────────────────
    setText("Champ de texte 185", def(need.masterFirstName));
    setText("Champ de texte 184", def(need.masterLastName));
    setText("Champ de texte 187", def(need.masterBirthDate));
    setText("Champ de texte 186", def(need.masterJobTitle));
    setText("Champ de texte 190", def(need.masterPhone));
    setText("Champ de texte 192", def(need.masterEmail));

    // ── PAGE 2 — LE CONTRAT ───────────────────────────────────────────────────
    setText("Champ de texte 203", def(need.title));           // Poste occupé
    setText("Champ de texte 197", def(need.weeklyHours));     // Durée hebdomadaire
    setText("Champ de texte 200", cursusName);                // Cursus / formation
    setText("Champ de texte 201", def(need.startDate));       // Date début
    setText("Champ de texte 202", def(need.endDate));         // Date fin
    setText("Champ de texte 204", def(need.smcAmount));       // Montant SMC
    setText("Champ de texte 205", def(need.benefitFood));     // Nourriture
    setText("Champ de texte 206", def(need.benefitHousing));  // Logement

    // Nature du contrat
    setCheck("Case à cocher 134", isApprentissage);           // Apprentissage
    setCheck("Case à cocher 133", !isApprentissage && def(need.contractType) !== ""); // Professionnalisation

    // Référence de salaire
    setCheck("Case à cocher 138", def(need.salaryReference).toUpperCase() === "SMIC");
    setCheck("Case à cocher 137", def(need.salaryReference).toUpperCase() === "SMC");

    // Déléguer le rendu des apparences au lecteur PDF (évite l'erreur de police non embarquée)
    form.acroForm.dict.set(PDFName.of("NeedAppearances"), PDFBool.True);

    pdfBuffer = Buffer.from(await pdfDoc.save());
  } catch (err) {
    return { success: false, error: `Erreur génération PDF : ${(err as Error).message}` };
  }

  // Upload to Supabase Storage
  const ts = Date.now();
  const fileName = `fre-${ts}-generated.pdf`;
  const storagePath = `fre/${needId}/${fileName}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) return { success: false, error: `Erreur upload : ${uploadError.message}` };

  // Create document record
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
    .returning({ id: documents.id });

  // Signed URL for immediate download
  const { data: urlData } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 3600);

  await logActivityEvent({
    needId,
    actorId: actor.id,
    actionType: "fre_generated",
    summary: "FRE générée",
  });

  revalidatePath(`/besoins/${needId}`);
  return { success: true, documentId: inserted.id, signedUrl: urlData?.signedUrl ?? "" };
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
): Promise<{ success: true; documentId: string; extractedData: Record<string, string> } | { success: false; error: string }> {
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

  // Upload file
  const supabase = await createClient();
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
      extractionStatus: "pending",
      createdBy: actor.id,
    })
    .returning({ id: documents.id });

  // Extract text from file
  let text = "";
  try {
    const buffer = Buffer.from(bytes);
    if (ext === "pdf" || file.type === "application/pdf") {
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

  // LLM extraction
  let extractedData: Record<string, string> = {};
  if (text.trim()) {
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
- masterPhone : téléphone du maître d'apprentissage
- masterEmail : email du maître d'apprentissage
- weeklyHours : durée hebdomadaire en heures (nombre uniquement)
- contractType : type de contrat (apprentissage, professionnalisation, cdi ou cdd)
- salaryReference : SMIC ou SMC
- smcAmount : montant SMC si applicable
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
  return { success: true, documentId: inserted.id, extractedData };
}

// ─── Apply FRE extraction ─────────────────────────────────────────────────────

const needFreFields = [
  "masterFirstName", "masterLastName", "masterBirthDate", "masterJobTitle",
  "masterPhone", "masterEmail", "weeklyHours", "contractType", "salaryReference",
  "smcAmount", "overtimeHandling", "benefitFood", "benefitHousing", "benefitOther",
] as const;

const companyFreFields = [
  "opco", "idcc", "collectiveAgreement", "retirementFund", "providentFund",
  "legalRepFirstName", "legalRepLastName",
] as const;

export async function applyFreExtraction(
  documentId: string,
  needId: string,
  confirmedFields: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();

  const needUpdate: Record<string, string | null> = {};
  for (const field of needFreFields) {
    if (field in confirmedFields) {
      needUpdate[field as string] = confirmedFields[field] || null;
    }
  }

  const [needRow] = await db.select({ companyId: needs.companyId }).from(needs).where(eq(needs.id, needId));
  const companyUpdate: Record<string, string | null> = {};
  for (const field of companyFreFields) {
    if (field in confirmedFields) {
      companyUpdate[field as string] = confirmedFields[field] || null;
    }
  }

  await Promise.all([
    Object.keys(needUpdate).length > 0
      ? db.update(needs).set({ ...needUpdate, updatedAt: new Date() } as never).where(eq(needs.id, needId))
      : Promise.resolve(),
    Object.keys(companyUpdate).length > 0 && needRow?.companyId
      ? db.update(companies).set({ ...companyUpdate, updatedAt: new Date() } as never).where(eq(companies.id, needRow.companyId))
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
