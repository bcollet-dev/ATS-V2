"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { Users, Clock, CheckCircle2, AlertTriangle, Inbox, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskFull } from "./TaskSlideOver";

function getStatus(task: TaskFull) {
  if (task.completedAt) return "done";
  if (new Date(task.dueAt) < new Date()) return "overdue";
  return "todo";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
}

function isToday(iso: string) {
  const today = new Date();
  const due = new Date(iso);
  return today.toDateString() === due.toDateString();
}

function isTomorrow(iso: string) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const due = new Date(iso);
  return tomorrow.toDateString() === due.toDateString();
}

type PersonStats = {
  id: string | null;
  name: string;
  todo: number;
  overdue: number;
  done: number;
  today: number;
  tomorrow: number;
  nextTask: { title: string; dueAt: string } | null;
};

type Profile = { id: string; fullName: string; email: string };

function emptyStats(id: string | null, name: string): PersonStats {
  return { id, name, todo: 0, overdue: 0, done: 0, today: 0, tomorrow: 0, nextTask: null };
}

export function TeamView({
  tasks,
  profiles,
  onSelectPerson,
}: {
  tasks: TaskFull[];
  profiles: Profile[];
  onSelectPerson: (id: string | null, name: string) => void;
}) {
  const { people, totals, unassigned } = useMemo(() => {
    const peopleMap = new Map<string, PersonStats>();
    for (const profile of profiles) {
      peopleMap.set(profile.id, emptyStats(profile.id, profile.fullName));
    }

    const unassignedStats = emptyStats(null, "Non assignees");
    const totalStats = { open: 0, overdue: 0, unassigned: 0, today: 0, collaborators: profiles.length };

    for (const task of tasks) {
      const status = getStatus(task);
      const open = status !== "done";
      if (open) {
        totalStats.open++;
        if (isToday(task.dueAt)) totalStats.today++;
      }
      if (status === "overdue") totalStats.overdue++;

      const stats = task.assignedTo
        ? peopleMap.get(task.assignedTo) ?? emptyStats(task.assignedTo, task.assigneeName ?? "Collaborateur inconnu")
        : unassignedStats;

      if (task.assignedTo && !peopleMap.has(task.assignedTo)) peopleMap.set(task.assignedTo, stats);

      if (!task.assignedTo && open) totalStats.unassigned++;

      if (status === "done") stats.done++;
      else if (status === "overdue") stats.overdue++;
      else stats.todo++;

      if (open) {
        if (isToday(task.dueAt)) stats.today++;
        if (isTomorrow(task.dueAt)) stats.tomorrow++;
        if (!stats.nextTask || task.dueAt < stats.nextTask.dueAt) {
          stats.nextTask = { title: task.title, dueAt: task.dueAt };
        }
      }
    }

    const sortedPeople = [...peopleMap.values()]
      .sort((a, b) =>
        b.overdue - a.overdue ||
        b.today - a.today ||
        b.todo - a.todo ||
        a.name.localeCompare(b.name)
      );

    return {
      people: sortedPeople,
      totals: totalStats,
      unassigned: unassignedStats.todo + unassignedStats.overdue > 0 ? unassignedStats : null,
    };
  }, [tasks, profiles]);

  const cards = unassigned ? [unassigned, ...people] : people;

  return (
    <section className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div>
          <h2 className="text-sm font-semibold">Pilotage equipe</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vue compacte pour {totals.collaborators} collaborateurs, retards et prochaines echeances
          </p>
        </div>
        <span className="hidden sm:inline-flex rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          Direction
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 border-y bg-background/60 divide-x divide-y lg:divide-y-0">
        <Kpi label="Collaborateurs" value={totals.collaborators} Icon={Users} className="text-slate-700 bg-slate-100" />
        <Kpi label="Ouvertes" value={totals.open} Icon={Inbox} className="text-blue-700 bg-blue-50" />
        <Kpi label="En retard" value={totals.overdue} Icon={AlertTriangle} className="text-red-700 bg-red-50" />
        <Kpi label="Non assignees" value={totals.unassigned} Icon={Users} className="text-violet-700 bg-violet-50" />
        <Kpi label="Aujourd'hui" value={totals.today} Icon={CalendarDays} className="text-amber-700 bg-amber-50" />
      </div>

      {cards.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <Users className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">Aucun collaborateur actif a afficher</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Collaborateur</th>
                <th className="px-3 py-2.5 text-left font-medium">Statut</th>
                <th className="px-3 py-2.5 text-right font-medium">Ouvertes</th>
                <th className="px-3 py-2.5 text-right font-medium">Retard</th>
                <th className="px-3 py-2.5 text-right font-medium">Ajd.</th>
                <th className="px-3 py-2.5 text-right font-medium">Demain</th>
                <th className="px-3 py-2.5 text-left font-medium">Prochaine echeance</th>
                <th className="px-4 py-2.5 text-right font-medium">Terminees</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cards.map((person) => (
                <TeamRow
                  key={person.id ?? "unassigned"}
                  person={person}
                  onSelect={() => onSelectPerson(person.id, person.name)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Kpi({
  label,
  value,
  Icon,
  className,
}: {
  label: string;
  value: number;
  Icon: React.FC<{ className?: string }>;
  className: string;
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md", className)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div>
          <p className="text-lg font-semibold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}

function TeamRow({ person, onSelect }: { person: PersonStats; onSelect: () => void }) {
  const open = person.todo + person.overdue;
  const status = getPersonStatus(person);
  const overdue = person.overdue > 0;
  const noOpenTasks = open === 0;

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "cursor-pointer transition-colors hover:bg-muted/30 focus-within:bg-muted/30",
        person.id === null && "bg-violet-50/40",
        overdue && "bg-red-50/30"
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold shrink-0",
            person.id === null ? "bg-violet-100 text-violet-700"
            : overdue ? "bg-destructive/10 text-destructive"
            : noOpenTasks ? "bg-emerald-50 text-emerald-700"
            : "bg-primary/10 text-primary"
          )}>
            {person.id === null ? "NA" : initials(person.name)}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{person.name}</p>
            <p className="text-xs text-muted-foreground">{open} tache{open > 1 ? "s" : ""} ouverte{open > 1 ? "s" : ""}</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <Badge className={status.className}>
          <status.Icon className="h-3 w-3" />
          {status.label}
        </Badge>
      </td>
      <td className="px-3 py-3 text-right font-medium">{open}</td>
      <td className={cn("px-3 py-3 text-right", overdue && "text-destructive font-semibold")}>{person.overdue}</td>
      <td className="px-3 py-3 text-right">{person.today}</td>
      <td className="px-3 py-3 text-right">{person.tomorrow}</td>
      <td className="px-3 py-3">
        {person.nextTask ? (
          <div className="min-w-0">
            <p className="font-medium truncate max-w-[260px]">{person.nextTask.title}</p>
            <p className={cn(
              "text-xs mt-0.5",
              new Date(person.nextTask.dueAt) < new Date() ? "text-destructive" : "text-muted-foreground"
            )}>
              {formatDate(person.nextTask.dueAt)}
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground">Aucune echeance</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-muted-foreground">{person.done}</td>
    </tr>
  );
}

function getPersonStatus(person: PersonStats): {
  label: string;
  className: string;
  Icon: React.FC<{ className?: string }>;
} {
  if (person.overdue > 0) {
    return { label: "Priorite", className: "text-destructive bg-red-50", Icon: AlertTriangle };
  }
  if (person.today > 0) {
    return { label: "Aujourd'hui", className: "text-amber-700 bg-amber-50", Icon: CalendarDays };
  }
  if (person.todo > 0 || person.tomorrow > 0) {
    return { label: "En cours", className: "text-blue-700 bg-blue-50", Icon: Clock };
  }
  return { label: "A jour", className: "text-emerald-700 bg-emerald-50", Icon: CheckCircle2 };
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs", className)}>
      {children}
    </span>
  );
}
