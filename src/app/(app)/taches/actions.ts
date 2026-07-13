"use server";

import { db } from "@/db";
import { tasks, taskLinks, notifications, activityEvents, candidates, companies, companyContacts } from "@/db/schema";
import { eq, and, isNull, ilike, or } from "drizzle-orm";
import { requireAuth, requireMutator } from "@/lib/auth";
import { type AppRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Peuvent gérer (terminer / éditer / supprimer) n'importe quelle tâche.
const TASK_MANAGER_ROLES = new Set<AppRole>(["admin", "direction", "team_leader"]);

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
  parseTaskCategory,
  taskLinkFromFormData,
  taskPathsForLinks,
  type TaskLinkInput,
} from "@/lib/task-service";

export type EntityResult = {
  type: "candidate" | "company" | "contact";
  entityType: "candidate" | "company";
  entityId: string;
  candidateId: string | null;
  companyId: string | null;
  label: string;
  attachmentLabel: string;
  sub: string;
};

export async function searchEntities(query: string): Promise<EntityResult[]> {
  await requireAuth();
  if (query.trim().length < 2) return [];

  const q = `%${query.trim()}%`;

  const [cands, comps, contacts] = await Promise.all([
    db
      .select({ id: candidates.id, firstName: candidates.firstName, lastName: candidates.lastName })
      .from(candidates)
      .where(and(
        isNull(candidates.deletedAt),
        or(ilike(candidates.firstName, q), ilike(candidates.lastName, q))
      ))
      .limit(5),
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(and(isNull(companies.deletedAt), ilike(companies.name, q)))
      .limit(5),
    db
      .select({
        id: companyContacts.id,
        companyId: companyContacts.companyId,
        firstName: companyContacts.firstName,
        lastName: companyContacts.lastName,
        companyName: companies.name,
      })
      .from(companyContacts)
      .leftJoin(companies, eq(companyContacts.companyId, companies.id))
      .where(and(
        isNull(companyContacts.deletedAt),
        or(ilike(companyContacts.firstName, q), ilike(companyContacts.lastName, q))
      ))
      .limit(5),
  ]);

  return [
    ...cands.map((c) => {
      const label = `${c.firstName} ${c.lastName}`;
      return {
        type: "candidate" as const,
        entityType: "candidate" as const,
        entityId: c.id,
        candidateId: c.id,
        companyId: null,
        label,
        attachmentLabel: label,
        sub: "Candidat",
      };
    }),
    ...comps.map((c) => ({
      type: "company" as const,
      entityType: "company" as const,
      entityId: c.id,
      candidateId: null,
      companyId: c.id,
      label: c.name,
      attachmentLabel: c.name,
      sub: "Entreprise",
    })),
    ...contacts.map((c) => {
      const contactLabel = `${c.firstName} ${c.lastName}`;
      return {
        type: "contact" as const,
        entityType: "company" as const,
        entityId: c.companyId,
        candidateId: null,
        companyId: c.companyId,
        label: contactLabel,
        attachmentLabel: c.companyName ?? contactLabel,
        sub: c.companyName ?? "Contact",
      };
    }),
  ];
}

const taskSchema = z.object({
  title: z.string().trim().min(1),
  category: z.string().trim().min(1),
  description: z.string().trim().optional(),
  dueAt: z.string().min(1),
  assignedTo: z.string().uuid().optional().or(z.literal("")),
});

function firstLinkOfType(links: TaskLinkInput[], entityType: "candidate" | "company") {
  return links.find((link) => link.entityType === entityType)?.entityId ?? null;
}

async function loadLinksForTask(taskId: string): Promise<TaskLinkInput[]> {
  const rows = await db
    .select({ entityType: taskLinks.entityType, entityId: taskLinks.entityId })
    .from(taskLinks)
    .where(eq(taskLinks.taskId, taskId));

  return rows.map((row) => ({ entityType: row.entityType, entityId: row.entityId }));
}

