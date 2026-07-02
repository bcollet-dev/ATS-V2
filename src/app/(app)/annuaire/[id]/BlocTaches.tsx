"use client";

import { useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Loader2, Phone, Mail, FileText,
  RefreshCw, Users, MoreHorizontal, CheckCircle2, Circle, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalClose, ModalBody, ModalFooter } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  createCompanyTask, updateCompanyTask, toggleCompanyTask, deleteCompanyTask,
} from "./task-actions";

type TaskCategory = "call" | "email" | "document" | "follow_up" | "interview" | "other";

type TaskInput = {
  title: string;
  category: TaskCategory;
  note: string;
  dueAt: string;
  assignedTo: string;
};

type CompanyTaskRow = {
  id: string;
  title: string;
  category: string;
  note: string | null;
  dueAt: string;
  completedAt: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  attachments: {
    entityType: "candidate" | "company";
    entityId: string;
    label: string;
    href: string;
  }[];
};

const CATEGORIES: { value: TaskCategory; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { value: "call",       label: "Appel",     Icon: Phone },
  { value: "email",      label: "Email",     Icon: Mail },
  { value: "document",   label: "Document",  Icon: FileText },
  { value: "follow_up",  label: "Relance",   Icon: RefreshCw },
  { value: "interview",  label: "Entretien", Icon: Users },
  { value: "other",      label: "Autre",     Icon: MoreHorizontal },
];
const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.value, c]));

const SELECT_CLASS = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
  "focus:outline-none focus:ring-1 focus:ring-ring"
);

const EMPTY: TaskInput = { title: "", category: "call", note: "", dueAt: "", assignedTo: "" };

type ProfileOption = { id: string; fullName: string; email: string };
type DialogState = { open: false } | { open: true; mode: "add" } | { open: true; mode: "edit"; task: CompanyTaskRow };

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function toDateInput(iso: string) { return iso.slice(0, 10); }

function isOverdue(iso: string, completedAt: string | null) {
  if (completedAt) return false;
  return new Date(iso) < new Date();
}

