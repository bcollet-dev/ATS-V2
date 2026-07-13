"use server";

import { db } from "@/db";
import { candidates, companies, companyContacts, documents, mailTemplates, needs } from "@/db/schema";
import { requireAuth, requireMutator } from "@/lib/auth";
import { getGmailAccessToken, sendGmailMessage } from "@/lib/gmail-api";
import { logActivityEvent } from "@/lib/activity";
import { substituteVariables, stripHtml, type MailVariableContext } from "@/lib/mail-variables";
import { renderSignatureHtml } from "@/lib/signature";
import { createStorageClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/secret-box";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type EntityMailKind = "candidate" | "company" | "need";

export type EntityMailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export type EntityMailRecipient = {
  email: string;
  label: string;
  isPrimary: boolean;
};

export type EntityMailDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  documentType: string;
  createdAt: string;
};

export type EntityMailData = {
  entityLabel: string;
  hasGmailConnected: boolean;
  recipients: EntityMailRecipient[];
  templates: EntityMailTemplate[];
  documents: EntityMailDocument[];
  defaultSubject: string;
  defaultBody: string;
};

type SendEntityMailInput = {
  kind: EntityMailKind;
  entityId: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  attachmentDocumentIds?: string[];
};

type EntityContextResult = {
  label: string;
  context: MailVariableContext;
  logIds: {
    candidateId?: string;
    companyId?: string;
    needId?: string;
  };
};

function splitConsultantName(fullName: string): Pick<MailVariableContext, "prenom_consultant" | "nom_consultant"> {
  const parts = fullName.trim().split(/\s+/);
  return {
    prenom_consultant: parts[0] ?? "",
    nom_consultant: parts.slice(1).join(" "),
  };
}

function getAudiences(kind: EntityMailKind): Array<"candidate" | "company" | "need" | "all"> {
  if (kind === "candidate") return ["candidate", "all"];
  if (kind === "company") return ["company", "all"];
  return ["need", "company", "all"];
}

function cleanEmail(value: string): string {
  return value.trim();
}

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;

function getExtension(fileName: string, mimeType: string): string {
  const fromName = fileName.split(".").pop()?.toLowerCase();
  if (fromName && ["pdf", "doc", "docx", "jpg", "jpeg", "png"].includes(fromName)) {
    return fromName;
  }
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/msword") return "doc";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  return "bin";
}

function getStoragePrefix(kind: EntityMailKind, entityId: string): string {
  if (kind === "candidate") return `candidates/${entityId}`;
  if (kind === "company") return `companies/${entityId}`;
  return `needs/${entityId}`;
}

function entityDocumentPredicate(kind: EntityMailKind, entityId: string) {
  if (kind === "candidate") return eq(documents.candidateId, entityId);
  if (kind === "company") return eq(documents.companyId, entityId);
  return eq(documents.needId, entityId);
}

function entityDocumentValues(kind: EntityMailKind, entityId: string) {
  if (kind === "candidate") return { candidateId: entityId };
  if (kind === "company") return { companyId: entityId };
  return { needId: entityId };
}

