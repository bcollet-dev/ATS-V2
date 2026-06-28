"use client";

import { useState } from "react";
import {
  Phone, Mail, FileText, RefreshCw, Users, MoreHorizontal,
  Circle, CheckCircle2, Clock, ListTodo, LayoutGrid, List, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TaskSlideOver, type TaskFull } from "./TaskSlideOver";
import { CreateTaskModal } from "./CreateTaskModal";
import { ListView } from "./ListView";

type Profile = { id: string; fullName: string; email: string };

const CATEGORY_LABELS: Record<string, string> = {
  call: "Appel", email: "Email", document: "Document",
  follow_up: "Relance", interview: "Entretien", other: "Autre",
};

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  call: Phone, email: Mail, document: FileText,
  follow_up: RefreshCw, interview: Users, other: MoreHorizontal,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function TaskCard({ task, onClick }: { task: TaskFull; onClick: () => void }) {
  const Icon = CATEGORY_ICONS[task.category] ?? MoreHorizontal;
  const overdue = !task.completedAt && new Date(task.dueAt) < new Date();
  const done = !!task.completedAt;
  const entityName = task.candidateFirstName
    ? `${task.candidateFirstName} ${task.candidateLastName}`
    : task.companyName ?? null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border bg-card p-4 space-y-2.5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
    >
      <div className="flex items-start gap-2.5">
        {done
          ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
          : <Circle className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        }
        <p className={cn("text-sm font-medium leading-tight flex-1", done && "line-through text-muted-foreground")}>
          {task.title}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-6">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Icon className="h-3 w-3" />
          {CATEGORY_LABELS[task.category] ?? task.category}
        </span>
        {entityName && (
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">· {entityName}</span>
        )}
        {task.assigneeName && (
          <span className="text-xs text-muted-foreground">· {task.assigneeName}</span>
        )}
      </div>

      <div className="pl-6">
        {done ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
            <Clock className="h-3 w-3" />
            Terminé le {formatDate(task.completedAt!)}
          </span>
        ) : (
          <span className={cn("inline-flex items-center gap-1 text-xs", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
            <Clock className="h-3 w-3" />
            {overdue ? "En retard · " : ""}{formatDate(task.dueAt)}
          </span>
        )}
      </div>
    </button>
  );
}

function EmptyCol({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-12 text-center">
      <ListTodo className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
      <p className="text-xs text-muted-foreground">Aucune tâche {label}</p>
    </div>
  );
}

type Tab = "todo" | "overdue" | "done";
type ViewMode = "kanban" | "list";

export function KanbanBoard({ tasks, profiles }: { tasks: TaskFull[]; profiles: Profile[] }) {
  const [tab, setTab] = useState<Tab>("todo");
  const [view, setView] = useState<ViewMode>("kanban");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<TaskFull | null>(null);
  const now = new Date();

  const todo    = tasks.filter((t) => !t.completedAt && new Date(t.dueAt) >= now);
  const overdue = tasks.filter((t) => !t.completedAt && new Date(t.dueAt) < now);
  const done    = tasks.filter((t) => !!t.completedAt);

  const tabs: { key: Tab; label: string; count: number; activeClass: string }[] = [
    { key: "todo",    label: "À faire",   count: todo.length,    activeClass: "border-blue-500 text-blue-600" },
    { key: "overdue", label: "En retard", count: overdue.length, activeClass: "border-destructive text-destructive" },
    { key: "done",    label: "Terminé",   count: done.length,    activeClass: "border-emerald-500 text-emerald-700" },
  ];

  const badgeClass = (key: Tab, active: boolean) =>
    active
      ? key === "todo"    ? "bg-blue-100 text-blue-700"
      : key === "overdue" ? "bg-red-100 text-red-700"
      :                     "bg-emerald-100 text-emerald-700"
      : "bg-muted text-muted-foreground";

  const current = tab === "todo" ? todo : tab === "overdue" ? overdue : done;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-6">
        {/* Tab bar */}
        <div className="flex border-b flex-1">
          {tabs.map(({ key, label, count, activeClass }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === key ? activeClass : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              <span className={cn(
                "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[1.25rem]",
                badgeClass(key, tab === key)
              )}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* View toggle + CTA */}
        <div className="flex items-center gap-2 pb-px">
          <div className="flex rounded-md border p-0.5 bg-muted/40">
            <button
              onClick={() => setView("kanban")}
              className={cn("rounded p-1.5 transition-colors", view === "kanban" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              title="Vue Kanban"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn("rounded p-1.5 transition-colors", view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              title="Vue Liste"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Nouvelle tâche
          </Button>
        </div>
      </div>

      {/* Content */}
      {view === "list" ? (
        <ListView tasks={tasks} onSelect={setSelected} />
      ) : current.length === 0 ? (
        <EmptyCol label={tab === "todo" ? "à faire" : tab === "overdue" ? "en retard" : "terminée"} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {current.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => setSelected(task)} />
          ))}
        </div>
      )}

      {/* Slide-over */}
      {selected && (
        <TaskSlideOver
          task={selected}
          profiles={profiles}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Create modal */}
      <CreateTaskModal open={createOpen} onClose={() => setCreateOpen(false)} profiles={profiles} />
    </div>
  );
}
