"use server";

import { db } from "@/db";
import { cursus, classes } from "@/db/schema";
import { eq, isNull, isNotNull, asc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchYpareoCatalog } from "@/lib/ypareo/client";
import { createCursusSchema, type CreateCursusInput } from "./schemas";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CursusRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  createdAt: Date;
};

export type ClassRow = {
  id: string;
  name: string;
  code: string | null;
  site: string | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  slackWebhookUrl: string | null;
};

export type SyncedCursusRow = {
  id: string;
  externalId: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  syncedAt: string;
  classes: ClassRow[];
};

// ─── Loaders ──────────────────────────────────────────────────────────────────

export async function getCursus(): Promise<CursusRow[]> {
  return db
    .select({
      id: cursus.id,
      name: cursus.name,
      code: cursus.code,
      description: cursus.description,
      active: cursus.active,
      createdAt: cursus.createdAt,
    })
    .from(cursus)
    .where(isNull(cursus.syncedAt))
    .orderBy(asc(cursus.name));
}

export async function getSyncedCursusWithClasses(): Promise<SyncedCursusRow[]> {
  const cursusRows = await db
    .select({
      id: cursus.id,
      externalId: cursus.externalId,
      name: cursus.name,
      code: cursus.code,
      description: cursus.description,
      active: cursus.active,
      syncedAt: cursus.syncedAt,
    })
    .from(cursus)
    .where(isNotNull(cursus.syncedAt))
    .orderBy(asc(cursus.name));

  if (cursusRows.length === 0) return [];

  const cursusIds = cursusRows.map((r) => r.id);
  const classRows = await db
    .select({
      id: classes.id,
      cursusId: classes.cursusId,
      name: classes.name,
      code: classes.code,
      site: classes.site,
      startDate: classes.startDate,
      endDate: classes.endDate,
      active: classes.active,
      slackWebhookUrl: classes.slackWebhookUrl,
    })
    .from(classes)
    .where(inArray(classes.cursusId, cursusIds))
    .orderBy(asc(classes.name));

  const classesMap = new Map<string, ClassRow[]>();
  for (const cls of classRows) {
    const list = classesMap.get(cls.cursusId) ?? [];
    list.push({
      id: cls.id,
      name: cls.name,
      code: cls.code,
      site: cls.site,
      startDate: cls.startDate,
      endDate: cls.endDate,
      active: cls.active,
      slackWebhookUrl: cls.slackWebhookUrl,
    });
    classesMap.set(cls.cursusId, list);
  }

  return cursusRows.map((c) => ({
    id: c.id,
    externalId: c.externalId!,
    name: c.name,
    code: c.code,
    description: c.description,
    active: c.active,
    syncedAt: c.syncedAt!.toISOString(),
    classes: classesMap.get(c.id) ?? [],
  }));
}

export async function getActiveCursus(): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: cursus.id, name: cursus.name })
    .from(cursus)
    .where(eq(cursus.active, true))
    .orderBy(asc(cursus.name));
}

// ─── Sync Ypareo catalogue ────────────────────────────────────────────────────

