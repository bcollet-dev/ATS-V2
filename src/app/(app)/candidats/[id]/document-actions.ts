"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  documents,
  candidates,
  candidateSkills,
  candidateExperiences,
  candidateFormations,
} from "@/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { createStorageClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { decryptNir, encryptNir, maskNir } from "@/lib/nir";
import { resolveFrenchBirthDepartment } from "@/lib/birth-department";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocType = "cv" | "cni" | "carte_vitale" | "diplome" | "other";

export type CandidateDoc = {
  id: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  extractionStatus: string | null;
  createdAt: string;
};

export type CandidateDocs = {
  cv: CandidateDoc | null;
  cni: CandidateDoc | null;
  carteVitale: CandidateDoc | null;
  diplomes: CandidateDoc[];
  other: CandidateDoc[];
};

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listCandidateDocuments(candidateId: string): Promise<CandidateDocs> {
  await requireAuth();

  const rows = await db
    .select({
      id: documents.id,
      documentType: documents.documentType,
      fileName: documents.fileName,
      mimeType: documents.mimeType,
      fileSize: documents.fileSize,
      extractionStatus: documents.extractionStatus,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.candidateId, candidateId))
    .orderBy(desc(documents.createdAt));

  const toDoc = (r: (typeof rows)[0]): CandidateDoc => ({
    id: r.id,
    documentType: r.documentType,
    fileName: r.fileName,
    mimeType: r.mimeType,
    fileSize: r.fileSize,
    extractionStatus: r.extractionStatus ?? null,
    createdAt: r.createdAt.toISOString(),
  });

  return {
    cv: rows.find((r) => r.documentType === "cv") ? toDoc(rows.find((r) => r.documentType === "cv")!) : null,
    cni: rows.find((r) => r.documentType === "cni") ? toDoc(rows.find((r) => r.documentType === "cni")!) : null,
    carteVitale: rows.find((r) => r.documentType === "carte_vitale") ? toDoc(rows.find((r) => r.documentType === "carte_vitale")!) : null,
    diplomes: rows.filter((r) => r.documentType === "diplome").map(toDoc),
    other: rows.filter((r) => r.documentType === "other").map(toDoc),
  };
}

// ─── Signed URL ───────────────────────────────────────────────────────────────

export async function getSignedCandidateDocumentUrl(documentId: string): Promise<string | null> {
  await requireAuth();
  const [row] = await db
    .select({
      storagePath: documents.storagePath,
    })
    .from(documents)
    .innerJoin(candidates, eq(documents.candidateId, candidates.id))
    .where(and(eq(documents.id, documentId), isNull(candidates.deletedAt)))
    .limit(1);

  if (!row) return null;

  const supabase = await createStorageClient();
  const { data } = await supabase.storage.from("documents").createSignedUrl(row.storagePath, 3600);
  return data?.signedUrl ?? null;
}

// ─── Get extraction data ──────────────────────────────────────────────────────

export async function getDocumentExtraction(documentId: string): Promise<Record<string, unknown> | null> {
  await requireAuth();
  const [row] = await db
    .select({
      extractedData: documents.extractedData,
    })
    .from(documents)
    .innerJoin(candidates, eq(documents.candidateId, candidates.id))
    .where(and(eq(documents.id, documentId), isNull(candidates.deletedAt)))
    .limit(1);
  if (!row) return null;
  return (row?.extractedData as Record<string, unknown> | null) ?? null;
}

// ─── Upload + extraction ──────────────────────────────────────────────────────

const ALLOWED_TYPES: Record<DocType, Set<string>> = {
  cv: new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  cni: new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png"]),
  carte_vitale: new Set(["application/pdf", "image/jpeg", "image/jpg", "image/png"]),
  diplome: new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  other: new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/jpg",
    "image/png",
  ]),
};

const MAX_SIZE = 20 * 1024 * 1024;
const UPSERT_TYPES: DocType[] = ["cv", "cni", "carte_vitale"];
const PROTECTED_EXTRACTION_KEY = "_protected";

