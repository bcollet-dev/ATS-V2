"use server";

import { db } from "@/db";
import { tasks, notifications, activityEvents, profiles } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
// email digest envoyé une fois par jour via /api/cron/digest — pas d'email instantané

export type TaskCategory = "call" | "email" | "document" | "follow_up" | "interview" | "other";

export type TaskInput = {
  title: string;
  category: TaskCategory;
  note: string;
  dueAt: string; // YYYY-MM-DD
  assignedTo: string;
};

export type TaskRow = {
  id: string;
  title: string;
  category: string;
  note: string | null;
  dueAt: string; // ISO string
  completedAt: string | null; // ISO string or null
  assignedTo: string | null;
  assigneeName: string | null;
  createdBy: string | null;
};

async function notifyAssignee({
  assignedTo,
  assignerName,
  candidateId,
  candidateName,
  title,
  category,
  dueAt,
}: {
  assignedTo: string;
  assignerName: string;
  candidateId: string;
  candidateName: string;
  title: string;
  category: string;
  dueAt: Date;
}) {
  const assignee = await db.query.profiles.findFirst({
    where: eq(profiles.id, assignedTo),
    columns: { email: true, fullName: true },
  });
  if (!assignee) return;

  const dueDateStr = dueAt.toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });

  await Promise.all([
    db.insert(notifications).values({
      userId: assignedTo,
      type: "task_assigned",
      title: "Nouvelle tâche assignée",
      body: `${assignerName} vous a assigné : "${title}" — avant le ${dueDateStr}`,
      candidateId,
    }),
    Promise.resolve(), // email géré par le digest quotidien
  ]);
}

export async function createTask(
  candidateId: string,
  candidateName: string,
  input: TaskInput
): Promise<{ success: boolean; data?: TaskRow; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const dueAt = new Date(input.dueAt + "T12:00:00Z");

  const [row] = await db.insert(tasks).values({
    candidateId,
    title: input.title.trim(),
    description: input.note.trim() || null,
    category: input.category,
    dueAt,
    assignedTo: input.assignedTo || null,
    createdBy: user.id,
  }).returning({
    id: tasks.id,
    title: tasks.title,
    category: tasks.category,
    note: tasks.description,
    dueAt: tasks.dueAt,
    completedAt: tasks.completedAt,
    assignedTo: tasks.assignedTo,
    createdBy: tasks.createdBy,
  });

  await db.insert(activityEvents).values({
    actorId: user.id,
    candidateId,
    actionType: "task.created",
    summary: `Tâche créée par ${user.fullName} : "${input.title}"`,
  });

  if (input.assignedTo && input.assignedTo !== user.id) {
    await notifyAssignee({
      assignedTo: input.assignedTo,
      assignerName: user.fullName,
      candidateId,
      candidateName,
      title: input.title,
      category: input.category,
      dueAt,
    });
  }

  revalidatePath(`/candidats/${candidateId}`);

  return {
    success: true,
    data: {
      ...row,
      dueAt: row.dueAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      assigneeName: null,
    },
  };
}

export async function updateTask(
  taskId: string,
  candidateId: string,
  candidateName: string,
  input: TaskInput,
  previousAssignedTo: string | null
): Promise<{ success: boolean; data?: TaskRow; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const dueAt = new Date(input.dueAt + "T12:00:00Z");

  const [row] = await db.update(tasks).set({
    title: input.title.trim(),
    description: input.note.trim() || null,
    category: input.category,
    dueAt,
    assignedTo: input.assignedTo || null,
    updatedAt: new Date(),
  }).where(and(eq(tasks.id, taskId), eq(tasks.candidateId, candidateId)))
    .returning({
      id: tasks.id,
      title: tasks.title,
      category: tasks.category,
      note: tasks.description,
      dueAt: tasks.dueAt,
      completedAt: tasks.completedAt,
      assignedTo: tasks.assignedTo,
      createdBy: tasks.createdBy,
    });

  await db.insert(activityEvents).values({
    actorId: user.id,
    candidateId,
    actionType: "task.updated",
    summary: `Tâche modifiée par ${user.fullName} : "${input.title}"`,
  });

  if (input.assignedTo && input.assignedTo !== previousAssignedTo && input.assignedTo !== user.id) {
    await notifyAssignee({
      assignedTo: input.assignedTo,
      assignerName: user.fullName,
      candidateId,
      candidateName,
      title: input.title,
      category: input.category,
      dueAt,
    });
  }

  revalidatePath(`/candidats/${candidateId}`);

  return {
    success: true,
    data: {
      ...row,
      dueAt: row.dueAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      assigneeName: null,
    },
  };
}

export async function toggleTask(
  taskId: string,
  candidateId: string,
  currentlyDone: boolean
): Promise<{ success: boolean; data?: Pick<TaskRow, "completedAt">; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const now = new Date();

  const [row] = await db.update(tasks).set({
    completedAt: currentlyDone ? null : now,
    completedBy: currentlyDone ? null : user.id,
    updatedAt: now,
  }).where(and(eq(tasks.id, taskId), eq(tasks.candidateId, candidateId)))
    .returning({ completedAt: tasks.completedAt });

  revalidatePath(`/candidats/${candidateId}`);

  return {
    success: true,
    data: { completedAt: row.completedAt?.toISOString() ?? null },
  };
}

export async function deleteTask(
  taskId: string,
  candidateId: string,
  taskTitle: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  await db.update(tasks).set({
    deletedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(eq(tasks.id, taskId), eq(tasks.candidateId, candidateId)));

  await db.insert(activityEvents).values({
    actorId: user.id,
    candidateId,
    actionType: "task.deleted",
    summary: `Tâche supprimée par ${user.fullName} : "${taskTitle}"`,
  });

  revalidatePath(`/candidats/${candidateId}`);
  return { success: true };
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await db.update(notifications).set({ readAt: new Date() }).where(
    and(eq(notifications.userId, userId), isNull(notifications.readAt))
  );
}
