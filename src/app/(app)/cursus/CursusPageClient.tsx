"use client";

import { useState, useTransition } from "react";
import { PlusCircle, Tag, ToggleLeft, ToggleRight, RefreshCw, ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalBody, ModalClose, ModalContent, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { CursusDrawer } from "@/components/cursus-drawer";
import { toast } from "sonner";
import {
  deleteCursus,
  toggleCursusActive,
  syncYpareoCatalog,
  type CursusRow,
  type SyncedCursusRow,
} from "./actions";

type DeleteTarget = {
  id: string;
  name: string;
  source: "synced" | "manual";
  classesCount: number;
};

function sortManualCursus(rows: CursusRow[]): CursusRow[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function countSyncedClasses(rows: SyncedCursusRow[]): number {
  return rows.reduce((total, row) => total + row.classes.length, 0);
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days} j`;
}


// ─── Synced cursus card ───────────────────────────────────────────────────────

function SyncedCursusCard({
  c,
  onRequestDelete,
  isDeleting,
}: {
  c: SyncedCursusRow;
  onRequestDelete: (target: DeleteTarget) => void;
  isDeleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const activeClasses = c.classes.filter((cl) => cl.active);

  return (
    <div className={cn("rounded-lg border bg-card", !c.active && "opacity-60")}>
      <div className="flex items-center gap-2 px-4 py-3 hover:bg-accent/30 transition-colors">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          }
          <span className="flex-1 min-w-0">
            <span className="font-medium text-sm">{c.name}</span>
            {c.code && (
              <span className="ml-2 text-xs text-muted-foreground">
                <Tag className="inline h-3 w-3 mr-0.5" />{c.code}
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {activeClasses.length} action{activeClasses.length !== 1 ? "s" : ""}
          </span>
          {!c.active && (
            <Badge className="text-xs bg-muted text-muted-foreground border-0 px-1.5 py-0.5 ml-1 shrink-0">
              Inactif
            </Badge>
          )}
        </button>
        <button
          onClick={() => onRequestDelete({ id: c.id, name: c.name, source: "synced", classesCount: c.classes.length })}
          disabled={isDeleting}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          title="Supprimer"
          aria-label={`Supprimer ${c.name}`}
        >
          {isDeleting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />
          }
        </button>
      </div>

      {expanded && (
        <div className="border-t divide-y">
          {c.classes.length === 0 ? (
            <p className="px-8 py-3 text-xs text-muted-foreground italic">Aucune action de formation</p>
          ) : (
            c.classes.map((cl) => (
              <div
                key={cl.id}
                className={cn(
                  "flex items-center gap-3 px-8 py-2.5 text-xs",
                  !cl.active && "opacity-50"
                )}
              >
                <span className="flex-1 min-w-0">
                  <span className="font-medium">{cl.name}</span>
                  {cl.code && <span className="ml-1.5 text-muted-foreground">{cl.code}</span>}
                  {cl.site && <span className="ml-1.5 text-muted-foreground">· {cl.site}</span>}
                </span>
                {cl.startDate && (
                  <span className="text-muted-foreground shrink-0">
                    {new Date(cl.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    {cl.endDate && ` → ${new Date(cl.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Manual cursus card ───────────────────────────────────────────────────────

function CursusCard({
  cursus,
  onToggle,
  onRequestDelete,
  isDeleting,
}: {
  cursus: CursusRow;
  onToggle: (id: string, active: boolean) => void;
  onRequestDelete: (target: DeleteTarget) => void;
  isDeleting: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const nextActive = !cursus.active;
    startTransition(async () => {
      await toggleCursusActive(cursus.id, nextActive);
      onToggle(cursus.id, nextActive);
    });
  }

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-lg border bg-card px-4 py-3 transition-opacity",
        !cursus.active && "opacity-50",
        isPending && "opacity-40"
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{cursus.name}</span>
          {cursus.code && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="h-3 w-3" />
              {cursus.code}
            </span>
          )}
          {!cursus.active && (
            <Badge className="text-xs bg-muted text-muted-foreground border-0 px-1.5 py-0.5">
              Inactif
            </Badge>
          )}
        </div>
        {cursus.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{cursus.description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={toggle}
          disabled={isPending}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
          title={cursus.active ? "Désactiver" : "Activer"}
        >
          {isPending
            ? <Loader2 className="h-5 w-5 animate-spin" />
            : cursus.active
              ? <ToggleRight className="h-5 w-5 text-primary" />
              : <ToggleLeft className="h-5 w-5" />
          }
        </button>
        <button
          onClick={() => onRequestDelete({ id: cursus.id, name: cursus.name, source: "manual", classesCount: 0 })}
          disabled={isDeleting}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          title="Supprimer"
          aria-label={`Supprimer ${cursus.name}`}
        >
          {isDeleting
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Trash2 className="h-3.5 w-3.5" />
          }
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CursusPageClient({
  initialCursus,
  initialSyncedCursus,
}: {
  initialCursus: CursusRow[];
  initialSyncedCursus: SyncedCursusRow[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSyncing, startSync] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [manualCursus, setManualCursus] = useState(initialCursus);
  const [syncedCursus, setSyncedCursus] = useState(initialSyncedCursus);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [lastSync, setLastSync] = useState<{ at: string; cursusCount: number; classesCount: number } | null>(
    initialSyncedCursus.length > 0
      ? { at: initialSyncedCursus[0].syncedAt, cursusCount: initialSyncedCursus.length, classesCount: initialSyncedCursus.reduce((n, c) => n + c.classes.length, 0) }
      : null
  );

  function updateSyncedRows(rows: SyncedCursusRow[]) {
    setSyncedCursus(rows);
    setLastSync((previous) => (
      previous
        ? { ...previous, cursusCount: rows.length, classesCount: countSyncedClasses(rows) }
        : rows.length > 0
          ? { at: rows[0].syncedAt, cursusCount: rows.length, classesCount: countSyncedClasses(rows) }
          : null
    ));
  }

  function handleManualCreated(created: CursusRow) {
    setManualCursus((previous) => sortManualCursus([...previous, created]));
  }

  function handleManualToggle(id: string, active: boolean) {
    setManualCursus((previous) => previous.map((row) => (row.id === id ? { ...row, active } : row)));
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const target = deleteTarget;

    startDelete(async () => {
      const result = await deleteCursus(target.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      if (target.source === "synced") {
        updateSyncedRows(syncedCursus.filter((row) => row.id !== target.id));
      } else {
        setManualCursus((previous) => previous.filter((row) => row.id !== target.id));
      }

      toast.success("Cursus supprime");
      setDeleteTarget(null);
    });
  }

  function handleSync() {
    startSync(async () => {
      const result = await syncYpareoCatalog();
      if (!result.success) {
        toast.error(result.error ?? "Erreur lors de la synchronisation");
        return;
      }
      setLastSync({ at: result.syncedAt!, cursusCount: result.cursusCount!, classesCount: result.classesCount! });
      setSyncedCursus(result.syncedCursus ?? []);
      toast.success(`Synchronisation réussie — ${result.cursusCount} cursus, ${result.classesCount} actions de formation`);
    });
  }

  return (
    <>
      <CursusDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onCreated={handleManualCreated} />

      <div className="p-6 max-w-3xl mx-auto space-y-8">

        {/* ── Section Ypareo ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Catalogue Ypareo</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {lastSync
                  ? <>Dernière sync {relativeDate(lastSync.at)} · {lastSync.cursusCount} cursus · {lastSync.classesCount} actions de formation</>
                  : "Aucune synchronisation effectuée"
                }
              </p>
            </div>
            <Button
              onClick={handleSync}
              disabled={isSyncing}
              variant="outline"
              className="gap-1.5"
            >
              {isSyncing
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />
              }
              {isSyncing ? "Synchronisation…" : "Synchroniser"}
            </Button>
          </div>

          {syncedCursus.length === 0 && !isSyncing ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">
                {lastSync ? "Aucun cursus importe" : "Catalogue non synchronise"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {lastSync
                  ? "Relancez une synchronisation pour reimporter le catalogue Ypareo."
                  : "Cliquez sur \"Synchroniser\" pour importer les cursus et actions de formation depuis Ypareo."
                }
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {syncedCursus.map((c) => (
                <SyncedCursusCard
                  key={c.id}
                  c={c}
                  onRequestDelete={setDeleteTarget}
                  isDeleting={isDeleting && deleteTarget?.id === c.id}
                />
              ))}
              {isSyncing && (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground rounded-lg border bg-muted/20">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  Synchronisation en cours…
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Section cursus manuels ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Cursus manuels</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {manualCursus.length} cursus - saisie manuelle
              </p>
            </div>
            <Button onClick={() => setDrawerOpen(true)} variant="outline" className="gap-1.5">
              <PlusCircle className="h-4 w-4" />
              Nouveau cursus
            </Button>
          </div>
          {manualCursus.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Aucun cursus manuel.
            </div>
          ) : (
            <div className="space-y-2">
              {manualCursus.map((c) => (
                <CursusCard
                  key={c.id}
                  cursus={c}
                  onToggle={handleManualToggle}
                  onRequestDelete={setDeleteTarget}
                  isDeleting={isDeleting && deleteTarget?.id === c.id}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      <Modal open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Supprimer ce cursus ?</ModalTitle>
            <ModalClose />
          </ModalHeader>
          <ModalBody>
            <p className="text-sm">
              Vous allez supprimer <span className="font-medium">{deleteTarget?.name}</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              {deleteTarget?.source === "synced"
                ? `${deleteTarget.classesCount} action${deleteTarget.classesCount !== 1 ? "s" : ""} de formation locale${deleteTarget.classesCount !== 1 ? "s" : ""} seront aussi supprimees. Une prochaine synchronisation pourra reimporter ce cursus s'il existe encore dans Ypareo.`
                : "Ce cursus manuel sera retire des listes de selection."
              }
            </p>
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Annuler
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Supprimer
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
