"use server";

import { db } from "@/db";
import { cursus } from "@/db/schema";
import { eq, isNull, asc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createCursusSchema, type CreateCursusInput } from "./schemas";

export type CursusRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  active: boolean;
  createdAt: Date;
};

type ActionResult =
  | { success: true; data: CursusRow }
  | { success: false; error: string };

export async function getCursus(): Promise<CursusRow[]> {
  return db
    .select({
      id: cursus.id,
      name: cursus.name,
      code: cursus.code,
      description: cursus.description,
      active: cursus.active,
      createdAt: cursus.createdAt,
    })
    .from(cursus)
    .where(isNull(cursus.syncedAt))
    .orderBy(asc(cursus.name));
}

export async function getActiveCursus(): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: cursus.id, name: cursus.name })
    .from(cursus)
    .where(and(isNull(cursus.syncedAt), eq(cursus.active, true)))
    .orderBy(asc(cursus.name));
}

export async function createCursus(input: CreateCursusInput): Promise<ActionResult> {
  const parsed = createCursusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides" };

  const { name, code, description } = parsed.data;

  const [created] = await db
    .insert(cursus)
    .values({
      name,
      code: code || null,
      description: description || null,
    })
    .returning({
      id: cursus.id,
      name: cursus.name,
      code: cursus.code,
      description: cursus.description,
      active: cursus.active,
      createdAt: cursus.createdAt,
    });

  revalidatePath("/cursus");
  return { success: true, data: created };
}

export async function toggleCursusActive(id: string, active: boolean): Promise<void> {
  await db.update(cursus).set({ active }).where(eq(cursus.id, id));
  revalidatePath("/cursus");
}
