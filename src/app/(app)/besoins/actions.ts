"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { needs, companies, cursus, profiles, tasks } from "@/db/schema";
import { eq, isNull, and, asc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type NeedRow = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  targetCursusId: string | null;
  targetCursusName: string | null;
  city: string | null;
  positionsCount: number;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  nextTaskAt: string | null;
  updatedAt: string;
  isInactive: boolean;
  nextTaskOverdue: boolean;
};

export async function loadPipelineNeeds(): Promise<NeedRow[]> {
  await requireAuth();

  const rows = await db
    .select({
      id: needs.id,
      title: needs.title,
      companyId: needs.companyId,
      companyName: companies.name,
      targetCursusId: needs.targetCursusId,
      targetCursusName: cursus.name,
      city: needs.city,
      positionsCount: needs.positionsCount,
      status: needs.status,
      ownerId: needs.ownerId,
      ownerName: profiles.fullName,
      updatedAt: needs.updatedAt,
    })
    .from(needs)
    .leftJoin(companies, eq(needs.companyId, companies.id))
    .leftJoin(cursus, eq(needs.targetCursusId, cursus.id))
    .leftJoin(profiles, eq(needs.ownerId, profiles.id))
    .where(isNull(needs.deletedAt))
    .orderBy(asc(needs.title));

  if (rows.length === 0) return [];

  const needIds = rows.map((r) => r.id);

  const nextTaskRows = await db
    .select({ needId: tasks.needId, dueAt: tasks.dueAt })
    .from(tasks)
    .where(
      and(
        inArray(tasks.needId, needIds),
        isNull(tasks.completedAt),
        isNull(tasks.deletedAt),
      )
    )
    .orderBy(asc(tasks.dueAt));

  const nextTaskMap = new Map<string, string>();
  for (const t of nextTaskRows) {
    if (t.needId && !nextTaskMap.has(t.needId)) {
      nextTaskMap.set(t.needId, t.dueAt.toISOString());
    }
  }

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  return rows.map((r) => {
    const nextTaskAt = nextTaskMap.get(r.id) ?? null;
    const updatedAt = r.updatedAt.toISOString();
    const inactive =
      r.updatedAt < twoDaysAgo &&
      (!nextTaskAt || new Date(nextTaskAt) < new Date());
    return {
      id: r.id,
      title: r.title,
      companyId: r.companyId,
      companyName: r.companyName ?? "—",
      targetCursusId: r.targetCursusId ?? null,
      targetCursusName: r.targetCursusName ?? null,
      city: r.city ?? null,
      positionsCount: r.positionsCount,
      status: r.status,
      ownerId: r.ownerId ?? null,
      ownerName: r.ownerName ?? null,
      nextTaskAt,
      updatedAt,
      isInactive: inactive,
      nextTaskOverdue: !!nextTaskAt && new Date(nextTaskAt) < new Date(),
    };
  });
}

export async function updateNeedStatus(id: string, status: string, lostReason?: string) {
  await requireAuth();
  await db
    .update(needs)
    .set({
      status: status as never,
      updatedAt: new Date(),
      ...(lostReason !== undefined ? { lostReason } : {}),
    })
    .where(eq(needs.id, id));
  revalidatePath("/besoins");
}

export async function updateNeedTitle(id: string, title: string) {
  await requireAuth();
  if (!title.trim()) return;
  await db
    .update(needs)
    .set({ title: title.trim(), updatedAt: new Date() })
    .where(eq(needs.id, id));
  revalidatePath("/besoins");
}

export async function updateNeedCursus(id: string, targetCursusId: string | null) {
  await requireAuth();
  await db
    .update(needs)
    .set({ targetCursusId: targetCursusId || null, updatedAt: new Date() })
    .where(eq(needs.id, id));
  revalidatePath("/besoins");
}

export async function updateNeedOwner(id: string, ownerId: string | null) {
  await requireAuth();
  await db
    .update(needs)
    .set({ ownerId: ownerId || null, updatedAt: new Date() })
    .where(eq(needs.id, id));
  revalidatePath("/besoins");
}

export async function updateNeedCity(id: string, city: string | null) {
  await requireAuth();
  await db
    .update(needs)
    .set({ city: city?.trim() || null, updatedAt: new Date() })
    .where(eq(needs.id, id));
  revalidatePath("/besoins");
}
