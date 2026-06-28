"use client";

import { useState, useTransition, useOptimistic } from "react";
import { Briefcase, Archive, LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateNeedStatus, type NeedRow } from "./actions";
import { KanbanPipeline } from "./KanbanPipeline";
import { PipelineList } from "./PipelineList";
import { RuptureModal } from "./RuptureModal";

const ARCHIVED = new Set(["rupture"]);
type ViewMode = "kanban" | "list";
type Tab = "pipeline" | "archives";

export function PipelineClient({
  needs: initial,
  cursus,
  profiles,
}: {
  needs: NeedRow[];
  cursus: { id: string; name: string }[];
  profiles: { id: string; fullName: string }[];
}) {
  const [tab, setTab] = useState<Tab>("pipeline");
  const [view, setView] = useState<ViewMode>("kanban");
  const [rupturePending, setRupturePending] = useState<{ id: string } | null>(null);
  const [, startTransition] = useTransition();

  const [needs, setOptimistic] = useOptimistic(
    initial,
    (state, { id, status }: { id: string; status: string }) =>
      state.map((n) => (n.id === id ? { ...n, status } : n))
  );

  const pipeline = needs.filter((n) => !ARCHIVED.has(n.status));
  const archives = needs.filter((n) => ARCHIVED.has(n.status));

  const ruptureNeed = rupturePending ? needs.find((n) => n.id === rupturePending.id) : null;
  const ruptureTitle = ruptureNeed ? `${ruptureNeed.title} — ${ruptureNeed.companyName}` : "";

  function handleStatusChange(id: string, status: string) {
    if (status === "rupture") {
      setRupturePending({ id });
      return;
    }
    startTransition(async () => {
      setOptimistic({ id, status });
      await updateNeedStatus(id, status);
    });
  }

  function handleRuptureConfirm(reason: string) {
    if (!rupturePending) return;
    const { id } = rupturePending;
    setRupturePending(null);
    startTransition(async () => {
      setOptimistic({ id, status: "rupture" });
      await updateNeedStatus(id, "rupture", reason);
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-0 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Besoins</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pipeline.length} actif{pipeline.length !== 1 ? "s" : ""} · {archives.length} rupture{archives.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" disabled>
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
          Ruptures
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

      <RuptureModal
        open={!!rupturePending}
        needTitle={ruptureTitle}
        onConfirm={handleRuptureConfirm}
        onCancel={() => setRupturePending(null)}
      />
    </div>
  );
}
