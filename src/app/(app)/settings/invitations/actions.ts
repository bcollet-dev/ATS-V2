"use server";

import { requireAuth } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { db } from "@/db";
import { allowedEmails, profiles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type InvitationRow = {
  email: string;
  role: AppRole;
  consumedAt: string | null;
  createdAt: string;
  invitedByName: string | null;
};

export async function listInvitations(): Promise<InvitationRow[]> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "system:access")) return [];

  const rows = await db
    .select({
      email: allowedEmails.email,
      role: allowedEmails.role,
      consumedAt: allowedEmails.consumedAt,
      createdAt: allowedEmails.createdAt,
      invitedByName: profiles.fullName,
    })
    .from(allowedEmails)
    .leftJoin(profiles, eq(allowedEmails.invitedBy, profiles.id))
    .orderBy(desc(allowedEmails.createdAt));

  return rows.map((r) => ({
    email: r.email,
    role: r.role as AppRole,
    consumedAt: r.consumedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    invitedByName: r.invitedByName,
  }));
}

export async function createInvitation(
  email: string,
  role: AppRole
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "system:access")) return { success: false, error: "Non autorisé" };

  const trimmed = email.trim().toLowerCase();
  if (!trimmed.endsWith("@eda-rh.fr")) {
    return { success: false, error: "L'email doit être @eda-rh.fr" };
  }

  try {
    await db.insert(allowedEmails).values({
      email: trimmed,
      role,
      invitedBy: actor.id,
    });
  } catch {
    return { success: false, error: "Cet email a déjà été invité" };
  }

  revalidatePath("/settings/invitations");
  return { success: true };
}

export async function deleteInvitation(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "system:access")) return { success: false, error: "Non autorisé" };

  const [row] = await db
    .select({ consumedAt: allowedEmails.consumedAt })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, email))
    .limit(1);

  if (!row) return { success: false, error: "Invitation introuvable" };
  if (row.consumedAt) return { success: false, error: "Cette invitation a déjà été utilisée" };

  await db.delete(allowedEmails).where(eq(allowedEmails.email, email));

  revalidatePath("/settings/invitations");
  return { success: true };
}