function isAiExtractionEnabled(): boolean {
  return process.env.AI_EXTRACTION_ENABLED === "true";
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizedNir(value: unknown) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 13 ? digits.slice(0, 13) : null;
}

function protectSensitiveExtractionData(
  documentType: Exclude<DocType, "other">,
  data: Record<string, unknown>,
) {
  if (documentType !== "carte_vitale") return data;

  const nir = normalizedNir(data.nir);
  if (!nir) return data;

  const { encrypted, iv } = encryptNir(nir);
  return {
    ...data,
    nir: maskNir(nir),
    [PROTECTED_EXTRACTION_KEY]: {
      ...(objectValue(data[PROTECTED_EXTRACTION_KEY]) ?? {}),
      nirEncrypted: encrypted.toString("base64"),
      nirIv: iv.toString("base64"),
      nirMasked: maskNir(nir),
    },
  };
}

function readProtectedNir(data: Record<string, unknown>) {
  const protectedData = objectValue(data[PROTECTED_EXTRACTION_KEY]);
  const encrypted = protectedData?.nirEncrypted;
  const iv = protectedData?.nirIv;
  if (typeof encrypted === "string" && typeof iv === "string") {
    return decryptNir(Buffer.from(encrypted, "base64"), Buffer.from(iv, "base64"));
  }
  return normalizedNir(data.nir);
}

function getExt(fileName: string, mimeType: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase();
  if (fromName && ["pdf", "doc", "docx", "jpg", "jpeg", "png"].includes(fromName)) return fromName;
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/jpeg")) return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "application/msword") return "doc";
  return "docx";
}

export async function uploadCandidateDocument(
  candidateId: string,
  documentType: DocType,
  formData: FormData
): Promise<
  | { success: true; documentId: string; doc: CandidateDoc; extractedData: Record<string, unknown> | null }
  | { success: false; error: string }
> {
  const actor = await requireAuth();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, error: "Aucun fichier sélectionné" };

  const allowed = ALLOWED_TYPES[documentType];
  if (!allowed.has(file.type)) {
    return { success: false, error: "Format non supporté" };
  }
  if (file.size > MAX_SIZE) return { success: false, error: "Fichier trop volumineux (max 20 Mo)" };

  const ext = getExt(file.name, file.type);
  const uuid = crypto.randomUUID();
  const storagePath = `candidates/${candidateId}/${uuid}.${ext}`;

  const supabase = await createStorageClient();
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return { success: false, error: `Erreur upload : ${uploadError.message}` };

  let documentId: string;
  const now = new Date();
  const extractionEnabled = isAiExtractionEnabled();
  const initialExtractionStatus = documentType === "other" || !extractionEnabled ? null : "pending";

  if (UPSERT_TYPES.includes(documentType)) {
    const [existing] = await db
      .select({ id: documents.id, storagePath: documents.storagePath })
      .from(documents)
      .where(
        and(
          eq(documents.candidateId, candidateId),
          eq(documents.documentType, documentType as never)
        )
    )
      .limit(1);

    if (existing) {
      const { error: removeError } = await supabase.storage.from("documents").remove([existing.storagePath]);
      if (removeError) {
        await supabase.storage.from("documents").remove([storagePath]);
        return { success: false, error: `Erreur suppression ancien fichier : ${removeError.message}` };
      }
      documentId = existing.id;
      await db
        .update(documents)
        .set({
          fileName: file.name,
          storagePath,
          mimeType: file.type,
          fileSize: file.size,
          extractionStatus: initialExtractionStatus,
          extractedData: null as never,
          extractedAt: null,
          createdBy: actor.id,
          createdAt: now,
        })
        .where(eq(documents.id, documentId));
    } else {
      const [inserted] = await db
        .insert(documents)
        .values({
          candidateId,
          documentType: documentType as never,
          fileName: file.name,
          storagePath,
          mimeType: file.type,
          fileSize: file.size,
          extractionStatus: initialExtractionStatus,
          createdBy: actor.id,
        })
        .returning({ id: documents.id });
      documentId = inserted.id;
    }
  } else {
    const [inserted] = await db
      .insert(documents)
      .values({
        candidateId,
        documentType: documentType as never,
        fileName: file.name,
        storagePath,
        mimeType: file.type,
        fileSize: file.size,
        extractionStatus: initialExtractionStatus,
        createdBy: actor.id,
      })
      .returning({ id: documents.id });
    documentId = inserted.id;
  }

  const baseDoc: CandidateDoc = {
    id: documentId,
    documentType,
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    extractionStatus: initialExtractionStatus,
    createdAt: now.toISOString(),
  };

  if (documentType === "other" || !extractionEnabled) {
    revalidatePath(`/candidats/${candidateId}`);
    return { success: true, documentId, doc: baseDoc, extractedData: null };
  }

  const extractedData = await runExtraction(documentId, buffer, file.type, documentType);

  const finalDoc: CandidateDoc = {
    ...baseDoc,
    extractionStatus: extractedData !== null ? "done" : "failed",
  };

  revalidatePath(`/candidats/${candidateId}`);
  return { success: true, documentId, doc: finalDoc, extractedData };
}

