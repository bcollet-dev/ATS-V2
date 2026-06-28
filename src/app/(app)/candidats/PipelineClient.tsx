"use client";

import { useState, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Plus, Archive, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CandidatDrawer } from "@/components/candidat-drawer";
import { updateCandidateStatus, type CandidatRow } from "./actions";
import { KanbanPipeline } from "./KanbanPipeline";
import { PipelineList } from "./PipelineList";
import { RefusModal } from "./RefusModal";

const ARCHIVED = new Set(["temporary_refusal", "definitive_refusal"]);
type RefusType = "temporary_refusal" | "definitive_refusal";
type ViewMode = "kanban" | "list";
type Tab = "pipeline" | "archives";

export function PipelineClient({
  candidates: initial,
  cursus,
}: {
  candidates: CandidatRow[];
  cursus: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pipeline");
  const [view, setView] = useState<ViewMode>("kanban");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refusPending, setRefusPending] = useState<{ id: string; status: RefusType } | null>(null);
  const [, startTransition] = useTransition();

  const [candidates, setOptimistic] = useOptimistic(
    initial,
    (state, { id, status }: { id: string; status: string }) =>
      state.map((c) => (c.id === id ? { ...c, status } : c))
  );

  const pipeline = candidates.filter((c) => !ARCHIVED.has(c.status));
  const archives = candidates.filter((c) => ARCHIVED.has(c.status));

  const refusCandidat = refusPending
    ? candidates.find((c) => c.id === refusPending.id)
    : null;
  const refusCandidatName = refusCandidat
    ? `${refusCandidat.firstName} ${refusCandidat.lastName}`
    : "";

  function handleStatusChange(id: string, status: string) {
    if (status === "temporary_refusal" || status === "definitive_refusal") {
      setRefusPending({ id, status });
      return;
    }
    startTransition(async () => {
      setOptimistic({ id, status });
      await updateCandidateStatus(id, status);
    });
  }

  function handleRefusConfirm(reason: string) {
    if (!refusPending) return;
    const { id, status } = refusPending;
    setRefusPending(null);
    startTransition(async () => {
      setOptimistic({ id, status });
      await updateCandidateStatus(id, status, reason);
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-0 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Candidats</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pipeline.length} actif{pipeline.length !== 1 ? "s" : ""} · {archives.length} archivé{archives.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setDrawerOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Nouveau candidat
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
          <Users className="h-3.5 w-3.5" />
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
          Archivés
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
            <KanbanPipeline candidates={pipeline} onStatusChange={handleStatusChange} />
          ) : (
            <PipelineList candidates={pipeline} onStatusChange={handleStatusChange} />
          )
        ) : (
          <PipelineList candidates={archives} onStatusChange={handleStatusChange} archived />
        )}
      </div>

      <CandidatDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        cursus={cursus}
        onCreated={(id) => router.push(`/candidats/${id}`)}
      />

      <RefusModal
        open={!!refusPending}
        refusType={refusPending?.status ?? null}
        candidateName={refusCandidatName}
        onConfirm={handleRefusConfirm}
        onCancel={() => setRefusPending(null)}
      />
    </div>
  );
}
