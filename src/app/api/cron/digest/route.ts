import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { tasks, profiles } from "@/db/schema";
import { eq, isNull, isNotNull, and, or, asc } from "drizzle-orm";
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
    .select({ id: profiles.id, email: profiles.email, fullName: profiles.fullName, role: profiles.role })
    .from(profiles)
    .where(and(eq(profiles.active, true), isNull(profiles.deletedAt)));

  // Tâches orphelines : ouvertes mais sans assigné valide (assigné supprimé →
  // assignedTo NULL, ou compte désactivé/supprimé). Sinon elles disparaissent de
  // tous les tableaux de bord. On les remonte dans le digest de l'encadrement.
  const orphanTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      category: tasks.category,
      dueAt: tasks.dueAt,
    })
    .from(tasks)
    .leftJoin(profiles, eq(tasks.assignedTo, profiles.id))
    .where(
      and(
        isNull(tasks.completedAt),
        isNull(tasks.deletedAt),
        or(
          isNull(tasks.assignedTo),
          eq(profiles.active, false),
          isNotNull(profiles.deletedAt),
        ),
      ),
    )
    .orderBy(asc(tasks.dueAt))
    .limit(100);

  let sent = 0;
  let failed = 0;

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

    const isLeadership = profile.role === "admin" || profile.role === "direction";
    const digestTasks = isLeadership ? [...pendingTasks, ...orphanTasks] : pendingTasks;

    if (digestTasks.length === 0) continue;

    // Un échec d'envoi ne doit pas interrompre les autres, ni faire renvoyer 500
    // (Vercel rejouerait le cron → doublons d'emails pour les déjà servis).
    try {
      await sendDailyDigest({
        to: profile.email,
        name: profile.fullName || profile.email,
        tasks: digestTasks.map((t) => ({
          title: t.title,
          category: t.category,
          dueAt: t.dueAt,
        })),
      });
      sent++;
    } catch (error) {
      failed++;
      console.error(`Digest quotidien échoué pour ${profile.email}`, error);
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}