// ─── Internal extraction ──────────────────────────────────────────────────────

const PROMPTS: Record<Exclude<DocType, "other">, string> = {
  cv: `Tu es un assistant d'extraction pour un ATS spécialisé en alternance.
Voici le texte d'un CV. Extrais les informations et retourne UNIQUEMENT un objet JSON valide, sans texte avant ni après.
Si une valeur n'est pas trouvée, utilise "" pour les chaînes ou [] pour les tableaux.
Les mois utilisent le format YYYY-MM.

Format attendu :
{
  "email": "",
  "phone": "",
  "addressLine1": "",
  "postalCode": "",
  "city": "",
  "skills": ["compétence1", "compétence2"],
  "experiences": [
    {
      "jobTitle": "",
      "company": "",
      "contractType": "",
      "startMonth": "YYYY-MM",
      "endMonth": "YYYY-MM",
      "isCurrent": false,
      "description": ""
    }
  ],
  "formations": [
    {
      "title": "",
      "institution": "",
      "startMonth": "YYYY-MM",
      "endMonth": "YYYY-MM",
      "isCurrent": false
    }
  ]
}`,

  cni: `Tu es un assistant d'extraction pour un ATS. Extrais les informations d'une Carte Nationale d'Identité française.
Retourne UNIQUEMENT un objet JSON valide, sans texte avant ni après. Si une valeur n'est pas trouvée, utilise "".

Règles :
- sex : "M" si masculin, "F" si féminin
- birthName : nom de naissance (nom de famille inscrit à la naissance)
- lastName : nom d'usage (uniquement si différent du nom de naissance, sinon laisser "")
- firstName : tous les prénoms inscrits sur la CNI

Format attendu :
{
  "sex": "M",
  "firstName": "",
  "lastName": "",
  "birthName": "",
  "birthDate": "YYYY-MM-DD",
  "birthCity": "",
  "birthDepartment": "",
  "birthCountry": "France",
  "nationality": "Française"
}`,

  carte_vitale: `Tu es un assistant d'extraction. Extrais le numéro NIR (numéro de sécurité sociale) d'une carte vitale française.
Le NIR est composé de 13 chiffres (sans espaces ni clé de contrôle sur 2 chiffres).
Retourne UNIQUEMENT un objet JSON valide, sans texte avant ni après.

Format attendu :
{
  "nir": "1234567890123"
}`,

  diplome: `Tu es un assistant d'extraction pour un ATS. Extrais les informations d'un diplôme ou d'une attestation de formation.
Retourne UNIQUEMENT un objet JSON valide, sans texte avant ni après. Si une valeur n'est pas trouvée, utilise "".
Les mois utilisent le format YYYY-MM.

Format attendu :
{
  "formations": [
    {
      "title": "",
      "institution": "",
      "startMonth": "YYYY-MM",
      "endMonth": "YYYY-MM",
      "isCurrent": false
    }
  ]
}`,
};

