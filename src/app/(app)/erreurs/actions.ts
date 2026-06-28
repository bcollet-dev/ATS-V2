"use server";

import { db } from "@/db";
import { bugReports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().trim().min(1),
  page: z.string().trim().min(1),
  action: z.string().trim().min(1),
  expected: z.string().trim().min(1),
  observed: z.string().trim().min(1),
  priority: z.enum(["low", "medium", "high"]),
  notes: z.string().trim().optional(),
});

export async function createBugReport(formData: FormData) {
  const user = await requireAuth();

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    page: formData.get("page"),
    action: formData.get("action"),
    expected: formData.get("expected"),
    observed: formData.get("observed"),
    priority: formData.get("priority"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) return { error: "Champs invalides" };

  await db.insert(bugReports).values({
    ...parsed.data,
    reportedBy: user.id,
  });

  revalidatePath("/erreurs");
}

export async function updateBugStatus(id: string, status: string) {
  await requireAuth();
  await db
    .update(bugReports)
    .set({ status, updatedAt: new Date() })
    .where(eq(bugReports.id, id));
  revalidatePath("/erreurs");
}

export async function deleteBugReport(id: string) {
  await requireAuth();
  await db.delete(bugReports).where(eq(bugReports.id, id));
  revalidatePath("/erreurs");
}

export async function logError({
  message,
  stack,
  digest,
  page,
}: {
  message: string;
  stack?: string;
  digest?: string;
  page: string;
}) {
  try {
    await db.insert(bugReports).values({
      title: message.slice(0, 120),
      page,
      action: "Erreur automatique (runtime)",
      expected: "Pas d'erreur",
      observed: stack ? `${message}\n\n${stack}` : message,
      priority: "high",
      status: "open",
      notes: digest ? `Next.js digest: ${digest}` : null,
    });
  } catch {
    // silently fail — don't loop on logging errors
  }
}
