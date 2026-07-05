"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const PREVIEW_COOKIE = "ats_preview_uid";

export async function startPreview(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify the real caller is an active admin (not via preview)
  const adminProfile = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.id, user.id),
      eq(profiles.active, true),
      isNull(profiles.deletedAt),
    ),
  });
  if (!adminProfile || adminProfile.role !== "admin") redirect("/dashboard");

  // Verify target exists, is active, and is not admin
  const target = await db.query.profiles.findFirst({
    where: and(
      eq(profiles.id, userId),
      eq(profiles.active, true),
      isNull(profiles.deletedAt),
    ),
  });
  if (!target || target.role === "admin") return;

  const cookieStore = await cookies();
  // No maxAge/expires → session cookie, cleared on browser close
  cookieStore.set(PREVIEW_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect("/dashboard");
}

export async function exitPreview() {
  const cookieStore = await cookies();
  cookieStore.delete(PREVIEW_COOKIE);
  redirect("/dashboard");
}
