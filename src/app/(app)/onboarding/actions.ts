"use server";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  fullName: z.string().trim().min(1, "Le nom ne peut pas être vide"),
});

export async function confirmName(formData: FormData) {
  const user = await requireAuth();

  const parsed = schema.safeParse({ fullName: formData.get("fullName") });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  await db
    .update(profiles)
    .set({ fullName: parsed.data.fullName, nameConfirmed: true, updatedAt: new Date() })
    .where(eq(profiles.id, user.id));

  revalidatePath("/", "layout");
}
