"use server";

import { db } from "@/db";
import { tasks, taskLinks, notifications, activityEvents, profiles } from "@/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser, checkPreviewGuard } from "@/lib/auth";
import { type AppRole } from "@/lib/permissions";

// Peuvent gérer n'importe quelle tâche ; sinon seulement créateur ou assigné.
const TASK_MANAGER_ROLES = new Set<AppRole>(["admin", "direction", "team_leader"]);

async function loadTaskOwnership(taskId: string) {
  return db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    columns: { createdBy: true, assignedTo: true },
  });
}

function canManageTask(
  task: { createdBy: string | null; assignedTo: string | null },
  actor: { id: string; role: string },
): boolean {
  return (
    task.createdBy === actor.id ||
    task.assignedTo === actor.id ||
    TASK_MANAGER_ROLES.has(actor.role as AppRole)
  );
}
import {
  loadTaskAttachments,
  loadTaskLinkInputs,
  parseTaskCategory,
  taskPathsForLinks,
  type TaskAttachment,
  type TaskCategory,
  type TaskLinkInput,
} from "@/lib/task-service";

type TaskInput = {
  title: string;
  category: TaskCategory;
  note: string;
  dueAt: string;
  assignedTo: string;
};

type TaskRow = {
  id: string;
  title: string;
  category: string;
  note: string | null;
  dueAt: string;
  completedAt: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  createdBy: string | null;
  attachments: TaskAttachment[];
};

async function notifyAssignee({
  assignedTo,
  assignerName,
  candidateId,
  title,
  dueAt,
}: {
  assignedTo: string;
  assignerName: string;
  candidateId: string;
  title: string;
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

  await db.insert(notifications).values({
    userId: assignedTo,
    type: "task_assigned",
    title: "Nouvelle tache assignee",
    body: `${assignerName} vous a assigne : "${title}" - avant le ${dueDateStr}`,
    candidateId,
  });
}

function revalidateLinks(links: TaskLinkInput[]) {
  revalidatePath("/taches");
  for (const path of taskPathsForLinks(links)) revalidatePath(path);
}

async function logForLinks(actorId: string, links: TaskLinkInput[], actionType: string, summary: string) {
  if (links.length === 0) return;
  await db.insert(activityEvents).values(
    links.map((link) => ({
      actorId,
      candidateId: link.entityType === "candidate" ? link.entityId : null,
      companyId: link.entityType === "company" ? link.entityId : null,
      actionType,
      summary,
    }))
  );
}

export async function loadCandidateTasks(candidateId: string): Promise<TaskRow[]> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      category: tasks.category,
      note: tasks.description,
      dueAt: tasks.dueAt,
      completedAt: tasks.completedAt,
      assignedTo: tasks.assignedTo,
      assigneeName: profiles.fullName,
      createdBy: tasks.createdBy,
    })
    .from(taskLinks)
    .innerJoin(tasks, eq(taskLinks.taskId, tasks.id))
    .leftJoin(profiles, eq(tasks.assignedTo, profiles.id))
    .where(and(
      eq(taskLinks.entityType, "candidate"),
      eq(taskLinks.entityId, candidateId),
      isNull(tasks.deletedAt)
    ))
    .orderBy(asc(tasks.dueAt));

  const attachmentsByTask = await loadTaskAttachments(rows.map((row) => row.id));

  return rows.map((row) => ({
    ...row,
    category: row.category as string,
    dueAt: row.dueAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    assigneeName: row.assigneeName ?? null,
    attachments: attachmentsByTask.get(row.id) ?? [],
  }));
}

