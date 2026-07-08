"use server";

import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { sendSlackNotification, buildTestBlocks } from "@/lib/slack";

const GLOBAL_WEBHOOK_KEY = "slack_global_webhook";

export async function getGlobalSlackWebhook(): Promise<string | null> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, GLOBAL_WEBHOOK_KEY))
    .limit(1);
  const val = row?.value;
  return typeof val === "string" ? val : null;
}

export async function updateGlobalSlackWebhook(
  url: string,
): Promise<{ success: true } | { success: false; error: string }> {
  await requireAuth();

  const clean = url.trim() || null;
  if (clean && !clean.startsWith("https://hooks.slack.com/")) {
    return { success: false, error: "URL Slack invalide (doit commencer par https://hooks.slack.com/)" };
  }

  await db
    .insert(appSettings)
    .values({ key: GLOBAL_WEBHOOK_KEY, value: clean ?? "" })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: clean ?? "", updatedAt: new Date() },
    });

  return { success: true };
}

export async function testGlobalSlackWebhook(): Promise<{ success: true } | { success: false; error: string }> {
  await requireAuth();

  const url = await getGlobalSlackWebhook();
  if (!url) return { success: false, error: "Aucun webhook global configuré" };

  const result = await sendSlackNotification(url, buildTestBlocks("canal global"));
  if (!result.ok) return { success: false, error: result.error };
  return { success: true };
}
