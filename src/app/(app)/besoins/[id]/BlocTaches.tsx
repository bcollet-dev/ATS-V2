"use client";

import { useTransition, useOptimistic, useState } from "react";
import { cn } from "@/lib/utils";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createNeedTask, completeNeedTask, type TaskRow } from "./actions";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  call:              "Appel",
  email:             "Email",
  document:          "Document",
  follow_up:         "Suivi",
  interview:         "Entretien",
  other:             "Autre",
  video_interview:   "Visio",
  onsite_interview:  "Entretien site",
  administrative:    "Administratif",
};

const CATEGORY_BADGE: Record<string, string> = {
  call:             "bg-blue-100 text-blue-700",
  email:            "bg-violet-100 text-violet-700",
  document:         "bg-amber-100 text-amber-700",
  follow_up:        "bg-slate-100 text-slate-700",
  interview:        "bg-orange-100 text-orange-700",
  other:            "bg-gray-100 text-gray-600",
  video_interview:  "bg-teal-100 text-teal-700",
  onsite_interview: "bg-rose-100 text-rose-700",
  administrative:   "bg-indigo-100 text-indigo-700",
};

const CATEGORIES = [
  "call",
  "email",
  "document",
  "follow_up",
  "interview",
  "video_interview",
  "onsite_interview",
  "administrative",
  "other",
] as const;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Quick-add Form ────────────────────────────────────────────────────────────

function QuickAddForm({
  needId,
  profiles,
  onAdd,
}: {
  needId: string;
  profiles: { id: string; name: string }[];
  onAdd: (task: TaskRow) => void;
}) {
  const [, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("follow_up");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueAt, setDueAt] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueAt) return;

    const assignedName =
      profiles.find((p) => p.id === assignedTo)?.name ?? null;

    const optimisticTask: TaskRow = {
      id: crypto.randomUUID(),
      title: title.trim(),
      category,
      dueAt: new Date(dueAt).toISOString(),
      completedAt: null,
      assignedName,
    };

    const snapshot = { title: title.trim(), category, assignedTo, dueAt };

    setTitle("");
    setCategory("follow_up");
    setAssignedTo("");
    setDueAt("");

    startTransition(async () => {
      onAdd(optimisticTask);
      await createNeedTask(needId, {
        title: snapshot.title,
        category: snapshot.category,
        assignedTo: snapshot.assignedTo || undefined,
        dueAt: snapshot.dueAt,
      });
    });
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 py-4 border-t space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          required
          placeholder="Titre de la tâche"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0"
        />
        <input
          type="date"
          required
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        {profiles.length > 0 && (
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring min-w-0"
          >
            <option value="">Non assigné</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <Button type="submit" size="sm" className="gap-1.5 h-8 text-xs shrink-0">
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </Button>
      </div>
    </form>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function BlocTaches({
  needId,
  initialTasks,
  profiles,
  canEdit,
}: {
  needId: string;
  initialTasks: TaskRow[];
  profiles: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [, startTransition] = useTransition();

  const sorted = [...initialTasks].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  );

  const [taskList, setOptimistic] = useOptimistic(
    sorted,
    (
      state,
      action:
        | { type: "add"; task: TaskRow }
        | { type: "complete"; id: string }
    ) => {
      if (action.type === "add") {
        const next = [...state, action.task];
        next.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
        return next;
      }
      return state.map((t) =>
        t.id === action.id
          ? { ...t, completedAt: new Date().toISOString() }
          : t
      );
    }
  );

  function handleAdd(task: TaskRow) {
    setOptimistic({ type: "add", task });
  }

  function handleComplete(taskId: string) {
    startTransition(async () => {
      setOptimistic({ type: "complete", id: taskId });
      await completeNeedTask(taskId, needId);
    });
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-5 py-3.5 border-b">
        <h2 className="text-sm font-semibold">
          Tâches
          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground min-w-[1.25rem]">
            {taskList.length}
          </span>
        </h2>
      </div>

      {taskList.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">Aucune tâche sur ce besoin.</p>
        </div>
      ) : (
        <div className="divide-y">
          {taskList.map((task) => {
            const done = !!task.completedAt;
            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-3 px-5 py-3",
                  done && "opacity-50"
                )}
              >
                {canEdit && (
                  <button
                    disabled={done}
                    onClick={() => !done && handleComplete(task.id)}
                    title={done ? "Tâche complétée" : "Marquer comme complétée"}
                    className={cn(
                      "h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors",
                      done
                        ? "bg-primary border-primary cursor-default"
                        : "border-input hover:border-primary"
                    )}
                  >
                    {done && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      done && "line-through text-muted-foreground"
                    )}
                  >
                    {task.title}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        CATEGORY_BADGE[task.category] ?? "bg-gray-100 text-gray-600"
                      )}
                    >
                      {CATEGORY_LABELS[task.category] ?? task.category}
                    </span>
                    {task.assignedName && (
                      <span className="text-xs text-muted-foreground">
                        {task.assignedName}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(task.dueAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canEdit && (
        <QuickAddForm needId={needId} profiles={profiles} onAdd={handleAdd} />
      )}
    </section>
  );
}