async function runExtraction(
  documentId: string,
  buffer: Buffer,
  mimeType: string,
  documentType: Exclude<DocType, "other">
): Promise<Record<string, unknown> | null> {
  const prompt = PROMPTS[documentType];
  const isImage = mimeType.startsWith("image/");

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic();
    let rawJson = "";

    if (isImage) {
      const base64 = buffer.toString("base64");
      const mediaType = (
        mimeType === "image/png" ? "image/png" : "image/jpeg"
      ) as "image/jpeg" | "image/png";

      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      });

      rawJson = message.content[0].type === "text" ? message.content[0].text : "";
    } else {
      let text = "";
      const isPdf = mimeType === "application/pdf" || buffer.slice(0, 4).toString() === "%PDF";

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

      if (text.trim().length < 10 && isPdf) {
        // PDF scanné (image) — Claude traite directement le PDF en mode vision
        const message = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
              } as never,
              { type: "text", text: prompt },
            ],
          }],
        });
        rawJson = message.content[0].type === "text" ? message.content[0].text : "";
      } else if (!text.trim()) {
        await db.update(documents).set({ extractionStatus: "failed" }).where(eq(documents.id, documentId));
        return null;
      } else {
        const message = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2048,
          messages: [{ role: "user", content: `${prompt}\n\nTexte du document :\n${text.slice(0, 8000)}` }],
        });
        rawJson = message.content[0].type === "text" ? message.content[0].text : "";
      }
    }

    const match = rawJson.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Aucun JSON trouvé dans la réponse");

    const extractedData = JSON.parse(match[0]) as Record<string, unknown>;
    const dataForStorage = protectSensitiveExtractionData(documentType, extractedData);

    await db
      .update(documents)
      .set({
        extractedData: dataForStorage as never,
        extractionStatus: "done",
        extractedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    return dataForStorage;
  } catch {
    await db
      .update(documents)
      .set({ extractionStatus: "failed" })
      .where(eq(documents.id, documentId));
    return null;
  }
}

// ─── Retry extraction ─────────────────────────────────────────────────────────

export async function retryDocumentExtraction(
  documentId: string,
  candidateId: string
): Promise<{ success: boolean; extractedData?: Record<string, unknown>; error?: string }> {
  await requireAuth();
  if (!isAiExtractionEnabled()) {
    return { success: false, error: "Extraction IA desactivee" };
  }

  const [row] = await db
    .select({
      storagePath: documents.storagePath,
      mimeType: documents.mimeType,
      documentType: documents.documentType,
    })
    .from(documents)
    .innerJoin(candidates, eq(documents.candidateId, candidates.id))
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.candidateId, candidateId),
        isNull(candidates.deletedAt)
      )
    );

  if (!row) return { success: false, error: "Document introuvable" };

  const supabase = await createStorageClient();
  const { data, error } = await supabase.storage.from("documents").download(row.storagePath);
  if (error || !data) return { success: false, error: "Impossible de récupérer le fichier" };

  const buffer = Buffer.from(await data.arrayBuffer());

  await db
    .update(documents)
    .set({ extractionStatus: "pending", extractedData: null as never, extractedAt: null })
    .where(eq(documents.id, documentId));

  const extractedData = await runExtraction(
    documentId,
    buffer,
    row.mimeType,
    row.documentType as Exclude<DocType, "other">
  );

  revalidatePath(`/candidats/${candidateId}`);

  if (extractedData === null) {
    return { success: false, error: "Extraction échouée" };
  }
  return { success: true, extractedData };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteCandidateDocument(
  documentId: string,
  candidateId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAuth();

  const [row] = await db
    .select({ storagePath: documents.storagePath })
    .from(documents)
    .innerJoin(candidates, eq(documents.candidateId, candidates.id))
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.candidateId, candidateId),
        isNull(candidates.deletedAt)
      )
    )
    .limit(1);
  if (!row) return { success: false, error: "Document introuvable" };

  const supabase = await createStorageClient();
  const { error: removeError } = await supabase.storage.from("documents").remove([row.storagePath]);
  if (removeError) {
    return { success: false, error: `Erreur suppression fichier : ${removeError.message}` };
  }

  await db
    .delete(documents)
    .where(and(eq(documents.id, documentId), eq(documents.candidateId, candidateId)));

  revalidatePath(`/candidats/${candidateId}`);
  return { success: true };
}

