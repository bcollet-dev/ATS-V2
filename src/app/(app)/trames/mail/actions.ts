"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { mailTemplates, profiles } from "@/db/schema";
import { eq, isNull, and, asc, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const EDIT_ROLES = new Set(["admin", "team_leader", "admissions"]);

export type MailTemplateRow = {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string | null;
  audience: "candidate" | "company" | "need" | "all";
  active: boolean;
  isDefaultCvNotification: boolean;
  createdByName: string | null;
  updatedAt: string;
};

export async function listMailTemplates({ includeArchived = false }: { includeArchived?: boolean } = {}): Promise<MailTemplateRow[]> {
  await requireAuth();

  const rows = await db
    .select({
      id: mailTemplates.id,
      name: mailTemplates.name,
      subject: mailTemplates.subject,
      body: mailTemplates.body,
      category: mailTemplates.category,
      audience: mailTemplates.audience,
      active: mailTemplates.active,
      isDefaultCvNotification: mailTemplates.isDefaultCvNotification,
      createdByName: profiles.fullName,
      updatedAt: mailTemplates.updatedAt,
    })
    .from(mailTemplates)
    .leftJoin(profiles, eq(mailTemplates.createdBy, profiles.id))
    .where(
      includeArchived
        ? isNull(mailTemplates.deletedAt)
        : and(isNull(mailTemplates.deletedAt), eq(mailTemplates.active, true))
    )
    .orderBy(asc(mailTemplates.name));

  return rows.map((r) => ({
    ...r,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

// ─── Signature ───────────────────────────────────────────────────────────────

export type SignatureData = {
  photoUrl:     string | null;
  jobTitle:     string | null;
  entity:       string | null;
  phone:        string | null;
  linkedinUrl:  string | null;
  instagramUrl: string | null;
};

export async function loadSignatureData(): Promise<SignatureData> {
  const actor = await requireAuth();
  const row = await db
    .select({
      sigPhotoUrl:     profiles.sigPhotoUrl,
      sigJobTitle:     profiles.sigJobTitle,
      sigEntity:       profiles.sigEntity,
      sigPhone:        profiles.sigPhone,
      sigLinkedinUrl:  profiles.sigLinkedinUrl,
      sigInstagramUrl: profiles.sigInstagramUrl,
    })
    .from(profiles)
    .where(eq(profiles.id, actor.id))
    .limit(1);
  const r = row[0];
  return {
    photoUrl:     r?.sigPhotoUrl     ?? null,
    jobTitle:     r?.sigJobTitle     ?? null,
    entity:       r?.sigEntity       ?? null,
    phone:        r?.sigPhone        ?? null,
    linkedinUrl:  r?.sigLinkedinUrl  ?? null,
    instagramUrl: r?.sigInstagramUrl ?? null,
  };
}

export async function saveSignatureData(
  data: SignatureData
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  await db
    .update(profiles)
    .set({
      sigPhotoUrl:     data.photoUrl     || null,
      sigJobTitle:     data.jobTitle     || null,
      sigEntity:       data.entity       || null,
      sigPhone:        data.phone        || null,
      sigLinkedinUrl:  data.linkedinUrl  || null,
      sigInstagramUrl: data.instagramUrl || null,
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, actor.id));
  revalidatePath("/trames/mail");
  return { success: true };
}

export async function setDefaultCvNotification(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (!EDIT_ROLES.has(actor.role)) return { success: false, error: "Non autorisé" };

  await db.transaction(async (tx) => {
    // Clear any existing default
    await tx
      .update(mailTemplates)
      .set({ isDefaultCvNotification: false })
      .where(and(eq(mailTemplates.isDefaultCvNotification, true), ne(mailTemplates.id, id)));
    // Set the new default
    await tx
      .update(mailTemplates)
      .set({ isDefaultCvNotification: true, updatedAt: new Date() })
      .where(eq(mailTemplates.id, id));
  });

  revalidatePath("/trames/mail");
  return { success: true };
}

export async function unsetDefaultCvNotification(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (!EDIT_ROLES.has(actor.role)) return { success: false, error: "Non autorisé" };

  await db
    .update(mailTemplates)
    .set({ isDefaultCvNotification: false, updatedAt: new Date() })
    .where(eq(mailTemplates.id, id));

  revalidatePath("/trames/mail");
  return { success: true };
}

export async function loadDefaultCvNotificationTemplate(): Promise<{
  id: string; subject: string; body: string;
} | null> {
  await requireAuth();
  const [row] = await db
    .select({ id: mailTemplates.id, subject: mailTemplates.subject, body: mailTemplates.body })
    .from(mailTemplates)
    .where(and(eq(mailTemplates.isDefaultCvNotification, true), isNull(mailTemplates.deletedAt)))
    .limit(1);
  return row ?? null;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

type TemplateData = {
  name: string;
  subject: string;
  body: string;
  category: string | null;
  audience: "candidate" | "company" | "need" | "all";
};

export async function createMailTemplate(
  data: TemplateData
): Promise<{ success: true; data: MailTemplateRow } | { success: false; error: string }> {
  const actor = await requireAuth();
  if (!EDIT_ROLES.has(actor.role)) return { success: false, error: "Non autorisé" };

  const [created] = await db
    .insert(mailTemplates)
    .values({
      name: data.name.trim(),
      subject: data.subject.trim(),
      body: data.body,
      category: data.category?.trim() || null,
      audience: data.audience,
      createdBy: actor.id,
    })
    .returning({
      id: mailTemplates.id,
      name: mailTemplates.name,
      subject: mailTemplates.subject,
      body: mailTemplates.body,
      category: mailTemplates.category,
      audience: mailTemplates.audience,
      active: mailTemplates.active,
      isDefaultCvNotification: mailTemplates.isDefaultCvNotification,
      updatedAt: mailTemplates.updatedAt,
    });

  revalidatePath("/trames/mail");
  return {
    success: true,
    data: { ...created, createdByName: actor.fullName, updatedAt: created.updatedAt.toISOString() },
  };
}

export async function updateMailTemplate(
  id: string,
  data: TemplateData
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (!EDIT_ROLES.has(actor.role)) return { success: false, error: "Non autorisé" };

  await db
    .update(mailTemplates)
    .set({
      name: data.name.trim(),
      subject: data.subject.trim(),
      body: data.body,
      category: data.category?.trim() || null,
      audience: data.audience,
      updatedAt: new Date(),
    })
    .where(and(eq(mailTemplates.id, id), isNull(mailTemplates.deletedAt)));

  revalidatePath("/trames/mail");
  return { success: true };
}

export async function archiveMailTemplate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (!EDIT_ROLES.has(actor.role)) return { success: false, error: "Non autorisé" };

  await db
    .update(mailTemplates)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(mailTemplates.id, id), isNull(mailTemplates.deletedAt)));

  revalidatePath("/trames/mail");
  return { success: true };
}

export async function deleteMailTemplate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (actor.role !== "admin") return { success: false, error: "Réservé aux administrateurs" };

  const [tpl] = await db
    .select({ active: mailTemplates.active })
    .from(mailTemplates)
    .where(and(eq(mailTemplates.id, id), isNull(mailTemplates.deletedAt)));

  if (!tpl) return { success: false, error: "Trame introuvable" };
  if (tpl.active) return { success: false, error: "Archiver la trame avant de la supprimer" };

  await db.delete(mailTemplates).where(eq(mailTemplates.id, id));
  revalidatePath("/trames/mail");
  return { success: true };
}