export async function syncYpareoCatalog(): Promise<{
  success: boolean;
  error?: string;
  cursusCount?: number;
  classesCount?: number;
  syncedAt?: string;
  syncedCursus?: SyncedCursusRow[];
}> {
  await requireAuth();

  let catalog;
  try {
    catalog = await fetchYpareoCatalog();
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur Ypareo" };
  }

  const { cursus: ypCursus, classes: ypClasses } = catalog;
  const now = new Date();

  // Upsert cursus
  for (const yc of ypCursus) {
    await db
      .insert(cursus)
      .values({
        externalId: yc.externalId,
        code: yc.code,
        name: yc.name,
        description: yc.description,
        active: yc.active,
        rawData: yc.raw,
        syncedAt: now,
      })
      .onConflictDoUpdate({
        target: cursus.externalId,
        set: {
          code: yc.code,
          name: yc.name,
          description: yc.description,
          active: yc.active,
          rawData: yc.raw,
          syncedAt: now,
          updatedAt: now,
        },
      });
  }

  // Build externalId → DB id map
  const cursusRows = await db
    .select({ id: cursus.id, externalId: cursus.externalId })
    .from(cursus)
    .where(isNotNull(cursus.externalId));
  const cursusMap = new Map(cursusRows.map((r) => [r.externalId, r.id]));

  // Upsert classes
  let classesCount = 0;
  for (const yc of ypClasses) {
    const cursusId = cursusMap.get(yc.productExternalId);
    if (!cursusId) continue;

    await db
      .insert(classes)
      .values({
        cursusId,
        externalId: yc.externalId,
        code: yc.code,
        name: yc.name,
        site: yc.site,
        startDate: yc.startDate,
        endDate: yc.endDate,
        active: yc.active,
        rawData: yc.raw,
        syncedAt: now,
      })
      .onConflictDoUpdate({
        target: classes.externalId,
        set: {
          cursusId,
          code: yc.code,
          name: yc.name,
          site: yc.site,
          startDate: yc.startDate,
          endDate: yc.endDate,
          active: yc.active,
          rawData: yc.raw,
          syncedAt: now,
          updatedAt: now,
        },
      });
    classesCount++;
  }

  revalidatePath("/cursus");
  return {
    success: true,
    cursusCount: ypCursus.length,
    classesCount,
    syncedAt: now.toISOString(),
    syncedCursus: await getSyncedCursusWithClasses(),
  };
}

// ─── Manual cursus CRUD ───────────────────────────────────────────────────────

type ActionResult =
  | { success: true; data: CursusRow }
  | { success: false; error: string };

type DeleteCursusResult =
  | { success: true }
  | { success: false; error: string };

export async function createCursus(input: CreateCursusInput): Promise<ActionResult> {
  const parsed = createCursusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides" };

  const { name, code, description } = parsed.data;

  const [created] = await db
    .insert(cursus)
    .values({
      name,
      code: code || null,
      description: description || null,
    })
    .returning({
      id: cursus.id,
      name: cursus.name,
      code: cursus.code,
      description: cursus.description,
      active: cursus.active,
      createdAt: cursus.createdAt,
    });

  revalidatePath("/cursus");
  return { success: true, data: created };
}

export async function toggleCursusActive(id: string, active: boolean): Promise<void> {
  await db.update(cursus).set({ active }).where(eq(cursus.id, id));
  revalidatePath("/cursus");
}

export async function deleteCursus(id: string): Promise<DeleteCursusResult> {
  await requireAuth();

  try {
    const deleted = await db
      .delete(cursus)
      .where(eq(cursus.id, id))
      .returning({ id: cursus.id });

    if (deleted.length === 0) {
      return { success: false, error: "Cursus introuvable" };
    }

    revalidatePath("/cursus");
    revalidatePath("/besoins");
    revalidatePath("/matching");
    return { success: true };
  } catch {
    return { success: false, error: "Suppression impossible pour ce cursus" };
  }
}

// ─── Slack webhook per class ──────────────────────────────────────────────────

export async function updateClassSlackWebhook(
  classId: string,
  webhookUrl: string,
): Promise<{ success: true } | { success: false; error: string }> {
  await requireAuth();

  const url = webhookUrl.trim() || null;
  if (url && !url.startsWith("https://hooks.slack.com/")) {
    return { success: false, error: "URL Slack invalide (doit commencer par https://hooks.slack.com/)" };
  }

  await db
    .update(classes)
    .set({ slackWebhookUrl: url, updatedAt: new Date() })
    .where(eq(classes.id, classId));

  revalidatePath("/cursus");
  return { success: true };
}

export async function testClassSlackWebhook(
  classId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  await requireAuth();

  const [cls] = await db
    .select({ name: classes.name, slackWebhookUrl: classes.slackWebhookUrl })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  if (!cls) return { success: false, error: "Classe introuvable" };
  if (!cls.slackWebhookUrl) return { success: false, error: "Aucun webhook configuré pour cette classe" };

  const { sendSlackNotification, buildTestBlocks } = await import("@/lib/slack");
  const result = await sendSlackNotification(cls.slackWebhookUrl, buildTestBlocks(cls.name));
  if (!result.ok) return { success: false, error: result.error };
  return { success: true };
}
