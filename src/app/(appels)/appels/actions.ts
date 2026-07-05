"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { candidates, companies, companyContacts, tasks } from "@/db/schema";
import { and, eq, ilike, isNull, sql, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
}) {
  const user = await requireAuth();

  const now = new Date();
  const candidateId =
    input.contactType === "candidate" ? input.contactId : null;
  const companyId =
    input.contactType === "company_contact" ? (input.companyId ?? null) : null;

  await db.insert(tasks).values({
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
  });

  if (input.relanceDate) {
    await db.insert(tasks).values({
      title: `Relance — ${input.contactName}`,
      category: "follow_up",
      candidateId,
      companyId,
      assignedTo: user.id,
      createdBy: user.id,
      dueAt: new Date(input.relanceDate),
      source: "mobile",
    });
  }

  revalidatePath("/appels/relances");
}

export async function completeRelance(taskId: string) {
  const user = await requireAuth();
  const now = new Date();

  await db
    .update(tasks)
    .set({ completedAt: now, completedBy: user.id })
    .where(
      and(
        eq(tasks.id, taskId),
        eq(tasks.assignedTo, user.id),
        isNull(tasks.completedAt),
        isNull(tasks.deletedAt),
      ),
    );

  revalidatePath("/appels/relances");
}

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
