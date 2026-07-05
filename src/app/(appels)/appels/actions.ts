"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import {
  candidates,
  companies,
  companyContacts,
  tasks,
  taskLinks,
  notifications,
} from "@/db/schema";
import {
  and,
  asc,
  eq,
  ilike,
  isNull,
  sql,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { profiles } from "@/db/schema";
import { parseTaskCategory } from "@/lib/task-service";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContactResult =
  | {
      type: "candidate";
      id: string;
      firstName: string;
      lastName: string;
      phone: string | null;
    }
  | {
      type: "company_contact";
      id: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      companyId: string;
      companyName: string;
    };

export type ProfileOption = { id: string; fullName: string };

export type RelanceRow = {
  id: string;
  title: string;
  dueAt: Date;
  candidateId: string | null;
  companyId: string | null;
  candidateFirstName: string | null;
  candidateLastName: string | null;
  companyName: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function revalidateContactPaths(
  candidateId: string | null,
  companyId: string | null,
) {
  revalidatePath("/taches");
  if (candidateId) revalidatePath(`/candidats/${candidateId}`);
  if (companyId) revalidatePath(`/annuaire/${companyId}`);
  revalidatePath("/appels/relances");
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function getProfiles(): Promise<ProfileOption[]> {
  await requireAuth();
  return db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(and(eq(profiles.active, true), isNull(profiles.deletedAt)))
    .orderBy(asc(profiles.fullName));
}

export async function searchContacts(query: string): Promise<ContactResult[]> {
  if (query.trim().length < 2) return [];
  await requireAuth();

  const q = `%${query.trim()}%`;

  const [candidateRows, contactRows] = await Promise.all([
    db
      .select({
        id: candidates.id,
        firstName: candidates.firstName,
        lastName: candidates.lastName,
        phone: candidates.phone,
      })
      .from(candidates)
      .where(
        and(
          isNull(candidates.deletedAt),
          ilike(
            sql`${candidates.firstName} || ' ' || ${candidates.lastName}`,
            q,
          ),
        ),
      )
      .limit(10),

    db
      .select({
        id: companyContacts.id,
        firstName: companyContacts.firstName,
        lastName: companyContacts.lastName,
        phone: companyContacts.phone,
        companyId: companyContacts.companyId,
        companyName: companies.name,
      })
      .from(companyContacts)
      .leftJoin(companies, eq(companyContacts.companyId, companies.id))
      .where(
        and(
          isNull(companyContacts.deletedAt),
          ilike(
            sql`${companyContacts.firstName} || ' ' || ${companyContacts.lastName}`,
            q,
          ),
        ),
      )
      .limit(10),
  ]);

  const results: ContactResult[] = [
    ...candidateRows.map((c) => ({ type: "candidate" as const, ...c })),
    ...contactRows.map((c) => ({
      type: "company_contact" as const,
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      companyId: c.companyId,
      companyName: c.companyName ?? "",
    })),
  ];

  return results.sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(
      `${b.firstName} ${b.lastName}`,
      "fr",
    ),
  );
}

export async function logCall(input: {
  contactId: string;
  contactType: "candidate" | "company_contact";
  companyId?: string;
  contactName: string;
  callStatus: string;
  note?: string;
  relanceDate?: string;
  relanceAssignedTo?: string;
}) {
  const user = await requireAuth();
  const now = new Date();

  const candidateId =
    input.contactType === "candidate" ? input.contactId : null;
  const companyId =
    input.contactType === "company_contact" ? (input.companyId ?? null) : null;

  const entityType = input.contactType === "candidate" ? "candidate" : "company";
  const entityId = input.contactType === "candidate" ? input.contactId : (input.companyId ?? "");

  // Call task (completed immediately)
  const [callTask] = await db
    .insert(tasks)
    .values({
      title: `Appel — ${input.contactName}`,
      category: "call",
      candidateId,
      companyId,
      assignedTo: user.id,
      createdBy: user.id,
      completedAt: now,
      completedBy: user.id,
      dueAt: now,
      description: JSON.stringify({
        status: input.callStatus,
        note: input.note ?? "",
      }),
      source: "mobile",
    })
    .returning({ id: tasks.id });

  await db.insert(taskLinks).values({
    taskId: callTask.id,
    entityType,
    entityId,
  });

  // Follow-up task (optional)
  if (input.relanceDate) {
    const assignedTo = input.relanceAssignedTo || user.id;

    const [relanceTask] = await db
      .insert(tasks)
      .values({
        title: `Relance — ${input.contactName}`,
        category: "follow_up",
        candidateId,
        companyId,
        assignedTo,
        createdBy: user.id,
        dueAt: new Date(input.relanceDate),
        source: "mobile",
      })
      .returning({ id: tasks.id });

    await db.insert(taskLinks).values({
      taskId: relanceTask.id,
      entityType,
      entityId,
    });

    if (assignedTo !== user.id) {
      await db.insert(notifications).values({
        userId: assignedTo,
        type: "task_assigned",
        title: "Nouvelle tâche assignée",
        body: `${user.fullName} vous a assigné : Relance — ${input.contactName}`,
        candidateId,
        companyId,
      });
    }
  }

  revalidateContactPaths(candidateId, companyId);
}

export async function createQuickTask(input: {
  contactId: string;
  contactType: "candidate" | "company_contact";
  companyId?: string;
  contactName: string;
  category: string;
  title: string;
  dueAt: string;
  assignedTo: string;
}) {
  const user = await requireAuth();

  const candidateId =
    input.contactType === "candidate" ? input.contactId : null;
  const companyId =
    input.contactType === "company_contact" ? (input.companyId ?? null) : null;

  const entityType = input.contactType === "candidate" ? "candidate" : "company";
  const entityId = input.contactType === "candidate" ? input.contactId : (input.companyId ?? "");

  const assignedTo = input.assignedTo || user.id;

  const [task] = await db
    .insert(tasks)
    .values({
      title: input.title,
      category: parseTaskCategory(input.category),
      candidateId,
      companyId,
      assignedTo,
      createdBy: user.id,
      dueAt: new Date(input.dueAt),
      source: "mobile",
    })
    .returning({ id: tasks.id });

  await db.insert(taskLinks).values({
    taskId: task.id,
    entityType,
    entityId,
  });

  if (assignedTo !== user.id) {
    await db.insert(notifications).values({
      userId: assignedTo,
      type: "task_assigned",
      title: "Nouvelle tâche assignée",
      body: `${user.fullName} vous a assigné : ${input.title}`,
      candidateId,
      companyId,
    });
  }

  revalidateContactPaths(candidateId, companyId);
}

export async function completeRelance(taskId: string) {
  const user = await requireAuth();
  const now = new Date();

  const [row] = await db
    .update(tasks)
    .set({ completedAt: now, completedBy: user.id })
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.assignedTo, user.id),
        isNull(tasks.completedAt),
        isNull(tasks.deletedAt),
      ),
    )
    .returning({ candidateId: tasks.candidateId, companyId: tasks.companyId });

  if (row) revalidateContactPaths(row.candidateId, row.companyId);
}

export async function getRelances(): Promise<RelanceRow[]> {
  const user = await requireAuth();

  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      candidateId: tasks.candidateId,
      companyId: tasks.companyId,
      candidateFirstName: candidates.firstName,
      candidateLastName: candidates.lastName,
      companyName: companies.name,
    })
    .from(tasks)
    .leftJoin(candidates, eq(tasks.candidateId, candidates.id))
    .leftJoin(companies, eq(tasks.companyId, companies.id))
    .where(
      and(
        eq(tasks.assignedTo, user.id),
        eq(tasks.category, "follow_up"),
        isNull(tasks.completedAt),
        isNull(tasks.deletedAt),
      ),
    )
    .orderBy(asc(tasks.dueAt));
}
