"use client";

import { useState, useTransition, useOptimistic } from "react";
import { Briefcase, Archive, LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { updateNeedStatus, type NeedRow } from "./actions";
import { KanbanPipeline } from "./KanbanPipeline";
import { PipelineList } from "./PipelineList";
import { NeedDrawer } from "./NeedDrawer";

const ARCHIVED = new Set(["lost"]);
type ViewMode = "kanban" | "list";
type Tab = "pipeline" | "archives";

// Statuts nécessitant un motif
const REASON_REQUIRED = new Set(["rupture", "lost"]);

function LostModal({
  open,
  needTitle,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  needTitle: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);

  function handleConfirm() {
    if (!reason.trim()) { setError(true); return; }
    const val = reason.trim();
    setReason(""); setError(false);
    onConfirm(val);
  }

  function handleCancel() {
    setReason(""); setError(false); onCancel();
  }

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) handleCancel(); }}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle className="text-destructive">Besoin perdu</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Motif de perte pour <span className="font-medium text-foreground">{needTitle}</span>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="lost-reason">Motif <span className="text-destructive">*</span></Label>
            <textarea
              id="lost-reason"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(false); }}
              placeholder="Ex : poste pourvu en interne, budget gelé, concurrence…"
              className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              autoFocus
            />
            {error && <p className="text-xs text-destructive">Le motif est obligatoire.</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={handleCancel}>Annuler</Button>
          <Button variant="destructive" onClick={handleConfirm}>Confirmer</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function PipelineClient({
  needs: initial,
  cursus,
  profiles,
  companies,
}: {
  needs: NeedRow[];
  cursus: { id: string; name: string }[];
  profiles: { id: string; fullName: string }[];
  companies: { id: string; name: string }[];
}) {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [view, setView] = useState<ViewMode>("kanban");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, setPending] = useState<{ id: string; status: string } | null>(null);
  const [, startTransition] = useTransition();

  const [needs, setOptimistic] = useOptimistic(
    initial,
    (state, { id, status }: { id: string; status: string }) =>
      state.map((n) => (n.id === id ? { ...n, status } : n))
  );

  const pipeline = needs.filter((n) => !ARCHIVED.has(n.status));
  const archives = needs.filter((n) => ARCHIVED.has(n.status));

  const pendingNeed = pending ? needs.find((n) => n.id === pending.id) : null;
  const pendingTitle = pendingNeed ? `${pendingNeed.title} — ${pendingNeed.companyName}` : "";

  function handleStatusChange(id: string, status: string) {
    if (REASON_REQUIRED.has(status)) {
      setPending({ id, status });
      return;
    }
    startTransition(async () => {
      setOptimistic({ id, status });
      await updateNeedStatus(id, status);
    });
  }

  function handleConfirm(reason: string) {
    if (!pending) return;
    const { id, status } = pending;
    setPending(null);
    startTransition(async () => {
      setOptimistic({ id, status });
      await updateNeedStatus(id, status, reason);
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-0 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Besoins</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pipeline.length} actif{pipeline.length !== 1 ? "s" : ""} · {archives.length} perdu{archives.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDrawerOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Nouveau besoin
        </Button>
      </div>

      {/* Tabs + view toggle */}
      <div className="px-6 mt-4 flex items-center border-b">
        <button
          onClick={() => setTab("pipeline")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "pipeline"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Briefcase className="h-3.5 w-3.5" />
          Pipeline
          <span className={cn(
            "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[1.25rem]",
            tab === "pipeline" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {pipeline.length}
          </span>
        </button>
        <button
          onClick={() => setTab("archives")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "archives"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Archive className="h-3.5 w-3.5" />
          Perdus
          <span className={cn(
            "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold min-w-[1.25rem]",
            tab === "archives" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {archives.length}
          </span>
        </button>

        {tab === "pipeline" && (
          <div className="ml-auto flex rounded-md border p-0.5 bg-muted/40 mb-1">
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
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === "pipeline" ? (
          view === "kanban" ? (
            <KanbanPipeline needs={pipeline} onStatusChange={handleStatusChange} />
          ) : (
            <PipelineList needs={pipeline} onStatusChange={handleStatusChange} cursus={cursus} profiles={profiles} />
          )
        ) : (
          <PipelineList needs={archives} onStatusChange={handleStatusChange} cursus={cursus} profiles={profiles} archived />
        )}
      </div>

      <NeedDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        companies={companies}
        cursus={cursus}
        profiles={profiles}
      />

      <LostModal
        open={!!pending}
        needTitle={pendingTitle}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
