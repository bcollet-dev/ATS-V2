import { db } from "@/db";
import { candidates, companies, taskLinks } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export type TaskEntityType = "candidate" | "company";

export type TaskLinkInput = {
  entityType: TaskEntityType;
  entityId: string;
};

export type TaskAttachment = TaskLinkInput & {
  label: string;
  href: string;
};

export const TASK_CATEGORIES = [
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

export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export function parseTaskCategory(value: FormDataEntryValue | string | null): TaskCategory {
  if (typeof value === "string" && (TASK_CATEGORIES as readonly string[]).includes(value)) {
    return value as TaskCategory;
  }
  return "follow_up";
}

export function normalizeTaskLinks(links: TaskLinkInput[]): TaskLinkInput[] {
  const seen = new Set<string>();
  const normalized: TaskLinkInput[] = [];

  for (const link of links) {
    if ((link.entityType !== "candidate" && link.entityType !== "company") || !link.entityId) continue;
    const key = `${link.entityType}:${link.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(link);
  }

  return normalized;
}

export function taskLinkFromFormData(formData: FormData): TaskLinkInput[] {
  const links: TaskLinkInput[] = [
    ...formData.getAll("candidateIds").map((id) => ({ entityType: "candidate" as const, entityId: String(id) })),
    ...formData.getAll("companyIds").map((id) => ({ entityType: "company" as const, entityId: String(id) })),
  ];

  const legacyCandidateId = String(formData.get("candidateId") ?? "");
  const legacyCompanyId = String(formData.get("companyId") ?? "");

  if (legacyCandidateId) links.push({ entityType: "candidate", entityId: legacyCandidateId });
  if (legacyCompanyId) links.push({ entityType: "company", entityId: legacyCompanyId });

  return normalizeTaskLinks(links);
}

export async function loadTaskAttachments(taskIds: string[]): Promise<Map<string, TaskAttachment[]>> {
  const map = new Map<string, TaskAttachment[]>();
  if (taskIds.length === 0) return map;

  const rows = await db
    .select({
      taskId: taskLinks.taskId,
      entityType: taskLinks.entityType,
      entityId: taskLinks.entityId,
      candidateFirstName: candidates.firstName,
      candidateLastName: candidates.lastName,
      companyName: companies.name,
    })
    .from(taskLinks)
    .leftJoin(
      candidates,
      and(eq(taskLinks.entityType, "candidate"), eq(taskLinks.entityId, candidates.id))
    )
    .leftJoin(
      companies,
      and(eq(taskLinks.entityType, "company"), eq(taskLinks.entityId, companies.id))
    )
    .where(inArray(taskLinks.taskId, taskIds));

  for (const row of rows) {
    const label = row.entityType === "candidate"
      ? `${row.candidateFirstName ?? ""} ${row.candidateLastName ?? ""}`.trim() || "Candidat supprime"
      : row.companyName ?? "Entreprise supprimee";
    const href = row.entityType === "candidate"
      ? `/candidats/${row.entityId}`
      : `/annuaire/${row.entityId}`;

    if (!map.has(row.taskId)) map.set(row.taskId, []);
    map.get(row.taskId)!.push({
      entityType: row.entityType,
      entityId: row.entityId,
      label,
      href,
    });
  }

  return map;
}

export async function loadTaskLinkInputs(taskId: string): Promise<TaskLinkInput[]> {
  const rows = await db
    .select({ entityType: taskLinks.entityType, entityId: taskLinks.entityId })
    .from(taskLinks)
    .where(eq(taskLinks.taskId, taskId));

  return rows.map((row) => ({ entityType: row.entityType, entityId: row.entityId }));
}

export function taskPathsForLinks(links: TaskLinkInput[]): string[] {
  return normalizeTaskLinks(links).map((link) =>
    link.entityType === "candidate" ? `/candidats/${link.entityId}` : `/annuaire/${link.entityId}`
  );
}
