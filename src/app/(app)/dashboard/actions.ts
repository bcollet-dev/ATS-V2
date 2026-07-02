"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { widgetConfigs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type WidgetConfig = {
  id: string;
  widgetType: string;
  posX: number;
  posY: number;
  width: number;
  height: number;
  config: Record<string, unknown> | null;
};

const DEFAULT_WIDGETS: Omit<WidgetConfig, "id" | "config">[] = [
  { widgetType: "relances",          posX: 0, posY: 0,  width: 8,  height: 5 },
  { widgetType: "taux_placement",    posX: 8, posY: 0,  width: 4,  height: 3 },
  { widgetType: "statuts_besoins",   posX: 0, posY: 5,  width: 6,  height: 4 },
  { widgetType: "besoins_perdus",    posX: 6, posY: 5,  width: 4,  height: 4 },
  { widgetType: "pipeline_cursus",   posX: 0, posY: 9,  width: 6,  height: 4 },
  { widgetType: "placements_classe", posX: 6, posY: 9,  width: 6,  height: 4 },
  { widgetType: "sources_lead",      posX: 0, posY: 13, width: 12, height: 4 },
];

export async function loadWidgetConfigs(): Promise<WidgetConfig[]> {
  const actor = await requireAuth();

  const rows = await db
    .select()
    .from(widgetConfigs)
    .where(eq(widgetConfigs.userId, actor.id));

  if (rows.length === 0) {
    const inserted = await db
      .insert(widgetConfigs)
      .values(DEFAULT_WIDGETS.map((w) => ({ ...w, userId: actor.id, config: null })))
      .returning();
    return inserted.map(toWidgetConfig);
  }

  return rows.map(toWidgetConfig);
}

export async function updateWidgetLayout(
  id: string,
  layout: { posX: number; posY: number; width: number; height: number }
): Promise<void> {
  const actor = await requireAuth();
  await db
    .update(widgetConfigs)
    .set({ ...layout, updatedAt: new Date() })
    .where(and(eq(widgetConfigs.id, id), eq(widgetConfigs.userId, actor.id)));
}

export async function addWidget(widgetType: string): Promise<WidgetConfig> {
  const actor = await requireAuth();

  const existing = await db
    .select({ posY: widgetConfigs.posY, height: widgetConfigs.height })
    .from(widgetConfigs)
    .where(eq(widgetConfigs.userId, actor.id));

  const bottomY = existing.reduce((max, w) => Math.max(max, w.posY + w.height), 0);

  const defaults = WIDGET_DEFAULTS[widgetType] ?? { width: 6, height: 4 };

  const [row] = await db
    .insert(widgetConfigs)
    .values({
      userId: actor.id,
      widgetType,
      posX: 0,
      posY: bottomY,
      width: defaults.width,
      height: defaults.height,
      config: null,
    })
    .returning();

  revalidatePath("/dashboard");
  return toWidgetConfig(row);
}

export async function deleteWidget(id: string): Promise<void> {
  const actor = await requireAuth();
  await db
    .delete(widgetConfigs)
    .where(and(eq(widgetConfigs.id, id), eq(widgetConfigs.userId, actor.id)));
  revalidatePath("/dashboard");
}

const WIDGET_DEFAULTS: Record<string, { width: number; height: number }> = {
  relances:          { width: 8,  height: 5 },
  taux_placement:    { width: 4,  height: 3 },
  statuts_besoins:   { width: 6,  height: 4 },
  besoins_perdus:    { width: 4,  height: 4 },
  pipeline_cursus:   { width: 6,  height: 4 },
  placements_classe: { width: 6,  height: 4 },
  sources_lead:      { width: 12, height: 4 },
};

function toWidgetConfig(row: typeof widgetConfigs.$inferSelect): WidgetConfig {
  return {
    id: row.id,
    widgetType: row.widgetType,
    posX: row.posX,
    posY: row.posY,
    width: row.width,
    height: row.height,
    config: (row.config as Record<string, unknown>) ?? null,
  };
}
