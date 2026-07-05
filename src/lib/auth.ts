import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export type UserProfile = typeof profiles.$inferSelect & {
  _isPreview?: true;
  _realAdminId?: string;
};

const PREVIEW_COOKIE = "ats_preview_uid";

export async function getCurrentUser(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profile = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.id, user.id),
      eq(profiles.active, true),
      isNull(profiles.deletedAt),
    ),
  });

  if (!profile) return null;

  // Admin preview: swap identity with a specific user for the session
  if (profile.role === "admin") {
    const cookieStore = await cookies();
    const previewUid = cookieStore.get(PREVIEW_COOKIE)?.value;
    if (previewUid && previewUid !== profile.id) {
      const impersonated = await db.query.profiles.findFirst({
        where: and(
          eq(profiles.id, previewUid),
          eq(profiles.active, true),
          isNull(profiles.deletedAt),
        ),
      });
      if (impersonated) {
        return { ...impersonated, _isPreview: true, _realAdminId: profile.id };
      }
    }
  }

  return profile;
}

export async function requireAuth(): Promise<UserProfile> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(
  ...roles: Array<"admin" | "direction" | "team_leader" | "admissions" | "relations_entreprises">
) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

// Use at the top of mutation server actions to block writes in preview mode.
export async function checkPreviewGuard(): Promise<{ success: false; error: string } | null> {
  const cookieStore = await cookies();
  if (cookieStore.get(PREVIEW_COOKIE)?.value) {
    return { success: false, error: "Action non disponible en mode prévisualisation" };
  }
  return null;
}
