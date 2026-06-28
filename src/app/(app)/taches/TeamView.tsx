"use client";

import { useMemo } from "react";
import { Users, Clock, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";
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
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

type PersonStats = {
  id: string;
  name: string;
  todo: number;
  overdue: number;
  done: number;
  nextTask: { title: string; dueAt: string } | null;
};

export function TeamView({
  tasks,
  onSelectPerson,
}: {
  tasks: TaskFull[];
  onSelectPerson: (id: string, name: string) => void;
}) {
  const people = useMemo<PersonStats[]>(() => {
    const map = new Map<string, PersonStats>();

    for (const task of tasks) {
      if (!task.assignedTo || !task.assigneeName) continue;
      if (!map.has(task.assignedTo)) {
        map.set(task.assignedTo, {
          id: task.assignedTo,
          name: task.assigneeName,
          todo: 0,
          overdue: 0,
          done: 0,
          nextTask: null,
        });
      }
      const p = map.get(task.assignedTo)!;
      const status = getStatus(task);
      if (status === "done") p.done++;
      else if (status === "overdue") p.overdue++;
      else p.todo++;

      // Track next due task (earliest non-completed)
      if (!task.completedAt) {
        if (!p.nextTask || task.dueAt < p.nextTask.dueAt) {
          p.nextTask = { title: task.title, dueAt: task.dueAt };
        }
      }
    }

    return [...map.values()].sort((a, b) => b.overdue - a.overdue || b.todo - a.todo);
  }, [tasks]);

  if (people.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-16 text-center">
        <Users className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-xs text-muted-foreground">Aucune tâche assignée à l'équipe</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {people.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelectPerson(p.id, p.name)}
          className={cn(
            "text-left rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-all hover:border-primary/30",
            p.overdue > 0 && "border-destructive/30"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold shrink-0",
              p.overdue > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            )}>
              {initials(p.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.todo + p.overdue} tâche{p.todo + p.overdue !== 1 ? "s" : ""} ouvertes</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 mb-3">
            <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">
              <Clock className="h-3 w-3" />
              {p.todo} à faire
            </span>
            {p.overdue > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-destructive bg-red-50 rounded-full px-2 py-0.5">
                <AlertTriangle className="h-3 w-3" />
                {p.overdue} en retard
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
              <CheckCircle2 className="h-3 w-3" />
              {p.done}
            </span>
          </div>

          {/* Next task */}
          {p.nextTask && (
            <div className="border-t pt-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">Prochaine échéance</p>
              <p className="text-xs font-medium truncate">{p.nextTask.title}</p>
              <p className={cn(
                "text-xs mt-0.5",
                new Date(p.nextTask.dueAt) < new Date() ? "text-destructive" : "text-muted-foreground"
              )}>
                {formatDate(p.nextTask.dueAt)}
              </p>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
