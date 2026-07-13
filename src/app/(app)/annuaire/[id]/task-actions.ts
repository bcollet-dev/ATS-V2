"use server";

import { requireAuth, checkPreviewGuard } from "@/lib/auth";
import { db } from "@/db";
import { tasks, taskLinks, activityEvents, notifications } from "@/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
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

type CompanyTaskRow = {
  id: string;
  title: string;
  category: string;
  note: string | null;
  dueAt: string;
  completedAt: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  attachments: TaskAttachment[];
};

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

export async function loadCompanyTasks(companyId: string): Promise<CompanyTaskRow[]> {
  await requireAuth();
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      category: tasks.category,
      note: tasks.description,
      dueAt: tasks.dueAt,
      completedAt: tasks.completedAt,
      assignedTo: tasks.assignedTo,
    })
    .from(taskLinks)
    .innerJoin(tasks, eq(taskLinks.taskId, tasks.id))
    .where(and(
      eq(taskLinks.entityType, "company"),
      eq(taskLinks.entityId, companyId),
      isNull(tasks.deletedAt)
    ))
    .orderBy(asc(tasks.dueAt));

  const attachmentsByTask = await loadTaskAttachments(rows.map((row) => row.id));

  return rows.map((row) => ({
    ...row,
    dueAt: row.dueAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    assigneeName: null,
    attachments: attachmentsByTask.get(row.id) ?? [],
  }));
}

export async function createCompanyTask(
  companyId: string,
  companyName: string,
  input: TaskInput
): Promise<{ success: boolean; data?: CompanyTaskRow; error?: string }> {
  const actor = await requireAuth();
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return previewGuard;
  const dueAt = new Date(input.dueAt + "T12:00:00Z");
  const link: TaskLinkInput = { entityType: "company", entityId: companyId };

  const row = await db.transaction(async (tx) => {
    const [createdTask] = await tx
      .insert(tasks)
      .values({
        title: input.title.trim(),
        description: input.note.trim() || null,
        category: parseTaskCategory(input.category),
        dueAt,
        assignedTo: input.assignedTo || null,
        createdBy: actor.id,
      })
      .returning({
        id: tasks.id,
        title: tasks.title,
        category: tasks.category,
        note: tasks.description,
        dueAt: tasks.dueAt,
        completedAt: tasks.completedAt,
        assignedTo: tasks.assignedTo,
      });

    await tx.insert(taskLinks).values({
      taskId: createdTask.id,
      entityType: link.entityType,
      entityId: link.entityId,
    });

    await tx.insert(activityEvents).values({
      actorId: actor.id,
      companyId,
      actionType: "task.created",
      summary: `Tache creee par ${actor.fullName} : "${input.title}"`,
    });

    return createdTask;
  });

  if (input.assignedTo && input.assignedTo !== actor.id) {
    await db.insert(notifications).values({
      userId: input.assignedTo,
      type: "task_assigned",
      title: "Nouvelle tache assignee",
      body: `${actor.fullName} vous a assigne : ${input.title}`,
      companyId,
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
      attachments: [{ ...link, label: companyName, href: `/annuaire/${companyId}` }],
    },
  };
}

export async function updateCompanyTask(
  taskId: string,
  companyId: string,
  input: TaskInput
): Promise<{ success: boolean; data?: CompanyTaskRow; error?: string }> {
  const actor = await requireAuth();
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return previewGuard;
  const dueAt = new Date(input.dueAt + "T12:00:00Z");
  const links = await loadTaskLinkInputs(taskId);

  const [row] = await db
    .update(tasks)
    .set({
      title: input.title.trim(),
      description: input.note.trim() || null,
      category: parseTaskCategory(input.category),
      dueAt,
      assignedTo: input.assignedTo || null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, taskId))
    .returning({
      id: tasks.id,
      title: tasks.title,
      category: tasks.category,
      note: tasks.description,
      dueAt: tasks.dueAt,
      completedAt: tasks.completedAt,
      assignedTo: tasks.assignedTo,
    });

  await logForLinks(actor.id, links, "task.updated", `Tache modifiee par ${actor.fullName} : "${input.title}"`);

  revalidateLinks(links.length > 0 ? links : [{ entityType: "company", entityId: companyId }]);
  const attachmentsByTask = await loadTaskAttachments([taskId]);

  return {
    success: true,
    data: {
      ...row,
      dueAt: row.dueAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      assigneeName: null,
      attachments: attachmentsByTask.get(taskId) ?? [],
    },
  };
}

export async function toggleCompanyTask(
  taskId: string,
  companyId: string,
  currentlyDone: boolean
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return previewGuard;
  const now = new Date();
  const links = await loadTaskLinkInputs(taskId);

  const [row] = await db
    .update(tasks)
    .set({
      completedAt: currentlyDone ? null : now,
      completedBy: currentlyDone ? null : actor.id,
      updatedAt: now,
    })
    .where(eq(tasks.id, taskId))
    .returning({ title: tasks.title });

  await logForLinks(
    actor.id,
    links,
    currentlyDone ? "task.reopened" : "task.completed",
    currentlyDone ? `Tache rouverte : ${row.title}` : `Tache terminee : ${row.title}`
  );

  revalidateLinks(links.length > 0 ? links : [{ entityType: "company", entityId: companyId }]);
  return { success: true };
}

export async function deleteCompanyTask(
  taskId: string,
  companyId: string,
  taskTitle: string
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  const previewGuard = await checkPreviewGuard();
  if (previewGuard) return previewGuard;
  const links = await loadTaskLinkInputs(taskId);

  await db
    .update(tasks)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  await logForLinks(actor.id, links, "task.deleted", `Tache supprimee par ${actor.fullName} : "${taskTitle}"`);

  revalidateLinks(links.length > 0 ? links : [{ entityType: "company", entityId: companyId }]);
  return { success: true };
}
