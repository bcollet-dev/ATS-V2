"use server";

import { db } from "@/db";
import { candidateFormations, activityEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";

export type FormationInput = {
  title: string;
  institution: string;
  startMonth: string;
  endMonth: string;
  isCurrent: boolean;
};

export type FormationRow = {
  id: string;
  candidateId: string;
  title: string;
  institution: string;
  startMonth: string;
  endMonth: string | null;
  isCurrent: boolean;
};

const s = (v: string) => v.trim() || null;

export async function addFormation(
  candidateId: string,
  input: FormationInput
): Promise<{ success: boolean; data?: FormationRow; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };
  if (!can(user.role as AppRole, "candidates:edit")) return { success: false, error: "Non autorisé" };

  const [row] = await db
    .insert(candidateFormations)
    .values({
      candidateId,
      title: input.title.trim(),
      institution: input.institution.trim(),
      startMonth: input.startMonth,
      endMonth: input.isCurrent ? null : s(input.endMonth),
      isCurrent: input.isCurrent,
    })
    .returning({
      id: candidateFormations.id,
      candidateId: candidateFormations.candidateId,
      title: candidateFormations.title,
      institution: candidateFormations.institution,
      startMonth: candidateFormations.startMonth,
      endMonth: candidateFormations.endMonth,
      isCurrent: candidateFormations.isCurrent,
    });

  await db.insert(activityEvents).values({
    actorId: user.id,
    candidateId,
    actionType: "candidate.updated",
    summary: `Formation ajoutée : ${input.title} à ${input.institution}`,
  });

  revalidatePath(`/candidats/${candidateId}`);
  return { success: true, data: row };
}

export async function updateFormation(
  id: string,
  candidateId: string,
  input: FormationInput
): Promise<{ success: boolean; data?: FormationRow; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };
  if (!can(user.role as AppRole, "candidates:edit")) return { success: false, error: "Non autorisé" };

  const [row] = await db
    .update(candidateFormations)
    .set({
      title: input.title.trim(),
      institution: input.institution.trim(),
      startMonth: input.startMonth,
      endMonth: input.isCurrent ? null : s(input.endMonth),
      isCurrent: input.isCurrent,
    })
    .where(eq(candidateFormations.id, id))
    .returning({
      id: candidateFormations.id,
      candidateId: candidateFormations.candidateId,
      title: candidateFormations.title,
      institution: candidateFormations.institution,
      startMonth: candidateFormations.startMonth,
      endMonth: candidateFormations.endMonth,
      isCurrent: candidateFormations.isCurrent,
    });

  revalidatePath(`/candidats/${candidateId}`);
  return { success: true, data: row };
}

export async function deleteFormation(
  id: string,
  candidateId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };
  if (!can(user.role as AppRole, "candidates:edit")) return { success: false, error: "Non autorisé" };

  await db.delete(candidateFormations).where(eq(candidateFormations.id, id));
  revalidatePath(`/candidats/${candidateId}`);
  return { success: true };
}