async function loadDocumentsForEntity(
  kind: EntityMailKind,
  entityId: string
): Promise<EntityMailDocument[]> {
  const rows = await db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      mimeType: documents.mimeType,
      fileSize: documents.fileSize,
      documentType: documents.documentType,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .where(entityDocumentPredicate(kind, entityId))
    .orderBy(asc(documents.createdAt));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

function hasHtmlTag(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeBodyHtml(body: string): string {
  if (hasHtmlTag(body)) return body;
  return escapeHtml(body).replace(/\r?\n/g, "<br>");
}

function signatureForUser(user: Awaited<ReturnType<typeof requireAuth>>): string | null {
  const hasSignature = !!(
    user.sigJobTitle ||
    user.sigPhone ||
    user.sigEntity ||
    user.sigLinkedinUrl ||
    user.sigInstagramUrl
  );

  if (!hasSignature) return null;

  return renderSignatureHtml({
    fullName: user.fullName,
    jobTitle: user.sigJobTitle,
    entity: user.sigEntity,
    phone: user.sigPhone,
    photoUrl: user.sigPhotoUrl,
    linkedinUrl: user.sigLinkedinUrl,
    instagramUrl: user.sigInstagramUrl,
  });
}

function withSignature(html: string, signatureHtml: string | null): string {
  if (!signatureHtml) return html;
  return `${html}<br><br><hr style="border:none;border-top:1px solid #eee;margin:16px 0"><br>${signatureHtml}`;
}

async function loadTemplates(kind: EntityMailKind): Promise<EntityMailTemplate[]> {
  return db
    .select({
      id: mailTemplates.id,
      name: mailTemplates.name,
      subject: mailTemplates.subject,
      body: mailTemplates.body,
    })
    .from(mailTemplates)
    .where(
      and(
        eq(mailTemplates.active, true),
        isNull(mailTemplates.deletedAt),
        eq(mailTemplates.isDefaultCvNotification, false),
        inArray(mailTemplates.audience, getAudiences(kind))
      )
    )
    .orderBy(asc(mailTemplates.name));
}

async function loadCandidateMailData(
  entityId: string
): Promise<Omit<EntityMailData, "hasGmailConnected" | "templates" | "documents"> | null> {
  const [row] = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      email: candidates.email,
    })
    .from(candidates)
    .where(and(eq(candidates.id, entityId), isNull(candidates.deletedAt)))
    .limit(1);

  if (!row) return null;

  const label = `${row.firstName} ${row.lastName}`;
  return {
    entityLabel: label,
    recipients: row.email
      ? [{ email: row.email, label, isPrimary: true }]
      : [],
    defaultSubject: "",
    defaultBody: `Bonjour ${row.firstName},\n\n`,
  };
}

async function loadCompanyMailData(
  entityId: string
): Promise<Omit<EntityMailData, "hasGmailConnected" | "templates" | "documents"> | null> {
  const [company] = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies)
    .where(eq(companies.id, entityId))
    .limit(1);

  if (!company) return null;

  const contacts = await db
    .select({
      email: companyContacts.email,
      firstName: companyContacts.firstName,
      lastName: companyContacts.lastName,
      jobTitle: companyContacts.jobTitle,
      isPrimary: companyContacts.isPrimary,
    })
    .from(companyContacts)
    .where(and(eq(companyContacts.companyId, entityId), isNull(companyContacts.deletedAt)))
    .orderBy(asc(companyContacts.createdAt));

  const recipients = contacts
    .filter((contact) => !!contact.email)
    .map((contact) => ({
      email: contact.email!,
      label: `${contact.firstName} ${contact.lastName}${contact.jobTitle ? ` - ${contact.jobTitle}` : ""}`,
      isPrimary: contact.isPrimary !== null && contact.isPrimary !== "",
    }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));

  return {
    entityLabel: company.name,
    recipients,
    defaultSubject: "",
    defaultBody: "Bonjour,\n\n",
  };
}

