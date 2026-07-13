"use server";

import { requireAuth, checkPreviewGuard } from "@/lib/auth";
import { db } from "@/db";
import { documents, activityEvents, companies } from "@/db/schema";
import { eq, and, asc, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createStorageClient } from "@/lib/supabase/server";

const MAX_SIZE = 20 * 1024 * 1024; // 20 Mo
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

function getExtension(mime: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/jpeg": "jpg",
    "image/png": "png",
  };
  return map[mime] ?? "bin";
}

export type CompanyDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
};

export async function listCompanyDocuments(companyId: string): Promise<CompanyDocument[]> {
  await requireAuth();
  const rows = await db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      mimeType: documents.mimeType,
      fileSize: documents.fileSize,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(eq(documents.companyId, companyId))
    .orderBy(asc(documents.createdAt));

  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function uploadCompanyDocument(
  companyId: string,
  formData: FormData
): Promise<{ success: true; document: CompanyDocument } | { success: false; error: string }> {
  const actor = await requireAuth();
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return previewGuard;

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, error: "Aucun fichier sélectionné" };
  if (!ALLOWED_MIME_TYPES.has(file.type))
    return { success: false, error: "Format non supporté (PDF, DOC, DOCX, JPG, PNG)" };
  if (file.size > MAX_SIZE)
    return { success: false, error: "Fichier trop volumineux (max 20 Mo)" };

  const ext = getExtension(file.type);
  const uid = crypto.randomUUID();
  const storagePath = `companies/${companyId}/${uid}.${ext}`;

  const supabase = await createStorageClient();
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) return { success: false, error: `Erreur d'upload : ${uploadError.message}` };

  const [inserted] = await db
    .insert(documents)
    .values({
      companyId,
      documentType: "other",
      fileName: file.name,
      storagePath,
      mimeType: file.type,
      fileSize: file.size,
      createdBy: actor.id,
    })
    .returning({
      id: documents.id,
      fileName: documents.fileName,
      mimeType: documents.mimeType,
      fileSize: documents.fileSize,
      createdAt: documents.createdAt,
    });

  await db.insert(activityEvents).values({
    actorId: actor.id,
    companyId,
    actionType: "company.document_added",
    summary: `Document "${file.name}" ajouté par ${actor.fullName}`,
  });

  revalidatePath(`/annuaire/${companyId}`);
  return {
    success: true,
    document: { ...inserted, createdAt: inserted.createdAt.toISOString() },
  };
}

export async function deleteCompanyDocument(
  documentId: string,
  companyId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAuth();

  const [row] = await db
    .select({ storagePath: documents.storagePath })
    .from(documents)
    .innerJoin(companies, eq(documents.companyId, companies.id))
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.companyId, companyId),
        isNull(companies.deletedAt)
      )
    )
    .limit(1);
  if (!row) return { success: false, error: "Document introuvable" };

  const supabase = await createStorageClient();
  const { error: removeError } = await supabase.storage.from("documents").remove([row.storagePath]);
  if (removeError) {
    return { success: false, error: `Erreur suppression fichier : ${removeError.message}` };
  }
  await db.delete(documents).where(and(eq(documents.id, documentId), eq(documents.companyId, companyId)));

  revalidatePath(`/annuaire/${companyId}`);
  return { success: true };
}

export async function getSignedDocumentUrl(documentId: string): Promise<string | null> {
  await requireAuth();
  const [row] = await db
    .select({ storagePath: documents.storagePath })
    .from(documents)
    .innerJoin(companies, eq(documents.companyId, companies.id))
    .where(and(eq(documents.id, documentId), isNull(companies.deletedAt)))
    .limit(1);

  if (!row) return null;

  const supabase = await createStorageClient();
  const { data } = await supabase.storage
    .from("documents")
    .createSignedUrl(row.storagePath, 60 * 60);
  return data?.signedUrl ?? null;
}
