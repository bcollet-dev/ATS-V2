import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export type UserProfile = typeof profiles.$inferSelect & {
  _isPreview?: true;
  _realAdminId?: string;
  _previewMode?: "role" | "user";
};

const PREVIEW_COOKIE = "ats_preview_uid";

const VALID_ROLES = new Set([
  "direction", "team_leader", "admissions", "relations_entreprises",
]);

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

  if (profile.role === "admin") {
    const cookieStore = await cookies();
    const previewVal = cookieStore.get(PREVIEW_COOKIE)?.value;

    if (previewVal) {
      // Role-only preview: cookie starts with "role:"
      if (previewVal.startsWith("role:")) {
        const role = previewVal.slice(5);
        if (VALID_ROLES.has(role)) {
          return {
            ...profile,
            role: role as UserProfile["role"],
            _isPreview: true,
            _realAdminId: profile.id,
            _previewMode: "role",
          };
        }
      } else if (previewVal !== profile.id) {
        // User-specific preview: cookie is a user UUID
        const impersonated = await db.query.profiles.findFirst({
          where: and(
            eq(profiles.id, previewVal),
            eq(profiles.active, true),
            isNull(profiles.deletedAt),
          ),
        });
        if (impersonated) {
          return {
            ...impersonated,
            _isPreview: true,
            _realAdminId: profile.id,
            _previewMode: "user",
          };
        }
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

/**
 * Comme requireAuth, mais destiné aux actions d'écriture : refuse d'exécuter une
 * mutation quand une prévisualisation est active (rôle ou utilisateur). Évite
 * qu'un admin en « voir comme » modifie des données attribuées à l'utilisateur
 * impersoné. En usage normal (pas de cookie de preview), équivalent à requireAuth.
 */
export async function requireMutator(): Promise<UserProfile> {
  const user = await requireAuth();
  const cookieStore = await cookies();
  if (cookieStore.get(PREVIEW_COOKIE)?.value) {
    throw new Error("Action non disponible en mode prévisualisation");
  }
  return user;
}
