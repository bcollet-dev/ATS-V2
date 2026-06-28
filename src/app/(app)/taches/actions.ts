"use server";

import { db } from "@/db";
import { tasks, notifications, activityEvents, profiles, candidates, companies, companyContacts } from "@/db/schema";
import { eq, and, isNull, ilike, or } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type EntityResult = {
  type: "candidate" | "company" | "contact";
  candidateId: string | null;
  companyId: string | null;
  label: string;
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
    ...cands.map((c) => ({
      type: "candidate" as const,
      candidateId: c.id,
      companyId: null,
      label: `${c.firstName} ${c.lastName}`,
      sub: "Candidat",
    })),
    ...comps.map((c) => ({
      type: "company" as const,
      candidateId: null,
      companyId: c.id,
      label: c.name,
      sub: "Entreprise",
    })),
    ...contacts.map((c) => ({
      type: "contact" as const,
      candidateId: null,
      companyId: c.companyId,
      label: `${c.firstName} ${c.lastName}`,
      sub: c.companyName ?? "Contact",
    })),
  ];
}

const taskSchema = z.object({
  title: z.string().trim().min(1),
  category: z.enum(["call", "email", "document", "follow_up", "interview", "other"]),
  description: z.string().trim().optional(),
  dueAt: z.string().min(1),
  assignedTo: z.string().uuid().optional().or(z.literal("")),
  candidateId: z.string().uuid().optional().or(z.literal("")),
  companyId: z.string().uuid().optional().or(z.literal("")),
});

export async function createGlobalTask(formData: FormData) {
  const user = await requireAuth();

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description") || undefined,
    dueAt: formData.get("dueAt"),
    assignedTo: formData.get("assignedTo") || "",
    candidateId: formData.get("candidateId") || "",
    companyId: formData.get("companyId") || "",
  });

  if (!parsed.success) return { error: "Champs invalides" };

  const { title, category, description, dueAt, assignedTo, candidateId, companyId } = parsed.data;

  if (!candidateId && !companyId) return { error: "Sélectionnez un rattachement" };

  const [task] = await db.insert(tasks).values({
    title,
    category,
    description: description || null,
    dueAt: new Date(dueAt),
    assignedTo: assignedTo || null,
    candidateId: candidateId || null,
    companyId: companyId || null,
    createdBy: user.id,
  }).returning({ id: tasks.id });

  if (assignedTo && assignedTo !== user.id) {
    await db.insert(notifications).values({
      userId: assignedTo,
      type: "task_assigned",
      title: "Nouvelle tâche assignée",
      body: `${user.fullName} vous a assigné : ${title}`,
      candidateId: candidateId || null,
    });
  }

  await db.insert(activityEvents).values({
    actorId: user.id,
    candidateId: candidateId || null,
    companyId: companyId || null,
    actionType: "task.created",
    summary: `Tâche créée : ${title}`,
  });

  revalidatePath("/taches");
}

export async function toggleGlobalTask(id: string) {
  const user = await requireAuth();

  const task = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
  if (!task) return;

  const now = task.completedAt ? null : new Date();

  await db.update(tasks).set({
    completedAt: now,
    completedBy: now ? user.id : null,
    updatedAt: new Date(),
  }).where(eq(tasks.id, id));

  revalidatePath("/taches");
}

export async function updateGlobalTask(id: string, formData: FormData) {
  await requireAuth();

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description") || undefined,
    dueAt: formData.get("dueAt"),
    assignedTo: formData.get("assignedTo") || "",
    candidateId: formData.get("candidateId") || "",
    companyId: formData.get("companyId") || "",
  });

  if (!parsed.success) return { error: "Champs invalides" };

  const { title, category, description, dueAt, assignedTo, candidateId, companyId } = parsed.data;

  await db.update(tasks).set({
    title,
    category,
    description: description || null,
    dueAt: new Date(dueAt),
    assignedTo: assignedTo || null,
    candidateId: candidateId || null,
    companyId: companyId || null,
    updatedAt: new Date(),
  }).where(eq(tasks.id, id));

  revalidatePath("/taches");
}

export async function deleteGlobalTask(id: string) {
  await requireAuth();
  await db.update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, id));
  revalidatePath("/taches");
}