async function loadNeedMailData(
  entityId: string
): Promise<Omit<EntityMailData, "hasGmailConnected" | "templates" | "documents"> | null> {
  const [need] = await db
    .select({
      id: needs.id,
      title: needs.title,
      companyId: needs.companyId,
      companyName: companies.name,
      contactId: needs.contactId,
      masterEmail: needs.masterEmail,
      masterFirstName: needs.masterFirstName,
      masterLastName: needs.masterLastName,
    })
    .from(needs)
    .leftJoin(companies, eq(needs.companyId, companies.id))
    .where(and(eq(needs.id, entityId), isNull(needs.deletedAt)))
    .limit(1);

  if (!need) return null;

  const contacts = await db
    .select({
      id: companyContacts.id,
      email: companyContacts.email,
      firstName: companyContacts.firstName,
      lastName: companyContacts.lastName,
      jobTitle: companyContacts.jobTitle,
      isPrimary: companyContacts.isPrimary,
    })
    .from(companyContacts)
    .where(and(eq(companyContacts.companyId, need.companyId), isNull(companyContacts.deletedAt)))
    .orderBy(asc(companyContacts.createdAt));

  const recipients = contacts
    .filter((contact) => !!contact.email)
    .map((contact) => ({
      email: contact.email!,
      label: `${contact.firstName} ${contact.lastName}${contact.jobTitle ? ` - ${contact.jobTitle}` : ""}`,
      isPrimary: contact.id === need.contactId || (contact.isPrimary !== null && contact.isPrimary !== ""),
    }));

  if (need.masterEmail) {
    recipients.push({
      email: need.masterEmail,
      label: `${need.masterFirstName ?? ""} ${need.masterLastName ?? ""}`.trim() || "Maitre d'apprentissage",
      isPrimary: recipients.length === 0,
    });
  }

  return {
    entityLabel: `${need.title} - ${need.companyName ?? "Entreprise"}`,
    recipients: recipients.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)),
    defaultSubject: need.title,
    defaultBody: "Bonjour,\n\n",
  };
}

export async function loadEntityMailData(
  kind: EntityMailKind,
  entityId: string
): Promise<EntityMailData | null> {
  const user = await requireAuth();
  const [templates, entityData, entityDocuments] = await Promise.all([
    loadTemplates(kind),
    kind === "candidate"
      ? loadCandidateMailData(entityId)
      : kind === "company"
      ? loadCompanyMailData(entityId)
      : loadNeedMailData(entityId),
    loadDocumentsForEntity(kind, entityId),
  ]);

  if (!entityData) return null;

  return {
    ...entityData,
    hasGmailConnected: !!user.googleRefreshToken,
    templates,
    documents: entityDocuments,
  };
}

async function buildCandidateContext(entityId: string): Promise<EntityContextResult | null> {
  const [row] = await db
    .select({
      id: candidates.id,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
      email: candidates.email,
      phone: candidates.phone,
      cursusEnvisage: candidates.cursusEnvisage,
      city: candidates.city,
    })
    .from(candidates)
    .where(and(eq(candidates.id, entityId), isNull(candidates.deletedAt)))
    .limit(1);

  if (!row) return null;

  return {
    label: `${row.firstName} ${row.lastName}`,
    logIds: { candidateId: row.id },
    context: {
      prenom_candidat: row.firstName,
      nom_candidat: row.lastName,
      email_candidat: row.email ?? "",
      telephone_candidat: row.phone ?? "",
      cursus_candidat: row.cursusEnvisage ?? "",
      ville_candidat: row.city ?? "",
      nom_ecole: "EDA Groupe",
    },
  };
}

