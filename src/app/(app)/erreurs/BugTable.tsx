"use client";

import { useState, useTransition, useRef } from "react";
import { Plus, Trash2, ChevronDown, Loader2, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { createBugReport, updateBugStatus, deleteBugReport } from "./actions";

type BugRow = {
  id: string;
  title: string;
  page: string;
  action: string;
  expected: string;
  observed: string;
  priority: string;
  status: string;
  notes: string | null;
  reporterName: string | null;
  createdAt: string;
};

const PRIORITY_META = {
  high:   { label: "Haute",   className: "bg-red-100 text-red-700" },
  medium: { label: "Moyenne", className: "bg-amber-100 text-amber-700" },
  low:    { label: "Basse",   className: "bg-slate-100 text-slate-600" },
} as const;

const STATUS_META = {
  open:        { label: "Ouvert",     className: "bg-red-50 text-red-600" },
  in_progress: { label: "En cours",  className: "bg-blue-50 text-blue-600" },
  fixed:       { label: "Corrigé",   className: "bg-emerald-50 text-emerald-700" },
} as const;

const STATUS_TRANSITIONS: Record<string, { next: string; label: string }> = {
  open:        { next: "in_progress", label: "Marquer en cours" },
  in_progress: { next: "fixed",       label: "Marquer corrigé" },
  fixed:       { next: "open",        label: "Réouvrir" },
};

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50 resize-none",
        className
      )}
      {...props}
    />
  );
}

function BugDetail({ bug }: { bug: BugRow }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const transition = STATUS_TRANSITIONS[bug.status];
  const priorityMeta = PRIORITY_META[bug.priority as keyof typeof PRIORITY_META] ?? PRIORITY_META.medium;
  const statusMeta = STATUS_META[bug.status as keyof typeof STATUS_META] ?? STATUS_META.open;

  function handleStatus() {
    startTransition(async () => {
      await updateBugStatus(bug.id, transition.next);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteBugReport(bug.id);
    });
  }

  return (
    <>
      <tr
        className="hover:bg-muted/40 cursor-pointer transition-colors"
        onClick={() => setOpen(true)}
      >
        <td className="px-4 py-3 text-sm font-medium">{bug.title}</td>
        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{bug.page}</td>
        <td className="px-4 py-3">
          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", priorityMeta.className)}>
            {priorityMeta.label}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusMeta.className)}>
            {statusMeta.label}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {new Date(bug.createdAt).toLocaleDateString("fr-FR")}
        </td>
      </tr>

      <Modal open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <ModalContent className="max-w-xl">
          <ModalHeader>
            <ModalTitle className="text-base">{bug.title}</ModalTitle>
          </ModalHeader>
          <ModalBody className="space-y-4 text-sm">
            <div className="flex gap-2">
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", priorityMeta.className)}>
                {priorityMeta.label}
              </span>
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusMeta.className)}>
                {statusMeta.label}
              </span>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Page / URL</p>
              <p className="font-mono text-sm">{bug.page}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Action déclenchante</p>
              <p>{bug.action}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Comportement attendu</p>
                <p>{bug.expected}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Comportement observé</p>
                <p>{bug.observed}</p>
              </div>
            </div>

            {bug.notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                <p>{bug.notes}</p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Signalé{bug.reporterName ? ` par ${bug.reporterName}` : ""} le {new Date(bug.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </ModalBody>
          <ModalFooter className="justify-between">
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleDelete} disabled={isPending}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Supprimer
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Fermer</Button>
              {transition && (
                <Button size="sm" onClick={handleStatus} disabled={isPending}>
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : transition.label}
                </Button>
              )}
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

function CreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await createBugReport(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        formRef.current?.reset();
        onClose();
      }
    });
  }

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ModalContent className="max-w-xl">
        <ModalHeader>
          <ModalTitle>Signaler un bug</ModalTitle>
        </ModalHeader>
        <form ref={formRef} onSubmit={handleSubmit}>
          <ModalBody className="space-y-4">
            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="space-y-1.5">
              <Label htmlFor="title">Titre <span className="text-destructive">*</span></Label>
              <Input id="title" name="title" placeholder="Ex: Le modal de tâche ne se ferme pas" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="page">Page / URL <span className="text-destructive">*</span></Label>
                <Input id="page" name="page" placeholder="Ex: /candidats/[id]" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="priority">Priorité</Label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue="medium"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="action">Action déclenchante <span className="text-destructive">*</span></Label>
              <Input id="action" name="action" placeholder="Ex: Cliquer sur 'Supprimer' dans BlocTaches" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="expected">Comportement attendu <span className="text-destructive">*</span></Label>
                <Textarea id="expected" name="expected" placeholder="Ce qui devrait se passer…" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="observed">Comportement observé <span className="text-destructive">*</span></Label>
                <Textarea id="observed" name="observed" placeholder="Ce qui se passe réellement…" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes additionnelles</Label>
              <Textarea id="notes" name="notes" placeholder="Fréquence, conditions particulières, captures d'écran…" />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Envoi…</> : "Signaler"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

export function BugTable({ initialBugs }: { initialBugs: BugRow[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "in_progress" | "fixed">("all");

  const filtered = filter === "all" ? initialBugs : initialBugs.filter((b) => b.status === filter);
  const openCount = initialBugs.filter((b) => b.status === "open").length;

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex gap-1 rounded-lg border p-1 bg-muted/40">
          {(["all", "open", "in_progress", "fixed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                filter === s ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s === "all" ? "Tous" : s === "open" ? "Ouverts" : s === "in_progress" ? "En cours" : "Corrigés"}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Signaler un bug
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-card px-5 py-16 text-center">
          <Bug className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {filter === "all" ? "Aucun bug signalé" : "Aucun bug dans cette catégorie"}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Titre</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Page</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Priorité</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((bug) => (
                <BugDetail key={bug.id} bug={bug} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
