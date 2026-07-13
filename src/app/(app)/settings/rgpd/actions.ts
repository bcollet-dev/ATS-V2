"use server";

import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { appSettings, candidates, companies, companyContacts, documents, taskLinks, needs, tasks, ypareoLogs } from "@/db/schema";
import { eq, and, lt, inArray, isNotNull, count } from "drizzle-orm";
import { createStorageClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { RetentionConfig, PurgeCounts } from "./constants";

// ─── Config keys ─────────────────────────────────────────────────────────────

const KEY_CANDIDATES = "rgpd_retention_candidates_days";
const KEY_COMPANIES  = "rgpd_retention_companies_days";

// ─── Readers ─────────────────────────────────────────────────────────────────

async function getRetentionDays(key: string, defaultDays: number): Promise<number> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  const v = row?.value;
  return typeof v === "number" && v > 0 ? v : defaultDays;
}

export async function getRetentionConfig(): Promise<RetentionConfig> {
  await requireRole("admin");
  const [candidatesDays, companiesDays] = await Promise.all([
    getRetentionDays(KEY_CANDIDATES, 730),
    getRetentionDays(KEY_COMPANIES,  1825),
  ]);
  return { candidatesDays, companiesDays };
}

export async function getPurgeCounts(config: RetentionConfig): Promise<PurgeCounts> {
  await requireRole("admin");

  const cutoffCandidates = new Date(Date.now() - config.candidatesDays * 86400_000);
  const cutoffCompanies  = new Date(Date.now() - config.companiesDays  * 86400_000);

  const [[cand], [comp]] = await Promise.all([
    db.select({ n: count() }).from(candidates)
      .where(and(isNotNull(candidates.deletedAt), lt(candidates.deletedAt, cutoffCandidates))),
    db.select({ n: count() }).from(companies)
      .where(and(isNotNull(companies.deletedAt), lt(companies.deletedAt, cutoffCompanies))),
  ]);

  return { candidatesDue: cand.n, companiesDue: comp.n };
}

// ─── Updaters ────────────────────────────────────────────────────────────────

async function upsertSetting(key: string, days: number) {
  await db
    .insert(appSettings)
    .values({ key, value: days })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: days } });
}

export async function updateRetentionConfig(config: RetentionConfig): Promise<void> {
  await requireRole("admin");
  await Promise.all([
    upsertSetting(KEY_CANDIDATES, config.candidatesDays),
    upsertSetting(KEY_COMPANIES,  config.companiesDays),
  ]);
  revalidatePath("/settings/rgpd");
}

// ─── Purge ───────────────────────────────────────────────────────────────────

export type PurgeResult = { purgedCandidates: number; purgedCompanies: number; failed: number };

export async function triggerPurge(): Promise<PurgeResult> {
  await requireRole("admin");
  return runPurge();
}

/**
 * Supprime le contenu Storage puis renvoie true si l'effacement a réussi.
 * En cas d'échec on renvoie false pour NE PAS supprimer les métadonnées : le
 * candidat/l'entreprise sera retenté au prochain passage (sinon les fichiers
 * sensibles — CV, CNI, carte vitale — resteraient orphelins dans le Storage).
 */
async function removeStorageObjects(
  supabase: Awaited<ReturnType<typeof createStorageClient>>,
  paths: string[],
): Promise<boolean> {
  if (paths.length === 0) return true;
  const { error } = await supabase.storage.from("documents").remove(paths);
  if (error) {
    console.error("[rgpd-purge] échec suppression Storage:", error.message);
    return false;
  }
  return true;
}

