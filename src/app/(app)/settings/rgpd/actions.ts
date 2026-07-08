"use server";

import { requireRole } from "@/lib/auth";
import { db } from "@/db";
import { appSettings, candidates, companies, companyContacts, documents, taskLinks } from "@/db/schema";
import { eq, isNotNull, lt, sql } from "drizzle-orm";
import { createStorageClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ─── Config keys ─────────────────────────────────────────────────────────────

const KEY_CANDIDATES = "rgpd_retention_candidates_days";
const KEY_COMPANIES  = "rgpd_retention_companies_days";

export const RETENTION_OPTIONS = [
  { label: "6 mois",  days: 180  },
  { label: "1 an",    days: 365  },
  { label: "2 ans",   days: 730  },
  { label: "3 ans",   days: 1095 },
  { label: "5 ans",   days: 1825 },
] as const;

export type RetentionConfig = {
  candidatesDays: number;
  companiesDays:  number;
};

export type PurgeCounts = {
  candidatesDue: number;
  companiesDue:  number;
};

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

  const [cRows, coRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` })
      .from(candidates)
      .where(isNotNull(candidates.deletedAt)),
    db.select({ count: sql<number>`count(*)::int` })
      .from(companies)
      .where(isNotNull(companies.deletedAt)),
  ]);

  // Filter in JS since drizzle doesn't support lt on nullable timestamps easily
  const [allCandidates, allCompanies] = await Promise.all([
    db.select({ deletedAt: candidates.deletedAt }).from(candidates).where(isNotNull(candidates.deletedAt)),
    db.select({ deletedAt: companies.deletedAt  }).from(companies ).where(isNotNull(companies.deletedAt )),
  ]);

  return {
    candidatesDue: allCandidates.filter(r => r.deletedAt! < cutoffCandidates).length,
    companiesDue:  allCompanies .filter(r => r.deletedAt! < cutoffCompanies ).length,
  };
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

export async function triggerPurge(): Promise<{ purgedCandidates: number; purgedCompanies: number }> {
  await requireRole("admin");
  return runPurge();
}

export async function runPurge(): Promise<{ purgedCandidates: number; purgedCompanies: number }> {
  const [candidatesDays, companiesDays] = await Promise.all([
    getRetentionDays(KEY_CANDIDATES, 730),
    getRetentionDays(KEY_COMPANIES,  1825),
  ]);

  const cutoffCandidates = new Date(Date.now() - candidatesDays * 86400_000);
  const cutoffCompanies  = new Date(Date.now() - companiesDays  * 86400_000);
  const supabase = await createStorageClient();

  // ── Candidates ─────────────────────────────────────────────────────────────
  const expiredCandidates = await db
    .select({ id: candidates.id })
    .from(candidates)
    .where(isNotNull(candidates.deletedAt));
  const toDeleteCandidates = expiredCandidates.filter(async () => true); // filtered below
  const candidatesDue = (await db
    .select({ id: candidates.id, deletedAt: candidates.deletedAt })
    .from(candidates)
    .where(isNotNull(candidates.deletedAt)))
    .filter(r => r.deletedAt! < cutoffCandidates);

  let purgedCandidates = 0;
  for (const { id } of candidatesDue) {
    // Delete storage files
    const docs = await db
      .select({ storagePath: documents.storagePath })
      .from(documents)
      .where(eq(documents.candidateId, id));
    if (docs.length > 0) {
      await supabase.storage.from("documents").remove(docs.map(d => d.storagePath));
    }
    // Hard delete (taskLinks first due to FK)
    await db.delete(taskLinks).where(eq(taskLinks.entityId, id));
    await db.delete(candidates).where(eq(candidates.id, id));
    purgedCandidates++;
  }

  // ── Companies ──────────────────────────────────────────────────────────────
  const companiesDue = (await db
    .select({ id: companies.id, deletedAt: companies.deletedAt })
    .from(companies)
    .where(isNotNull(companies.deletedAt)))
    .filter(r => r.deletedAt! < cutoffCompanies);

  let purgedCompanies = 0;
  for (const { id } of companiesDue) {
    await db.delete(companyContacts).where(eq(companyContacts.companyId, id));
    await db.delete(companies).where(eq(companies.id, id));
    purgedCompanies++;
  }

  return { purgedCandidates, purgedCompanies };
}