async function logForLinks({
  actorId,
  links,
  actionType,
  summary,
}: {
  actorId: string;
  links: TaskLinkInput[];
  actionType: string;
  summary: string;
}) {
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

function revalidateLinkedTaskSurfaces(links: TaskLinkInput[]) {
  revalidatePath("/taches");
  for (const path of taskPathsForLinks(links)) revalidatePath(path);
}

export async function createGlobalTask(formData: FormData) {
  const user = await requireMutator();

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description") || undefined,
    dueAt: formData.get("dueAt"),
    assignedTo: formData.get("assignedTo") || "",
  });

  if (!parsed.success) return { error: "Champs invalides" };

  const { title, description, dueAt, assignedTo } = parsed.data;
  const category = parseTaskCategory(parsed.data.category);
  const links = taskLinkFromFormData(formData);

  if (links.length === 0) return { error: "Selectionnez au moins un candidat ou une entreprise" };

  const task = await db.transaction(async (tx) => {
    const [createdTask] = await tx.insert(tasks).values({
      title,
      category,
      description: description || null,
      dueAt: new Date(dueAt),
      assignedTo: assignedTo || null,
      createdBy: user.id,
    }).returning({ id: tasks.id });

    await tx.insert(taskLinks).values(
      links.map((link) => ({
        taskId: createdTask.id,
        entityType: link.entityType,
        entityId: link.entityId,
      }))
    );

    await tx.insert(activityEvents).values(
      links.map((link) => ({
        actorId: user.id,
        candidateId: link.entityType === "candidate" ? link.entityId : null,
        companyId: link.entityType === "company" ? link.entityId : null,
        actionType: "task.created",
        summary: `Tache creee : ${title}`,
      }))
    );

    return createdTask;
  });

  if (assignedTo && assignedTo !== user.id) {
    await db.insert(notifications).values({
      userId: assignedTo,
      type: "task_assigned",
      title: "Nouvelle tache assignee",
      body: `${user.fullName} vous a assigne : ${title}`,
      candidateId: firstLinkOfType(links, "candidate"),
      companyId: firstLinkOfType(links, "company"),
    });
  }

  revalidateLinkedTaskSurfaces(links);
  return { id: task.id };
}

export async function toggleGlobalTask(id: string) {
  const user = await requireMutator();

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!task) return;
  if (!canManageTask(task, user)) {
    throw new Error("Vous n'avez pas les droits sur cette tâche");
  }

  const now = task.completedAt ? null : new Date();
  const links = await loadLinksForTask(id);

  await db.update(tasks).set({
    completedAt: now,
    completedBy: now ? user.id : null,
    updatedAt: new Date(),
  }).where(eq(tasks.id, id));

  await logForLinks({
    actorId: user.id,
    links,
    actionType: now ? "task.completed" : "task.reopened",
    summary: now ? `Tache terminee : ${task.title}` : `Tache rouverte : ${task.title}`,
  });

  revalidateLinkedTaskSurfaces(links);
}

export async function updateGlobalTask(id: string, formData: FormData) {
  const user = await requireMutator();

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description") || undefined,
    dueAt: formData.get("dueAt"),
    assignedTo: formData.get("assignedTo") || "",
  });

  if (!parsed.success) return { error: "Champs invalides" };

  const { title, description, dueAt, assignedTo } = parsed.data;
  const category = parseTaskCategory(parsed.data.category);

  const existing = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!existing) return { error: "Tâche introuvable" };
  if (!canManageTask(existing, user)) {
    return { error: "Vous n'avez pas les droits sur cette tâche" };
  }

  const links = await loadLinksForTask(id);
  const newAssignee = assignedTo || null;

  await db.update(tasks).set({
    title,
    category,
    description: description || null,
    dueAt: new Date(dueAt),
    assignedTo: newAssignee,
    updatedAt: new Date(),
  }).where(eq(tasks.id, id));

  await logForLinks({
    actorId: user.id,
    links,
    actionType: "task.updated",
    summary: `Tache modifiee : ${title}`,
  });

  // Notifier le nouvel assigné lors d'une réassignation (createGlobalTask notifie
  // à la création, mais l'édition ne le faisait pas → réassignation silencieuse).
  if (newAssignee && newAssignee !== existing.assignedTo && newAssignee !== user.id) {
    await db.insert(notifications).values({
      userId: newAssignee,
      type: "task_assigned",
      title: "Tâche assignée",
      body: `${user.fullName} vous a assigné : ${title}`,
      candidateId: firstLinkOfType(links, "candidate"),
      companyId: firstLinkOfType(links, "company"),
    });
  }

  revalidateLinkedTaskSurfaces(links);
}

export async function deleteGlobalTask(id: string) {
  const user = await requireMutator();
  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!task) return;
  if (!canManageTask(task, user)) {
    throw new Error("Vous n'avez pas les droits sur cette tâche");
  }
  const links = await loadLinksForTask(id);

  await db.update(tasks).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(tasks.id, id));

  await logForLinks({
    actorId: user.id,
    links,
    actionType: "task.deleted",
    summary: `Tache supprimee : ${task?.title ?? "Sans titre"}`,
  });

  revalidateLinkedTaskSurfaces(links);
}