export async function runPurge(): Promise<PurgeResult> {
  const [candidatesDays, companiesDays] = await Promise.all([
    getRetentionDays(KEY_CANDIDATES, 730),
    getRetentionDays(KEY_COMPANIES,  1825),
  ]);

  const cutoffCandidates = new Date(Date.now() - candidatesDays * 86400_000);
  const cutoffCompanies  = new Date(Date.now() - companiesDays  * 86400_000);
  const supabase = await createStorageClient();

  let purgedCandidates = 0;
  let purgedCompanies = 0;
  let failed = 0;

  // ── Candidates ─────────────────────────────────────────────────────────────
  const candidatesDue = await db
    .select({ id: candidates.id })
    .from(candidates)
    .where(and(isNotNull(candidates.deletedAt), lt(candidates.deletedAt, cutoffCandidates)));

  for (const { id } of candidatesDue) {
    try {
      const docs = await db
        .select({ storagePath: documents.storagePath })
        .from(documents)
        .where(eq(documents.candidateId, id));
      // R2 : ne pas effacer la fiche si les fichiers n'ont pas pu être supprimés.
      if (!(await removeStorageObjects(supabase, docs.map(d => d.storagePath)))) {
        failed++;
        continue;
      }
      // R4 : effacer les données personnelles résiduelles non couvertes par le cascade.
      await db.delete(ypareoLogs).where(eq(ypareoLogs.candidateId, id));
      await purgeOrphanTasks("candidate", id);
      await db.delete(candidates).where(eq(candidates.id, id));
      purgedCandidates++;
    } catch (err) {
      failed++;
      console.error(`[rgpd-purge] échec purge candidat ${id}:`, err);
    }
  }

  // ── Companies ──────────────────────────────────────────────────────────────
  const companiesDue = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(isNotNull(companies.deletedAt), lt(companies.deletedAt, cutoffCompanies)));

  for (const { id } of companiesDue) {
    try {
      const needRows = await db.select({ id: needs.id }).from(needs).where(eq(needs.companyId, id));
      const needIds = needRows.map(r => r.id);

      // Fichiers Storage de l'entreprise + de ses besoins (documents en cascade DB
      // mais fichiers Storage à retirer explicitement).
      const companyDocs = await db
        .select({ storagePath: documents.storagePath })
        .from(documents)
        .where(eq(documents.companyId, id));
      const needDocs = needIds.length
        ? await db.select({ storagePath: documents.storagePath }).from(documents).where(inArray(documents.needId, needIds))
        : [];
      if (!(await removeStorageObjects(supabase, [...companyDocs, ...needDocs].map(d => d.storagePath)))) {
        failed++;
        continue;
      }

      // R4 : résidus personnels.
      await db.delete(ypareoLogs).where(eq(ypareoLogs.companyId, id));
      await purgeOrphanTasks("company", id);

      // R1 : supprimer d'abord les besoins (needs.company_id est ON DELETE RESTRICT ;
      // leurs dépendances sont en cascade), puis les contacts, puis l'entreprise.
      if (needIds.length) await db.delete(needs).where(inArray(needs.id, needIds));
      await db.delete(companyContacts).where(eq(companyContacts.companyId, id));
      await db.delete(companies).where(eq(companies.id, id));
      purgedCompanies++;
    } catch (err) {
      failed++;
      console.error(`[rgpd-purge] échec purge entreprise ${id}:`, err);
    }
  }

  return { purgedCandidates, purgedCompanies, failed };
}

/**
 * Supprime les tâches rattachées à une entité via task_links (et non via
 * tasks.candidate_id/company_id, donc non couvertes par le cascade) — leur titre
 * contient souvent le nom de la personne. Supprime aussi les liens résiduels.
 */
async function purgeOrphanTasks(entityType: "candidate" | "company", entityId: string): Promise<void> {
  const linked = await db
    .select({ taskId: taskLinks.taskId })
    .from(taskLinks)
    .where(and(eq(taskLinks.entityType, entityType), eq(taskLinks.entityId, entityId)));
  const taskIds = [...new Set(linked.map(r => r.taskId))];
  if (taskIds.length > 0) {
    await db.delete(tasks).where(inArray(tasks.id, taskIds));
  }
  await db.delete(taskLinks).where(eq(taskLinks.entityId, entityId));
}
