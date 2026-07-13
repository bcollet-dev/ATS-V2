"use server";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, checkPreviewGuard } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

const VALID_ROLES = new Set<AppRole>([
  "admin",
  "direction",
  "team_leader",
  "admissions",
  "relations_entreprises",
]);

type Result = { success: boolean; error?: string };

/**
 * Active ou réactive un utilisateur (réactivation = clear deleted_at + active).
 * Admin uniquement. Impossible sur soi-même (évite l'auto-verrouillage).
 */
export async function setUserActive(userId: string, active: boolean): Promise<Result> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "system:access")) return { success: false, error: "Non autorisé" };
  const guard = await checkPreviewGuard();
  if (guard) return guard;
  if (userId === actor.id) {
    return { success: false, error: "Vous ne pouvez pas modifier votre propre statut" };
  }

  const target = await db.query.profiles.findFirst({
    where: eq(profiles.id, userId),
    columns: { id: true },
  });
  if (!target) return { success: false, error: "Utilisateur introuvable" };

  await db
    .update(profiles)
    .set({
      active,
      ...(active ? { deletedAt: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(profiles.id, userId));

  revalidatePath("/settings/users");
  return { success: true };
}

/**
 * Change le rôle d'un utilisateur. Admin uniquement. Impossible sur soi-même
 * (évite de perdre ses propres droits admin par erreur).
 */
export async function updateUserRole(userId: string, role: string): Promise<Result> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "system:access")) return { success: false, error: "Non autorisé" };
  const guard = await checkPreviewGuard();
  if (guard) return guard;
  if (userId === actor.id) {
    return { success: false, error: "Vous ne pouvez pas modifier votre propre rôle" };
  }
  if (!VALID_ROLES.has(role as AppRole)) {
    return { success: false, error: "Rôle invalide" };
  }

  const target = await db.query.profiles.findFirst({
    where: eq(profiles.id, userId),
    columns: { id: true },
  });
  if (!target) return { success: false, error: "Utilisateur introuvable" };

  await db
    .update(profiles)
    .set({ role: role as never, updatedAt: new Date() })
    .where(eq(profiles.id, userId));

  revalidatePath("/settings/users");
  return { success: true };
}