export function BlocTaches({
  companyId,
  companyName,
  initialTasks,
  profiles,
  currentUserId,
  canEdit,
}: {
  companyId: string;
  companyName: string;
  initialTasks: CompanyTaskRow[];
  profiles: ProfileOption[];
  currentUserId: string;
  canEdit: boolean;
}) {
  const [taskList, setTaskList] = useState<CompanyTaskRow[]>(initialTasks);
  const [showDone, setShowDone] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ open: false });
  const [isSaving, startSave] = useTransition();
  const { register, handleSubmit, control, reset } = useForm<TaskInput>({ defaultValues: EMPTY });

  const openTasks = taskList
    .filter((t) => !t.completedAt)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  const doneTasks = taskList
    .filter((t) => t.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

  function openAdd() { reset({ ...EMPTY, assignedTo: currentUserId }); setDialog({ open: true, mode: "add" }); }
  function openEdit(task: CompanyTaskRow) {
    reset({ title: task.title, category: task.category as TaskCategory, note: task.note ?? "", dueAt: toDateInput(task.dueAt), assignedTo: task.assignedTo ?? "" });
    setDialog({ open: true, mode: "edit", task });
  }
  function close() { setDialog({ open: false }); }

  function enrichName(row: CompanyTaskRow): CompanyTaskRow {
    const p = profiles.find((p) => p.id === row.assignedTo);
    return { ...row, assigneeName: p ? (p.fullName || p.email) : null };
  }

  function onSubmit(values: TaskInput) {
    startSave(async () => {
      if (dialog.open && dialog.mode === "add") {
        const res = await createCompanyTask(companyId, companyName, values);
        if (!res.success || !res.data) { toast.error(res.error); return; }
        setTaskList((prev) => [...prev, enrichName(res.data!)]);
        toast.success("Tâche créée");
      } else if (dialog.open && dialog.mode === "edit") {
        const res = await updateCompanyTask(dialog.task.id, companyId, values);
        if (!res.success || !res.data) { toast.error(res.error); return; }
        setTaskList((prev) => prev.map((t) => t.id === dialog.task.id ? enrichName(res.data!) : t));
        toast.success("Tâche mise à jour");
      }
      close();
    });
  }

  function handleToggle(task: CompanyTaskRow) {
    const wasDone = !!task.completedAt;
    setTaskList((prev) => prev.map((t) =>
      t.id === task.id ? { ...t, completedAt: wasDone ? null : new Date().toISOString() } : t
    ));
    startSave(async () => {
      const res = await toggleCompanyTask(task.id, companyId, wasDone);
      if (!res.success) { setTaskList((prev) => prev.map((t) => t.id === task.id ? task : t)); toast.error(res.error); }
    });
  }

  function handleDelete(task: CompanyTaskRow) {
    setTaskList((prev) => prev.filter((t) => t.id !== task.id));
    let cancelled = false;
    const timerId = setTimeout(async () => {
      if (!cancelled) {
        const res = await deleteCompanyTask(task.id, companyId, task.title);
        if (!res.success) { setTaskList((prev) => [...prev, task]); toast.error(res.error); }
      }
    }, 4000);
    toast(`"${task.title}" supprimée`, {
      action: { label: "Annuler", onClick: () => { cancelled = true; clearTimeout(timerId); setTaskList((prev) => [...prev, task]); } },
      duration: 4000,
    });
  }

  function TaskItem({ task }: { task: CompanyTaskRow }) {
    const done = !!task.completedAt;
    const overdue = isOverdue(task.dueAt, task.completedAt);
    const cat = CATEGORY_MAP[task.category];
    const Icon = cat?.Icon ?? MoreHorizontal;
    return (
      <div className={cn("px-5 py-3 flex items-start gap-3 group", done && "opacity-60")}>
        <button
          onClick={() => canEdit && handleToggle(task)}
          className={cn("mt-0.5 shrink-0 text-muted-foreground transition-colors", canEdit && "hover:text-primary")}
          disabled={!canEdit}
        >
          {done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={cn("text-sm leading-tight", done && "line-through")}>{task.title}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Icon className="h-3 w-3" />{cat?.label ?? task.category}
                </span>
                {task.assigneeName && <span className="text-xs text-muted-foreground">· {task.assigneeName}</span>}
                <span className={cn("text-xs", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                  · {formatDueDate(task.dueAt)}{overdue && " (en retard)"}
                </span>
              </div>
              {task.note && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.note}</p>}
              {task.attachments.length > 1 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {task.attachments
                    .filter((attachment) => !(attachment.entityType === "company" && attachment.entityId === companyId))
                    .slice(0, 3)
                    .map((attachment) => (
                      <span key={`${attachment.entityType}:${attachment.entityId}`} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {attachment.entityType === "candidate" ? "Candidat" : "Entreprise"} - {attachment.label}
                      </span>
                    ))}
                </div>
              )}
            </div>
            {canEdit && !done && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={() => openEdit(task)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(task)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="rounded-lg border bg-card">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <h2 className="text-sm font-semibold">
            Tâches
            {openTasks.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium w-5 h-5">
                {openTasks.length}
              </span>
            )}
          </h2>
          {canEdit && (
            <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />Ajouter
            </Button>
          )}
        </div>

        {openTasks.length === 0 && doneTasks.length === 0 ? (
          <p className="px-5 py-6 text-sm text-center text-muted-foreground italic">Aucune tâche</p>
        ) : (
          <>
            <div className="divide-y">{openTasks.map((t) => <TaskItem key={t.id} task={t} />)}</div>
            {doneTasks.length > 0 && (
              <div className="border-t">
                <button
                  onClick={() => setShowDone((v) => !v)}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  {showDone ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {doneTasks.length} tâche{doneTasks.length > 1 ? "s" : ""} terminée{doneTasks.length > 1 ? "s" : ""}
                </button>
                {showDone && (
                  <div className="divide-y border-t">{doneTasks.map((t) => <TaskItem key={t.id} task={t} />)}</div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <Modal open={dialog.open} onOpenChange={(open) => { if (!open) close(); }}>
        <ModalContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalHeader>
              <ModalTitle>{dialog.open && dialog.mode === "edit" ? "Modifier la tâche" : "Nouvelle tâche"}</ModalTitle>
              <ModalClose />
            </ModalHeader>
            <ModalBody>
              <div className="space-y-1.5">
                <Label htmlFor="tk-title">Titre *</Label>
                <Input id="tk-title" {...register("title", { required: true })} placeholder="Ex : Appeler le RH" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tk-category">Catégorie *</Label>
                  <Controller name="category" control={control} render={({ field }) => (
                    <select {...field} id="tk-category" className={SELECT_CLASS}>
                      {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  )} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tk-due">Échéance *</Label>
                  <Input id="tk-due" type="date" {...register("dueAt", { required: true })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tk-assignee">Assigné à *</Label>
                <Controller name="assignedTo" control={control} render={({ field }) => (
                  <select {...field} id="tk-assignee" className={SELECT_CLASS}>
                    <option value="">— Choisir —</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.fullName || p.email}</option>)}
                  </select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tk-note">Note <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
                <Controller name="note" control={control} render={({ field }) => (
                  <Textarea id="tk-note" {...field} rows={2} placeholder="Contexte, détails…" />
                )} />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="outline" size="sm" onClick={close} disabled={isSaving}>Annuler</Button>
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Enregistrement…</> : "Enregistrer"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
