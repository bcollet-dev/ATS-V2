"use server";

import { db } from "@/db";
import { tasks, profiles } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { logActivityEvent } from "@/lib/activity";
import { revalidatePath } from "next/cache";

export type TaskRow = {
  id: string;
  title: string;
  category: string;
  dueAt: string;
  completedAt: string | null;
  assignedName: string | null;
};

export async function loadNeedTasks(needId: string): Promise<TaskRow[]> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      category: tasks.category,
      dueAt: tasks.dueAt,
      completedAt: tasks.completedAt,
      assignedName: profiles.fullName,
    })
    .from(tasks)
    .leftJoin(profiles, eq(tasks.assignedTo, profiles.id))
    .where(and(eq(tasks.needId, needId), isNull(tasks.deletedAt)));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    dueAt: r.dueAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
    assignedName: r.assignedName ?? null,
  }));
}

const VALID_CATEGORIES = [
  "call",
  "email",
  "document",
  "follow_up",
  "interview",
  "other",
  "video_interview",
  "onsite_interview",
  "administrative",
] as const;
type TaskCategory = (typeof VALID_CATEGORIES)[number];

function parseCategory(value: string): TaskCategory {
  if ((VALID_CATEGORIES as readonly string[]).includes(value)) {
    return value as TaskCategory;
  }
  return "follow_up";
}

export async function createNeedTask(
  needId: string,
  fields: {
    title: string;
    category: string;
    assignedTo?: string;
    dueAt: string;
    description?: string;
  }
): Promise<void> {
  const actor = await requireAuth();

  await db.insert(tasks).values({
    needId,
    title: fields.title,
    category: parseCategory(fields.category),
    assignedTo: fields.assignedTo || null,
    dueAt: new Date(fields.dueAt),
    description: fields.description || null,
    createdBy: actor.id,
  });

  await logActivityEvent({
    needId,
    actorId: actor.id,
    actionType: "task_created",
    summary: `Tâche créée : ${fields.title}`,
  });

  revalidatePath(`/besoins/${needId}`);
}

export async function completeNeedTask(taskId: string, needId: string): Promise<void> {
  const actor = await requireAuth();

  await db
    .update(tasks)
    .set({
      completedAt: new Date(),
      completedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId));

  await logActivityEvent({
    needId,
    actorId: actor.id,
    actionType: "task_completed",
    summary: "Tâche complétée",
  });

  revalidatePath(`/besoins/${needId}`);
}
