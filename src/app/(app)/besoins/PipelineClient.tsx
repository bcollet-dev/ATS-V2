"use client";

import { useState, useTransition, useOptimistic, useEffect } from "react";
import Link from "next/link";
import { Briefcase, Archive, LayoutGrid, List, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { updateNeedStatus, type NeedRow } from "./actions";
import {
  loadMatchingsForNeed,
  updateMatchingStatus,
} from "@/app/(app)/matching/actions";
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
  activeMatchingsCount,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  needTitle: string;
  activeMatchingsCount: number;
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
          {activeMatchingsCount > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {activeMatchingsCount} candidat{activeMatchingsCount > 1 ? "s" : ""} rattaché{activeMatchingsCount > 1 ? "s" : ""} ser{activeMatchingsCount > 1 ? "ont" : "a"} marqué{activeMatchingsCount > 1 ? "s" : ""} «&nbsp;Non retenu&nbsp;».
            </p>
          )}
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

// ─── Select Retenu Modal ──────────────────────────────────────────────────────

function SelectRetenuModal({
  open,
  needId,
  needTitle,
  activeMatchingsCount,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  needId: string;
  needTitle: string;
  activeMatchingsCount: number;
  onConfirm: (matchingId: string) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<{ id: string; candidateName: string; candidateCursus: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (!open) { setRows([]); setSelected(""); return; }
    if (activeMatchingsCount === 0) return;
    setLoading(true);
    loadMatchingsForNeed(needId).then((data) => {
      setRows(
        data
          .filter((m) => !m.isFrozen && m.propositionStatus !== "not_retained" && m.propositionStatus !== "placed")
          .map((m) => ({ id: m.id, candidateName: m.candidateName, candidateCursus: m.candidateCursus }))
      );
      setLoading(false);
    });
  }, [open, needId, activeMatchingsCount]);

  function handleClose() {
    setSelected("");
    onCancel();
  }

  function handleConfirm() {
    if (!selected) return;
    onConfirm(selected);
    setSelected("");
  }

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Candidat retenu requis</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-3">
          {activeMatchingsCount === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Aucun candidat n&apos;est rattaché à{" "}
                <span className="font-medium text-foreground">{needTitle}</span>.
                Proposez d&apos;abord un candidat et marquez-le Retenu.
              </p>
              <Link
                href={`/besoins/${needId}`}
                className="text-sm text-primary hover:underline"
                onClick={handleClose}
              >
                Voir la fiche besoin →
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Pour passer <span className="font-medium text-foreground">{needTitle}</span> en
                Attente FRE, sélectionnez le candidat retenu.
              </p>
              {loading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Chargement…</p>
              ) : rows.length === 0 ? (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Aucun candidat actif disponible.</p>
                  <Link
                    href={`/besoins/${needId}`}
                    className="text-sm text-primary hover:underline"
                    onClick={handleClose}
                  >
                    Voir la fiche besoin →
                  </Link>
                </div>
              ) : (
                <div className="rounded-md border divide-y max-h-56 overflow-y-auto">
                  {rows.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelected(r.id)}
                      className={cn(
                        "flex items-start w-full px-3 py-2.5 text-left hover:bg-accent transition-colors gap-3",
                        selected === r.id && "bg-accent"
                      )}
                    >
                      <span className={cn(
                        "mt-0.5 h-3.5 w-3.5 rounded-full border shrink-0 flex items-center justify-center",
                        selected === r.id ? "bg-primary border-primary" : "border-input"
                      )}>
                        {selected === r.id && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </span>
                      <span>
                        <span className="text-sm font-medium">{r.candidateName}</span>
                        {r.candidateCursus && (
                          <span className="block text-xs text-muted-foreground">{r.candidateCursus}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          {activeMatchingsCount > 0 && (
            <Button onClick={handleConfirm} disabled={!selected || loading}>
              Marquer Retenu
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Select Interview Modal ───────────────────────────────────────────────────

function SelectInterviewModal({
  open,
  needId,
  needTitle,
  activeMatchingsCount,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  needId: string;
  needTitle: string;
  activeMatchingsCount: number;
  onConfirm: (matchingIds: string[]) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<{ id: string; candidateName: string; candidateCursus: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) { setRows([]); setSelected(new Set()); return; }
    if (activeMatchingsCount === 0) return;
    setLoading(true);
    loadMatchingsForNeed(needId).then((data) => {
      setRows(
        data
          .filter((m) => !m.isFrozen && m.propositionStatus === "cv_sent")
          .map((m) => ({ id: m.id, candidateName: m.candidateName, candidateCursus: m.candidateCursus }))
      );
      setLoading(false);
    });
  }, [open, needId, activeMatchingsCount]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleClose() {
    setSelected(new Set());
    onCancel();
  }

  function handleConfirm() {
    if (selected.size === 0) return;
    onConfirm([...selected]);
    setSelected(new Set());
  }

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Candidat(s) en entretien requis</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-3">
          {activeMatchingsCount === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Aucun candidat n&apos;est rattaché à{" "}
                <span className="font-medium text-foreground">{needTitle}</span>.
                Proposez d&apos;abord un candidat.
              </p>
              <Link
                href={`/besoins/${needId}`}
                className="text-sm text-primary hover:underline"
                onClick={handleClose}
              >
                Voir la fiche besoin →
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Pour passer <span className="font-medium text-foreground">{needTitle}</span> en
                Entretien, sélectionnez le ou les candidats concernés.
              </p>
              {loading ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Chargement…</p>
              ) : rows.length === 0 ? (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Aucun candidat en phase &quot;CV envoyé&quot; disponible.
                  </p>
                  <Link
                    href={`/besoins/${needId}`}
                    className="text-sm text-primary hover:underline"
                    onClick={handleClose}
                  >
                    Voir la fiche besoin →
                  </Link>
                </div>
              ) : (
                <div className="rounded-md border divide-y max-h-56 overflow-y-auto">
                  {rows.map((r) => {
                    const checked = selected.has(r.id);
                    return (
                      <button
                        key={r.id}
                        onClick={() => toggle(r.id)}
                        className={cn(
                          "flex items-start w-full px-3 py-2.5 text-left hover:bg-accent transition-colors gap-3",
                          checked && "bg-accent"
                        )}
                      >
                        <span className={cn(
                          "mt-0.5 h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center",
                          checked ? "bg-primary border-primary" : "border-input"
                        )}>
                          {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </span>
                        <span>
                          <span className="text-sm font-medium">{r.candidateName}</span>
                          {r.candidateCursus && (
                            <span className="block text-xs text-muted-foreground">{r.candidateCursus}</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          {activeMatchingsCount > 0 && (
            <Button onClick={handleConfirm} disabled={selected.size === 0 || loading}>
              Marquer Entretien prévu
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Pipeline Client ──────────────────────────────────────────────────────────

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
  const [pending, setPending] = useState<{ id: string; status: string; activeMatchingsCount: number } | null>(null);
  const [pendingRetenu, setPendingRetenu] = useState<{
    id: string; title: string; activeMatchingsCount: number;
  } | null>(null);
  const [pendingInterview, setPendingInterview] = useState<{
    id: string; title: string; activeMatchingsCount: number;
  } | null>(null);
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
      const need = needs.find((n) => n.id === id);
      setPending({ id, status, activeMatchingsCount: need?.activeMatchingsCount ?? 0 });
      return;
    }
    if (status === "interview") {
      const need = needs.find((n) => n.id === id);
      if (need && need.interviewCandidatesCount === 0) {
        setPendingInterview({
          id,
          title: `${need.title} — ${need.companyName}`,
          activeMatchingsCount: need.activeMatchingsCount,
        });
        return;
      }
    }
    if (status === "waiting_fre") {
      const need = needs.find((n) => n.id === id);
      if (need && need.waitingFreCandidatesCount === 0) {
        setPendingRetenu({
          id,
          title: `${need.title} — ${need.companyName}`,
          activeMatchingsCount: need.activeMatchingsCount,
        });
        return;
      }
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

  function handleRetenuConfirm(matchingId: string) {
    if (!pendingRetenu) return;
    const { id } = pendingRetenu;
    setPendingRetenu(null);
    startTransition(async () => {
      setOptimistic({ id, status: "waiting_fre" });
      await updateMatchingStatus(matchingId, "waiting_fre");
      await updateNeedStatus(id, "waiting_fre");
    });
  }

  function handleInterviewConfirm(matchingIds: string[]) {
    if (!pendingInterview || matchingIds.length === 0) return;
    const { id } = pendingInterview;
    setPendingInterview(null);
    startTransition(async () => {
      setOptimistic({ id, status: "interview" });
      await Promise.all(matchingIds.map((mId) => updateMatchingStatus(mId, "interview")));
      await updateNeedStatus(id, "interview");
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
        activeMatchingsCount={pending?.activeMatchingsCount ?? 0}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />

      <SelectRetenuModal
        open={!!pendingRetenu}
        needId={pendingRetenu?.id ?? ""}
        needTitle={pendingRetenu?.title ?? ""}
        activeMatchingsCount={pendingRetenu?.activeMatchingsCount ?? 0}
        onConfirm={handleRetenuConfirm}
        onCancel={() => setPendingRetenu(null)}
      />

      <SelectInterviewModal
        open={!!pendingInterview}
        needId={pendingInterview?.id ?? ""}
        needTitle={pendingInterview?.title ?? ""}
        activeMatchingsCount={pendingInterview?.activeMatchingsCount ?? 0}
        onConfirm={handleInterviewConfirm}
        onCancel={() => setPendingInterview(null)}
      />
    </div>
  );
}
