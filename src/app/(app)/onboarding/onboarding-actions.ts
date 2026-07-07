"use server";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export async function markOnboardingComplete() {
  const user = await requireAuth();
  await db
    .update(profiles)
    .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(profiles.id, user.id));
}
