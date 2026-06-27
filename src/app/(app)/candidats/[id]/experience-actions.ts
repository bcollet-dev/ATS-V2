"use server";

import { db } from "@/db";
import { candidateExperiences, activityEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";

export type ExperienceInput = {
  jobTitle: string;
  company: string;
  contractType: string;
  startMonth: string;
  endMonth: string;
  isCurrent: boolean;
  description: string;
};

export type ExperienceRow = {
  id: string;
  candidateId: string;
  jobTitle: string;
  company: string;
  contractType: string | null;
  startMonth: string;
  endMonth: string | null;
  isCurrent: boolean;
  description: string | null;
};

const s = (v: string) => v.trim() || null;

export async function addExperience(
  candidateId: string,
  input: ExperienceInput
): Promise<{ success: boolean; data?: ExperienceRow; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const [row] = await db
    .insert(candidateExperiences)
    .values({
      candidateId,
      jobTitle: input.jobTitle.trim(),
      company: input.company.trim(),
      contractType: s(input.contractType),
      startMonth: input.startMonth,
      endMonth: input.isCurrent ? null : s(input.endMonth),
      isCurrent: input.isCurrent,
      description: s(input.description),
    })
    .returning({
      id: candidateExperiences.id,
      candidateId: candidateExperiences.candidateId,
      jobTitle: candidateExperiences.jobTitle,
      company: candidateExperiences.company,
      contractType: candidateExperiences.contractType,
      startMonth: candidateExperiences.startMonth,
      endMonth: candidateExperiences.endMonth,
      isCurrent: candidateExperiences.isCurrent,
      description: candidateExperiences.description,
    });

  await db.insert(activityEvents).values({
    actorId: user.id,
    candidateId,
    actionType: "candidate.updated",
    summary: `Expérience ajoutée : ${input.jobTitle} chez ${input.company}`,
  });

  revalidatePath(`/candidats/${candidateId}`);
  return { success: true, data: row };
}

export async function updateExperience(
  id: string,
  candidateId: string,
  input: ExperienceInput
): Promise<{ success: boolean; data?: ExperienceRow; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const [row] = await db
    .update(candidateExperiences)
    .set({
      jobTitle: input.jobTitle.trim(),
      company: input.company.trim(),
      contractType: s(input.contractType),
      startMonth: input.startMonth,
      endMonth: input.isCurrent ? null : s(input.endMonth),
      isCurrent: input.isCurrent,
      description: s(input.description),
    })
    .where(eq(candidateExperiences.id, id))
    .returning({
      id: candidateExperiences.id,
      candidateId: candidateExperiences.candidateId,
      jobTitle: candidateExperiences.jobTitle,
      company: candidateExperiences.company,
      contractType: candidateExperiences.contractType,
      startMonth: candidateExperiences.startMonth,
      endMonth: candidateExperiences.endMonth,
      isCurrent: candidateExperiences.isCurrent,
      description: candidateExperiences.description,
    });

  revalidatePath(`/candidats/${candidateId}`);
  return { success: true, data: row };
}

export async function deleteExperience(
  id: string,
  candidateId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  await db.delete(candidateExperiences).where(eq(candidateExperiences.id, id));
  revalidatePath(`/candidats/${candidateId}`);
  return { success: true };
}
