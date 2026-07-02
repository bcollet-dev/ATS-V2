"use client";

import { useState, useTransition, useRef } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  X, CheckCircle2, Circle, Pencil, Trash2, Loader2,
  Phone, Mail, FileText, RefreshCw, Users, MoreHorizontal, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toggleGlobalTask, updateGlobalTask, deleteGlobalTask } from "./actions";

export type TaskFull = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  dueAt: string;
  completedAt: string | null;
  assigneeName: string | null;
  assignedTo: string | null;
  attachments: {
    entityType: "candidate" | "company";
    entityId: string;
    label: string;
    href: string;
  }[];
};

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
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

export function TaskSlideOver({
  task,
  profiles,
  open,
  onClose,
}: {
  task: TaskFull;
  profiles: Profile[];
  open: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(true);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const Icon = CATEGORY_ICONS[task.category] ?? MoreHorizontal;

  function handleToggle() {
    startTransition(async () => {
      await toggleGlobalTask(task.id);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteGlobalTask(task.id);
      onClose();
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    startTransition(async () => {
      await updateGlobalTask(task.id, fd);
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) { setEditing(true); onClose(); } }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 duration-200" />
        <Dialog.Popup className={cn(
          "fixed right-0 top-0 z-50 h-full w-full max-w-md bg-background shadow-xl flex flex-col",
          "data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right duration-300"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[task.category] ?? task.category}</span>
            </div>
            <div className="flex items-center gap-1">
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              <Dialog.Close className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {editing ? (
              <form ref={formRef} onSubmit={handleSave} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="so-title">Titre</Label>
                  <Input id="so-title" name="title" defaultValue={task.title} required />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="so-category">Catégorie</Label>
                  <select
                    id="so-category"
                    name="category"
                    defaultValue={task.category}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="so-description">Note</Label>
                  <textarea
                    id="so-description"
                    name="description"
                    defaultValue={task.description ?? ""}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="so-due">Échéance</Label>
                  <Input id="so-due" name="dueAt" type="date" defaultValue={formatDateInput(task.dueAt)} required />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="so-assignee">Assigné à</Label>
                  <select
                    id="so-assignee"
                    name="assignedTo"
                    defaultValue={task.assignedTo ?? ""}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Non assigné</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.fullName || p.email}</option>
                    ))}
                  </select>
                </div>

                {task.attachments.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Rattachements</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {task.attachments.map((attachment) => (
                        <a
                          key={`${attachment.entityType}:${attachment.entityId}`}
                          href={attachment.href}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-accent"
                        >
                          {attachment.entityType === "candidate" ? "Candidat" : "Entreprise"} - {attachment.label}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {task.completedAt && (
                  <div className="rounded-md border bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    Terminée le {formatDate(task.completedAt)}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={isPending} className="flex-1">
                    Voir les infos
                  </Button>
                  <Button type="submit" disabled={isPending} className="flex-1">
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enregistrer"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="p-6 space-y-5">
                {/* Title + toggle */}
                <div className="flex items-start gap-3">
                  <button onClick={handleToggle} disabled={isPending} className="mt-0.5 shrink-0">
                    {task.completedAt
                      ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      : <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                    }
                  </button>
                  <h2 className={cn("text-base font-semibold leading-snug", task.completedAt && "line-through text-muted-foreground")}>
                    {task.title}
                  </h2>
                </div>

                {task.description && (
                  <p className="text-sm text-muted-foreground pl-8">{task.description}</p>
                )}

                <dl className="space-y-3 pl-8">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Échéance</dt>
                    <dd className={cn("text-sm", !task.completedAt && new Date(task.dueAt) < new Date() && "text-destructive font-medium")}>
                      {formatDate(task.dueAt)}
                    </dd>
                  </div>

                  {task.completedAt && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Terminé le</dt>
                      <dd className="text-sm text-emerald-700">{formatDate(task.completedAt)}</dd>
                    </div>
                  )}

                  {task.assigneeName && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Assigné à</dt>
                      <dd className="text-sm">{task.assigneeName}</dd>
                    </div>
                  )}

                  {task.attachments.length > 0 && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                        Rattachements
                      </dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {task.attachments.map((attachment) => (
                          <a
                            key={`${attachment.entityType}:${attachment.entityId}`}
                            href={attachment.href}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:bg-accent"
                          >
                            {attachment.entityType === "candidate" ? "Candidat" : "Entreprise"} - {attachment.label}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-4 shrink-0 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Supprimer
            </Button>
            <Button size="sm" variant="outline" onClick={handleToggle} disabled={isPending}>
              {isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : task.completedAt ? "Rouvrir" : "Marquer terminé"
              }
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
