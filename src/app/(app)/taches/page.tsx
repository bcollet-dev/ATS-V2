import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { tasks, profiles, candidates } from "@/db/schema";
import { eq, isNull, and, asc, or } from "drizzle-orm";
import { CheckCircle2, Circle, Phone, Mail, FileText, RefreshCw, Users, MoreHorizontal } from "lucide-react";
import { MarkNotificationsRead } from "./MarkNotificationsRead";

const CATEGORY_LABELS: Record<string, string> = {
  call: "Appel", email: "Email", document: "Document",
  follow_up: "Relance", interview: "Entretien", other: "Autre",
};

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  call: Phone, email: Mail, document: FileText,
  follow_up: RefreshCw, interview: Users, other: MoreHorizontal,
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(dueAt: Date): boolean {
  return dueAt < new Date();
}

export default async function TachesPage() {
  const user = await requireAuth();
  const isManager = user.role === "admin" || user.role === "team_leader";

  const whereClause = isManager
    ? isNull(tasks.deletedAt)
    : and(isNull(tasks.deletedAt), eq(tasks.assignedTo, user.id));

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      category: tasks.category,
      description: tasks.description,
      dueAt: tasks.dueAt,
      completedAt: tasks.completedAt,
      assigneeName: profiles.fullName,
      candidateId: tasks.candidateId,
      candidateFirstName: candidates.firstName,
      candidateLastName: candidates.lastName,
    })
    .from(tasks)
    .leftJoin(profiles, eq(tasks.assignedTo, profiles.id))
    .leftJoin(candidates, eq(tasks.candidateId, candidates.id))
    .where(whereClause)
    .orderBy(asc(tasks.completedAt), asc(tasks.dueAt));

  const openTasks = rows.filter((r) => !r.completedAt);
  const doneTasks = rows.filter((r) => r.completedAt);

  return (
    <div className="p-6 max-w-4xl">
      <MarkNotificationsRead userId={user.id} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Tâches</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isManager ? "Toutes les tâches de l'équipe" : "Mes tâches assignées"}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-card px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground italic">Aucune tâche pour le moment</p>
        </div>
      ) : (
        <div className="space-y-6">
          {openTasks.length > 0 && (
            <section>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                À faire · {openTasks.length}
              </h2>
              <div className="rounded-lg border bg-card divide-y">
                {openTasks.map((task) => {
                  const overdue = isOverdue(task.dueAt);
                  const Icon = CATEGORY_ICONS[task.category] ?? MoreHorizontal;
                  const candidateName = task.candidateFirstName
                    ? `${task.candidateFirstName} ${task.candidateLastName}`
                    : null;
                  return (
                    <div key={task.id} className="px-5 py-3 flex items-start gap-3">
                      <Circle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-tight">{task.title}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Icon className="h-3 w-3" />
                            {CATEGORY_LABELS[task.category] ?? task.category}
                          </span>
                          {candidateName && (
                            <a
                              href={`/candidats/${task.candidateId}`}
                              className="text-xs text-primary hover:underline"
                            >
                              · {candidateName}
                            </a>
                          )}
                          {task.assigneeName && (
                            <span className="text-xs text-muted-foreground">· {task.assigneeName}</span>
                          )}
                          <span className={`text-xs ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            · {formatDate(task.dueAt)}{overdue ? " (en retard)" : ""}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {doneTasks.length > 0 && (
            <section>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Terminées · {doneTasks.length}
              </h2>
              <div className="rounded-lg border bg-card divide-y opacity-70">
                {doneTasks.map((task) => {
                  const Icon = CATEGORY_ICONS[task.category] ?? MoreHorizontal;
                  const candidateName = task.candidateFirstName
                    ? `${task.candidateFirstName} ${task.candidateLastName}`
                    : null;
                  return (
                    <div key={task.id} className="px-5 py-3 flex items-start gap-3">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-tight line-through text-muted-foreground">{task.title}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Icon className="h-3 w-3" />
                            {CATEGORY_LABELS[task.category] ?? task.category}
                          </span>
                          {candidateName && (
                            <a href={`/candidats/${task.candidateId}`} className="text-xs text-primary hover:underline">
                              · {candidateName}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
