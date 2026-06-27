import { db } from "@/db";
import { activityEvents, profiles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { History, Pencil, ListTodo, RefreshCw, Trash2, UserPlus, ArrowRight } from "lucide-react";
import Link from "next/link";

const ACTION_META: Record<string, { Icon: React.FC<{ className?: string }>; color: string }> = {
  "candidate.created":  { Icon: UserPlus,   color: "text-emerald-600 bg-emerald-50" },
  "candidate.updated":  { Icon: Pencil,     color: "text-blue-600 bg-blue-50" },
  "task.created":       { Icon: ListTodo,   color: "text-orange-600 bg-orange-50" },
  "task.updated":       { Icon: RefreshCw,  color: "text-orange-600 bg-orange-50" },
  "task.deleted":       { Icon: Trash2,     color: "text-red-600 bg-red-50" },
};

function relativeDate(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (h < 24) return `il y a ${h}h`;
  if (days === 1) return "hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined });
}

export async function BlocHistorique({ candidateId }: { candidateId: string }) {
  const events = await db
    .select({
      id: activityEvents.id,
      actionType: activityEvents.actionType,
      summary: activityEvents.summary,
      createdAt: activityEvents.createdAt,
      actorName: profiles.fullName,
      actorEmail: profiles.email,
    })
    .from(activityEvents)
    .leftJoin(profiles, eq(activityEvents.actorId, profiles.id))
    .where(eq(activityEvents.candidateId, candidateId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(15);

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-5 py-3.5 border-b">
        <h2 className="text-sm font-semibold">Historique</h2>
        <Link
          href={`/historique?candidat=${candidateId}`}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Tout voir <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="px-5 py-6 text-sm text-center text-muted-foreground italic">Aucun événement</p>
      ) : (
        <div className="px-5 py-4">
          <ol className="relative border-l border-border ml-2 space-y-4">
            {events.map((ev) => {
              const meta = ACTION_META[ev.actionType] ?? { Icon: History, color: "text-muted-foreground bg-muted" };
              const Icon = meta.Icon;
              const actor = ev.actorName || ev.actorEmail || "Système";
              return (
                <li key={ev.id} className="ml-5">
                  <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-card ${meta.color}`}>
                    <Icon className="h-3 w-3" />
                  </span>
                  <p className="text-sm leading-snug">{ev.summary || ev.actionType}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {actor} · {relativeDate(ev.createdAt)}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