// ─── Apply extraction ─────────────────────────────────────────────────────────

type ExpData = {
  jobTitle?: string;
  company?: string;
  contractType?: string;
  startMonth?: string;
  endMonth?: string;
  isCurrent?: boolean;
  description?: string;
};

type FormData2 = {
  title?: string;
  institution?: string;
  startMonth?: string;
  endMonth?: string;
  isCurrent?: boolean;
};

const SCALAR_CANDIDATE_FIELDS = [
  "email",
  "phone",
  "addressLine1",
  "postalCode",
  "city",
  "firstName",
  "lastName",
  "birthName",
  "birthDate",
  "birthCity",
  "birthDepartment",
  "birthCountry",
  "nationality",
] as const;

export async function applyDocumentExtraction(
  documentId: string,
  candidateId: string,
  checkedKeys: string[]
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();

  const [doc] = await db
    .select({
      extractedData: documents.extractedData,
      documentType: documents.documentType,
    })
    .from(documents)
    .innerJoin(candidates, eq(documents.candidateId, candidates.id))
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.candidateId, candidateId),
        isNull(candidates.deletedAt)
      )
    )
    .limit(1);

  if (!doc?.extractedData) return { success: false, error: "Aucune donnée extraite" };

  const data = doc.extractedData as Record<string, unknown>;
  const keys = new Set(checkedKeys);

  // ── Scalar candidate fields ──
  const candidateUpdate: Record<string, string | null> = {};
  for (const field of SCALAR_CANDIDATE_FIELDS) {
    if (keys.has(field) && data[field] !== undefined) {
      candidateUpdate[field] = (data[field] as string) || null;
    }
  }

  // sex → title (civilité)
  if (keys.has("sex") && data.sex) {
    const sex = (data.sex as string).toUpperCase();
    candidateUpdate["title"] = sex === "F" ? "Mme" : sex === "M" ? "M." : null;
  }

  // Si lastName absent/vide mais birthName coché → lastName = birthName
  if (keys.has("birthName") && data.birthName && !candidateUpdate["lastName"]) {
    candidateUpdate["lastName"] = (data.birthName as string) || null;
  }

  const birthDepartment = await resolveFrenchBirthDepartment({
    currentDepartment: candidateUpdate.birthDepartment,
    birthCity: candidateUpdate.birthCity,
    birthCountry: candidateUpdate.birthCountry ?? data.birthCountry,
  });
  if (birthDepartment) candidateUpdate.birthDepartment = birthDepartment;

  if (Object.keys(candidateUpdate).length > 0) {
    await db
      .update(candidates)
      .set({ ...candidateUpdate, updatedAt: new Date() } as never)
      .where(eq(candidates.id, candidateId));
  }

  // ── NIR (admin/admissions only) ──
  if (keys.has("nir") && (actor.role === "admin" || actor.role === "admissions")) {
    const nirStr = readProtectedNir(data);
    if (nirStr) {
      const { encrypted, iv } = encryptNir(nirStr.slice(0, 13));
      await db
        .update(candidates)
        .set({ nirEncrypted: encrypted, nirIv: iv, updatedAt: new Date() })
        .where(eq(candidates.id, candidateId));
    }
  }

  // ── Skills (dédoublonnage par nom, insensible à la casse) ──
  const skills = ((data.skills as string[] | undefined) ?? []).filter(Boolean);
  const skillsWanted = checkedKeys
    .filter((k) => k.startsWith("skill_"))
    .map((k) => skills[parseInt(k.replace("skill_", ""))])
    .filter((s): s is string => !!s);

  if (skillsWanted.length > 0) {
    const existingSkills = await db
      .select({ name: candidateSkills.name })
      .from(candidateSkills)
      .where(eq(candidateSkills.candidateId, candidateId));
    const existingNames = new Set(existingSkills.map((s) => s.name.trim().toLowerCase()));
    const newSkills = skillsWanted.filter((name) => !existingNames.has(name.trim().toLowerCase()));
    if (newSkills.length > 0) {
      await db.insert(candidateSkills)
        .values(newSkills.map((name) => ({ candidateId, name: name.trim() })))
        .onConflictDoNothing();
    }
  }

  // ── Experiences (dédoublonnage par jobTitle + company + startMonth) ──
  const experiences = ((data.experiences as ExpData[] | undefined) ?? []).filter(Boolean);
  const expsWanted = checkedKeys
    .filter((k) => k.startsWith("experience_"))
    .map((k) => experiences[parseInt(k.replace("experience_", ""))])
    .filter((e): e is ExpData => !!e);

  if (expsWanted.length > 0) {
    const existingExps = await db
      .select({
        jobTitle: candidateExperiences.jobTitle,
        company: candidateExperiences.company,
        startMonth: candidateExperiences.startMonth,
      })
      .from(candidateExperiences)
      .where(eq(candidateExperiences.candidateId, candidateId));
    const existingExpKeys = new Set(
      existingExps.map((e) => `${e.jobTitle}|${e.company}|${e.startMonth}`)
    );
    const newExps = expsWanted.filter((exp) => {
      const key = `${exp.jobTitle || "—"}|${exp.company || "—"}|${exp.startMonth || "2024-01"}`;
      return !existingExpKeys.has(key);
    });
    if (newExps.length > 0) {
      await db.insert(candidateExperiences).values(
        newExps.map((exp) => ({
          candidateId,
          jobTitle: exp.jobTitle || "—",
          company: exp.company || "—",
          contractType: exp.contractType || null,
          startMonth: exp.startMonth || "2024-01",
          endMonth: exp.endMonth || null,
          isCurrent: exp.isCurrent ?? false,
          description: exp.description || null,
        }))
      );
    }
  }

  // ── Formations (dédoublonnage par title + institution + startMonth) ──
  const formations = ((data.formations as FormData2[] | undefined) ?? []).filter(Boolean);
  const formationsWanted = checkedKeys
    .filter((k) => k.startsWith("formation_"))
    .map((k) => formations[parseInt(k.replace("formation_", ""))])
    .filter((f): f is FormData2 => !!f);

  if (formationsWanted.length > 0) {
    const existingFormations = await db
      .select({
        title: candidateFormations.title,
        institution: candidateFormations.institution,
        startMonth: candidateFormations.startMonth,
      })
      .from(candidateFormations)
      .where(eq(candidateFormations.candidateId, candidateId));
    const existingFormKeys = new Set(
      existingFormations.map((f) => `${f.title}|${f.institution}|${f.startMonth}`)
    );
    const newFormations = formationsWanted.filter((f) => {
      const key = `${f.title || "—"}|${f.institution || "—"}|${f.startMonth || "2024-01"}`;
      return !existingFormKeys.has(key);
    });
    if (newFormations.length > 0) {
      await db.insert(candidateFormations).values(
        newFormations.map((f) => ({
          candidateId,
          title: f.title || "—",
          institution: f.institution || "—",
          startMonth: f.startMonth || "2024-01",
          endMonth: f.endMonth || null,
          isCurrent: f.isCurrent ?? false,
        }))
      );
    }
  }

  revalidatePath(`/candidats/${candidateId}`);
  return { success: true };
}