async function buildCompanyContext(entityId: string, recipientEmail: string): Promise<EntityContextResult | null> {
  const [company, contact] = await Promise.all([
    db
      .select({
        id: companies.id,
        name: companies.name,
        city: companies.city,
        siret: companies.siret,
      })
      .from(companies)
      .where(eq(companies.id, entityId))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({
        firstName: companyContacts.firstName,
        lastName: companyContacts.lastName,
      })
      .from(companyContacts)
      .where(
        and(
          eq(companyContacts.companyId, entityId),
          eq(companyContacts.email, recipientEmail),
          isNull(companyContacts.deletedAt)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  if (!company) return null;

  return {
    label: company.name,
    logIds: { companyId: company.id },
    context: {
      entreprise_associee: company.name,
      nom_entreprise: company.name,
      ville_entreprise: company.city ?? "",
      siret_entreprise: company.siret ?? "",
      prenom_contact: contact?.firstName ?? "",
      nom_contact: contact?.lastName ?? "",
      nom_ecole: "EDA Groupe",
    },
  };
}

async function buildNeedContext(entityId: string, recipientEmail: string): Promise<EntityContextResult | null> {
  const [need] = await db
    .select({
      id: needs.id,
      title: needs.title,
      city: needs.city,
      startDate: needs.startDate,
      endDate: needs.endDate,
      contractType: needs.contractType,
      companyId: needs.companyId,
      companyName: companies.name,
      companyCity: companies.city,
      companySiret: companies.siret,
    })
    .from(needs)
    .leftJoin(companies, eq(needs.companyId, companies.id))
    .where(and(eq(needs.id, entityId), isNull(needs.deletedAt)))
    .limit(1);

  if (!need) return null;

  const [contact] = await db
    .select({
      firstName: companyContacts.firstName,
      lastName: companyContacts.lastName,
    })
    .from(companyContacts)
    .where(
      and(
        eq(companyContacts.companyId, need.companyId),
        eq(companyContacts.email, recipientEmail),
        isNull(companyContacts.deletedAt)
      )
    )
    .limit(1);

  return {
    label: need.title,
    logIds: { needId: need.id, companyId: need.companyId },
    context: {
      nom_besoin: need.title,
      titre_poste: need.title,
      ville_poste: need.city ?? "",
      date_debut: need.startDate ?? "",
      date_fin: need.endDate ?? "",
      type_contrat: need.contractType ?? "",
      entreprise_associee: need.companyName ?? "",
      nom_entreprise: need.companyName ?? "",
      ville_entreprise: need.companyCity ?? "",
      siret_entreprise: need.companySiret ?? "",
      prenom_contact: contact?.firstName ?? "",
      nom_contact: contact?.lastName ?? "",
      nom_ecole: "EDA Groupe",
    },
  };
}

async function buildEntityContext(
  kind: EntityMailKind,
  entityId: string,
  recipientEmail: string
): Promise<EntityContextResult | null> {
  if (kind === "candidate") return buildCandidateContext(entityId);
  if (kind === "company") return buildCompanyContext(entityId, recipientEmail);
  return buildNeedContext(entityId, recipientEmail);
}

function revalidateEntity(kind: EntityMailKind, entityId: string): void {
  if (kind === "candidate") {
    revalidatePath(`/candidats/${entityId}`);
    return;
  }
  if (kind === "company") {
    revalidatePath(`/annuaire/${entityId}`);
    return;
  }
  revalidatePath(`/besoins/${entityId}`);
}

async function loadAttachmentFiles(
  kind: EntityMailKind,
  entityId: string,
  documentIds: string[]
): Promise<
  | { success: true; attachments: { filename: string; content: Buffer }[] }
  | { success: false; error: string }
> {
  const uniqueIds = [...new Set(documentIds.filter(Boolean))];
  if (uniqueIds.length === 0) return { success: true, attachments: [] };

  const rows = await db
    .select({
      id: documents.id,
      fileName: documents.fileName,
      storagePath: documents.storagePath,
    })
    .from(documents)
    .where(and(entityDocumentPredicate(kind, entityId), inArray(documents.id, uniqueIds)));

  if (rows.length !== uniqueIds.length) {
    return { success: false, error: "Un document joint est introuvable sur cette fiche." };
  }

  const supabase = await createStorageClient();
  const attachments: { filename: string; content: Buffer }[] = [];
  for (const row of rows) {
    const { data, error } = await supabase.storage.from("documents").download(row.storagePath);
    if (error || !data) {
      return { success: false, error: `Impossible de récupérer ${row.fileName}.` };
    }
    attachments.push({
      filename: row.fileName,
      content: Buffer.from(await data.arrayBuffer()),
    });
  }

  return { success: true, attachments };
}

export async function uploadEntityMailAttachment(
  kind: EntityMailKind,
  entityId: string,
  formData: FormData
): Promise<{ success: true; document: EntityMailDocument } | { success: false; error: string }> {
  const actor = await requireMutator();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, error: "Aucun fichier sélectionné" };
  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    return { success: false, error: "Format non supporté (PDF, DOC, DOCX, JPG, PNG)" };
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return { success: false, error: "Fichier trop volumineux (max 20 Mo)" };
  }

  const extension = getExtension(file.name, file.type);
  const storagePath = `${getStoragePrefix(kind, entityId)}/${crypto.randomUUID()}.${extension}`;
  const bytes = await file.arrayBuffer();
  const supabase = await createStorageClient();
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { success: false, error: `Erreur d'import : ${uploadError.message}` };
  }

  const [inserted] = await db
    .insert(documents)
    .values({
      ...entityDocumentValues(kind, entityId),
      documentType: "other",
      fileName: file.name,
      storagePath,
      mimeType: file.type,
      fileSize: file.size,
      extractionStatus: null,
      createdBy: actor.id,
    })
    .returning({
      id: documents.id,
      fileName: documents.fileName,
      mimeType: documents.mimeType,
      fileSize: documents.fileSize,
      documentType: documents.documentType,
      createdAt: documents.createdAt,
    });

  revalidateEntity(kind, entityId);
  return {
    success: true,
    document: {
      ...inserted,
      createdAt: inserted.createdAt.toISOString(),
    },
  };
}

export async function sendEntityMail(
  input: SendEntityMailInput
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await requireMutator();

  const to = cleanEmail(input.to);
  if (!to) return { success: false, error: "Destinataire manquant." };
  if (!input.subject.trim()) return { success: false, error: "Objet manquant." };
  if (!input.body.trim()) return { success: false, error: "Message manquant." };

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { success: false, error: "Configuration Google manquante." };
  }
  if (!user.googleRefreshToken) {
    return { success: false, error: "Gmail n'est pas connecte. Cliquez sur Connecter Gmail dans le bloc Messagerie ou dans Trames mail, puis retentez l'envoi." };
  }

  const entityContext = await buildEntityContext(input.kind, input.entityId, to);
  if (!entityContext) return { success: false, error: "Fiche introuvable." };

  let accessToken: string;
  try {
    accessToken = await getGmailAccessToken({
      clientId,
      clientSecret,
      refreshToken: decryptSecret(user.googleRefreshToken),
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error
        ? `${err.message} Reconnectez Gmail puis retentez l'envoi.`
        : "Connexion Gmail invalide. Reconnectez Gmail puis retentez l'envoi.",
    };
  }

  const context: MailVariableContext = {
    ...entityContext.context,
    ...splitConsultantName(user.fullName),
  };
  const subject = substituteVariables(input.subject, context);
  const bodyHtml = normalizeBodyHtml(substituteVariables(input.body, context));
  const html = withSignature(bodyHtml, signatureForUser(user));
  const attachmentResult = await loadAttachmentFiles(
    input.kind,
    input.entityId,
    input.attachmentDocumentIds ?? []
  );
  if (!attachmentResult.success) return attachmentResult;

  try {
    await sendGmailMessage(accessToken, {
      fromEmail: user.email,
      fromName: "EDA Groupe",
      to,
      cc: input.cc?.trim() || undefined,
      bcc: input.bcc?.trim() || undefined,
      subject,
      html,
      text: stripHtml(html),
      attachments: attachmentResult.attachments,
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erreur d'envoi inconnue.",
    };
  }

  await logActivityEvent({
    ...entityContext.logIds,
    actorId: user.id,
    actionType: "email_sent",
    summary: `Email envoye a ${to} : ${subject}`,
    metadata: {
      to,
      cc: input.cc ?? null,
      bcc: input.bcc ?? null,
      attachmentDocumentIds: input.attachmentDocumentIds ?? [],
    },
  });

  revalidateEntity(input.kind, input.entityId);
  return { success: true };
}