export async function createTask(
  candidateId: string,
  candidateName: string,
  input: TaskInput
): Promise<{ success: boolean; data?: TaskRow; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifie" };
  const guard = await checkPreviewGuard();
  if (guard) return guard;

  const dueAt = new Date(input.dueAt + "T12:00:00Z");
  const link: TaskLinkInput = { entityType: "candidate", entityId: candidateId };

  const row = await db.transaction(async (tx) => {
    const [createdTask] = await tx.insert(tasks).values({
      title: input.title.trim(),
      description: input.note.trim() || null,
      category: parseTaskCategory(input.category),
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

    await tx.insert(taskLinks).values({
      taskId: createdTask.id,
      entityType: link.entityType,
      entityId: link.entityId,
    });

    await tx.insert(activityEvents).values({
      actorId: user.id,
      candidateId,
      actionType: "task.created",
      summary: `Tache creee par ${user.fullName} : "${input.title}"`,
    });

    return createdTask;
  });

  if (input.assignedTo && input.assignedTo !== user.id) {
    await notifyAssignee({
      assignedTo: input.assignedTo,
      assignerName: user.fullName,
      candidateId,
      title: input.title,
      dueAt,
    });
  }

  revalidateLinks([link]);

  return {
    success: true,
    data: {
      ...row,
      dueAt: row.dueAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      assigneeName: null,
      attachments: [{ ...link, label: candidateName, href: `/candidats/${candidateId}` }],
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
  if (!user) return { success: false, error: "Non authentifie" };
  const guard = await checkPreviewGuard();
  if (guard) return guard;

  const ownership = await loadTaskOwnership(taskId);
  if (!ownership) return { success: false, error: "Tâche introuvable" };
  if (!canManageTask(ownership, user)) {
    return { success: false, error: "Vous n'avez pas les droits sur cette tâche" };
  }

  const dueAt = new Date(input.dueAt + "T12:00:00Z");
  const links = await loadTaskLinkInputs(taskId);

  const [row] = await db.update(tasks).set({
    title: input.title.trim(),
    description: input.note.trim() || null,
    category: parseTaskCategory(input.category),
    dueAt,
    assignedTo: input.assignedTo || null,
    updatedAt: new Date(),
  }).where(eq(tasks.id, taskId))
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

  await logForLinks(user.id, links, "task.updated", `Tache modifiee par ${user.fullName} : "${input.title}"`);

  if (input.assignedTo && input.assignedTo !== previousAssignedTo && input.assignedTo !== user.id) {
    await notifyAssignee({
      assignedTo: input.assignedTo,
      assignerName: user.fullName,
      candidateId,
      title: input.title,
      dueAt,
    });
  }

  revalidateLinks(links);
  const attachmentsByTask = await loadTaskAttachments([taskId]);

  return {
    success: true,
    data: {
      ...row,
      dueAt: row.dueAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      assigneeName: null,
      attachments: attachmentsByTask.get(taskId) ?? [{ entityType: "candidate", entityId: candidateId, label: candidateName, href: `/candidats/${candidateId}` }],
    },
  };
}

export async function toggleTask(
  taskId: string,
  candidateId: string,
  currentlyDone: boolean
): Promise<{ success: boolean; data?: Pick<TaskRow, "completedAt">; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifie" };
  const guard = await checkPreviewGuard();
  if (guard) return guard;

  const ownership = await loadTaskOwnership(taskId);
  if (!ownership) return { success: false, error: "Tâche introuvable" };
  if (!canManageTask(ownership, user)) {
    return { success: false, error: "Vous n'avez pas les droits sur cette tâche" };
  }

  const now = new Date();
  const links = await loadTaskLinkInputs(taskId);

  const [row] = await db.update(tasks).set({
    completedAt: currentlyDone ? null : now,
    completedBy: currentlyDone ? null : user.id,
    updatedAt: now,
  }).where(eq(tasks.id, taskId))
    .returning({ completedAt: tasks.completedAt, title: tasks.title });

  await logForLinks(
    user.id,
    links,
    currentlyDone ? "task.reopened" : "task.completed",
    currentlyDone ? `Tache rouverte : ${row.title}` : `Tache terminee : ${row.title}`
  );

  revalidateLinks(links.length > 0 ? links : [{ entityType: "candidate", entityId: candidateId }]);

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
  if (!user) return { success: false, error: "Non authentifie" };
  const guard = await checkPreviewGuard();
  if (guard) return guard;

  const ownership = await loadTaskOwnership(taskId);
  if (!ownership) return { success: false, error: "Tâche introuvable" };
  if (!canManageTask(ownership, user)) {
    return { success: false, error: "Vous n'avez pas les droits sur cette tâche" };
  }

  const links = await loadTaskLinkInputs(taskId);

  await db.update(tasks).set({
    deletedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(tasks.id, taskId));

  await logForLinks(user.id, links, "task.deleted", `Tache supprimee par ${user.fullName} : "${taskTitle}"`);

  revalidateLinks(links.length > 0 ? links : [{ entityType: "candidate", entityId: candidateId }]);
  return { success: true };
}

export async function markNotificationsRead(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await db.update(notifications).set({ readAt: new Date() }).where(
    and(eq(notifications.userId, user.id), isNull(notifications.readAt))
  );
}
