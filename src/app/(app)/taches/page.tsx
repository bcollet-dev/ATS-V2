import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { tasks, profiles, candidates, companies } from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { MarkNotificationsRead } from "./MarkNotificationsRead";
import { KanbanBoard } from "./KanbanBoard";

export default async function TachesPage() {
  const user = await requireAuth();
  const isManager = user.role === "admin" || user.role === "team_leader" || user.role === "direction";

  const whereClause = isManager
    ? isNull(tasks.deletedAt)
    : and(isNull(tasks.deletedAt), eq(tasks.assignedTo, user.id));

  const [rows, activeProfiles] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        category: tasks.category,
        description: tasks.description,
        dueAt: tasks.dueAt,
        completedAt: tasks.completedAt,
        assigneeName: profiles.fullName,
        assignedTo: tasks.assignedTo,
        candidateId: tasks.candidateId,
        candidateFirstName: candidates.firstName,
        candidateLastName: candidates.lastName,
        companyId: tasks.companyId,
        companyName: companies.name,
      })
      .from(tasks)
      .leftJoin(profiles, eq(tasks.assignedTo, profiles.id))
      .leftJoin(candidates, eq(tasks.candidateId, candidates.id))
      .leftJoin(companies, eq(tasks.companyId, companies.id))
      .where(whereClause)
      .orderBy(asc(tasks.dueAt)),
    db
      .select({ id: profiles.id, fullName: profiles.fullName, email: profiles.email })
      .from(profiles)
      .where(and(eq(profiles.active, true), isNull(profiles.deletedAt)))
      .orderBy(asc(profiles.fullName)),
  ]);

  const serialized = rows.map((r) => ({
    ...r,
    dueAt: r.dueAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
    assigneeName: r.assigneeName ?? null,
    assignedTo: r.assignedTo ?? null,
    candidateFirstName: r.candidateFirstName ?? null,
    candidateLastName: r.candidateLastName ?? null,
    companyName: r.companyName ?? null,
  }));

  return (
    <div className="p-6 max-w-6xl">
      <MarkNotificationsRead userId={user.id} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Tâches</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isManager ? "Toutes les tâches de l'équipe" : "Mes tâches assignées"}
        </p>
      </div>

      <KanbanBoard tasks={serialized} profiles={activeProfiles} />
    </div>
  );
}
