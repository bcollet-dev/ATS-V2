import { db } from "@/db";
import { activityEvents, profiles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  FileText, UserPlus, UserMinus, ArrowRightLeft,
  CheckSquare, ClipboardList, Settings, FileUp, FilePen, Mail,
} from "lucide-react";

const ACTION_ICONS: Record<string, React.ElementType> = {
  need_status_changed:    ArrowRightLeft,
  need_fields_updated:    Settings,
  need_cursus_updated:    Settings,
  matching_added:         UserPlus,
  matching_removed:       UserMinus,
  matching_status_changed: ArrowRightLeft,
  task_created:           ClipboardList,
  task_completed:         CheckSquare,
  fre_generated:          FileText,
  fre_imported:           FileUp,
  fre_fields_applied:     FilePen,
  email_sent:             Mail,
};

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} jours`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function absoluteDate(date: Date): string {
  return date.toLocaleString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export async function BlocHistorique({ needId }: { needId: string }) {
  const events = await db
    .select({
      id: activityEvents.id,
      actionType: activityEvents.actionType,
      summary: activityEvents.summary,
      createdAt: activityEvents.createdAt,
      actorName: profiles.fullName,
    })
    .from(activityEvents)
    .leftJoin(profiles, eq(activityEvents.actorId, profiles.id))
    .where(eq(activityEvents.needId, needId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(100);

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b">
        <h2 className="text-sm font-semibold">Historique</h2>
      </div>

      {events.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">Aucune activité pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="divide-y">
          {events.map((e) => {
            const Icon = ACTION_ICONS[e.actionType] ?? FileText;
            const date = new Date(e.createdAt);
            return (
              <div key={e.id} className="flex items-start gap-3 px-5 py-3">
                <div className="mt-0.5 rounded-md bg-muted p-1.5 shrink-0">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{e.summary}</p>
                  {e.actorName && (
                    <p className="text-xs text-muted-foreground mt-0.5">{e.actorName}</p>
                  )}
                </div>
                <time
                  dateTime={date.toISOString()}
                  title={absoluteDate(date)}
                  className="text-xs text-muted-foreground shrink-0 mt-0.5"
                >
                  {timeAgo(date)}
                </time>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
