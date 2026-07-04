import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { tasks, profiles } from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { sendDailyDigest } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron non configure" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeProfiles = await db
    .select({ id: profiles.id, email: profiles.email, fullName: profiles.fullName })
    .from(profiles)
    .where(and(eq(profiles.active, true), isNull(profiles.deletedAt)));

  let sent = 0;

  for (const profile of activeProfiles) {
    const pendingTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        category: tasks.category,
        dueAt: tasks.dueAt,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.assignedTo, profile.id),
          isNull(tasks.completedAt),
          isNull(tasks.deletedAt)
        )
      )
      .orderBy(asc(tasks.dueAt));

    if (pendingTasks.length === 0) continue;

    await sendDailyDigest({
      to: profile.email,
      name: profile.fullName || profile.email,
      tasks: pendingTasks.map((t) => ({
        title: t.title,
        category: t.category,
        dueAt: t.dueAt,
      })),
    });

    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
