"use server";

import { db } from "@/db";
import { candidateSkills } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";

export async function addSkill(
  candidateId: string,
  name: string
): Promise<{ success: boolean; data?: { id: string; name: string }; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Compétence vide" };

  const [row] = await db
    .insert(candidateSkills)
    .values({ candidateId, name: trimmed })
    .returning({ id: candidateSkills.id, name: candidateSkills.name });

  revalidatePath(`/candidats/${candidateId}`);
  return { success: true, data: row };
}

export async function deleteSkill(
  id: string,
  candidateId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Non authentifié" };

  await db.delete(candidateSkills).where(eq(candidateSkills.id, id));
  revalidatePath(`/candidats/${candidateId}`);
  return { success: true };
}
