"use client";

import { useState, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Plus, Archive, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { CandidatDrawer } from "@/components/candidat-drawer";
import { updateCandidateStatus, type CandidatRow } from "./actions";
import { deleteAllMatchingsForCandidate, updateMatchingStatus } from "@/app/(app)/matching/actions";
import { updateNeedStatus } from "@/app/(app)/besoins/actions";
import { KanbanPipeline } from "./KanbanPipeline";
import { PipelineList } from "./PipelineList";
import { RefusModal } from "./RefusModal";

const ARCHIVED = new Set(["temporary_refusal", "definitive_refusal"]);
const PRE_ADMISSIBLE = new Set(["to_call", "in_progress", "no_response", "pvpp"]);
type RefusType = "temporary_refusal" | "definitive_refusal";
type ViewMode = "kanban" | "list";
type Tab = "pipeline" | "archives";

function DegradeCandidatModal({
  open,
  candidateName,
  targetStatus,
  matchingsCount,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  candidateName: string;
  targetStatus: string;
  matchingsCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const statusLabels: Record<string, string> = {
    to_call: "À appeler",
    in_progress: "En cours",
    no_response: "NRP",
    interview: "Entretien",
    pvpp: "PVPP",
  };
  const label = statusLabels[targetStatus] ?? targetStatus;
  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Changer le statut vers « {label} »</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <div className="rounded-md bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
            <strong>{candidateName}</strong> est actuellement rattaché(e) à{" "}
            <strong>{matchingsCount} besoin{matchingsCount > 1 ? "s" : ""}</strong>.
            En passant ce candidat au statut &laquo; {label} &raquo;, {matchingsCount > 1 ? "ces rattachements seront" : "ce rattachement sera"} supprimé{matchingsCount > 1 ? "s" : ""}.
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onCancel}>Annuler</Button>
          <Button variant="destructive" onClick={onConfirm}>
            Confirmer et supprimer {matchingsCount > 1 ? "les rattachements" : "le rattachement"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function InterviewNeedsModal({
  open,
  candidateName,
  needs,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  candidateName: string;
  needs: { needId: string; needTitle: string }[];
  onConfirm: (selectedNeedIds: string[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(needs.map((n) => n.needId)));

  function toggle(needId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(needId)) next.delete(needId);
      else next.add(needId);
      return next;
    });
  }

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Passer en entretien</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>{candidateName}</strong> est rattaché(e) à plusieurs besoins.
            Sélectionnez le(s) besoin(s) à passer en entretien :
          </p>
          <div className="space-y-2">
            {needs.map((n) => (
              <label key={n.needId} className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={selected.has(n.needId)}
                  onChange={() => toggle(n.needId)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm">{n.needTitle}</span>
              </label>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onCancel}>Annuler</Button>
          <Button
            disabled={selected.size === 0}
            onClick={() => onConfirm(Array.from(selected))}
          >
            Passer en entretien
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function WaitingFreNeedModal({
  open,
  candidateName,
  matchings,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  candidateName: string;
  matchings: { matchingId: string; needId: string; needTitle: string }[];
  onConfirm: (selection: { matchingId: string; needId: string }) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string>("");

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) { setSelected(""); onCancel(); } }}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Attente FRE — besoin retenu</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>{candidateName}</strong> est rattaché(e) à plusieurs besoins.
            Sélectionnez le besoin pour lequel ce candidat est retenu :
          </p>
          <div className="rounded-md border divide-y max-h-56 overflow-y-auto">
            {matchings.map((m) => (
              <button
                key={m.matchingId}
                onClick={() => setSelected(m.matchingId)}
                className={cn(
                  "flex items-center w-full px-3 py-2.5 text-left hover:bg-accent transition-colors gap-3",
                  selected === m.matchingId && "bg-accent"
                )}
              >
                <span className={cn(
                  "h-3.5 w-3.5 rounded-full border shrink-0 flex items-center justify-center",
                  selected === m.matchingId ? "bg-primary border-primary" : "border-input"
                )} />
                <span className="text-sm">{m.needTitle}</span>
              </button>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => { setSelected(""); onCancel(); }}>Annuler</Button>
          <Button
            disabled={!selected}
            onClick={() => {
              const m = matchings.find((x) => x.matchingId === selected);
              if (!m) return;
              setSelected("");
              onConfirm(m);
            }}
          >
            Marquer Retenu
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function CompanyInterviewModal({
  open,
  candidateName,
  matchings,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  candidateName: string;
  matchings: { matchingId: string; needId: string; needTitle: string }[];
  onConfirm: (selected: { matchingId: string; needId: string }[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(matchings.map((m) => m.matchingId)));

  function toggle(matchingId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(matchingId)) next.delete(matchingId);
      else next.add(matchingId);
      return next;
    });
  }

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Entretien entreprise</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-muted-foreground mb-3">
            <strong>{candidateName}</strong> est rattaché(e) à plusieurs besoins.
            Sélectionnez le(s) besoin(s) à passer en entretien prévu :
          </p>
          <div className="space-y-2">
            {matchings.map((m) => (
              <label key={m.matchingId} className="flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={selected.has(m.matchingId)}
                  onChange={() => toggle(m.matchingId)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm">{m.needTitle}</span>
              </label>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onCancel}>Annuler</Button>
          <Button
            disabled={selected.size === 0}
            onClick={() =>
              onConfirm(matchings.filter((m) => selected.has(m.matchingId)))
            }
          >
            Confirmer
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function PipelineClient({
  candidates: initial,
  cursus,
  profiles,
}: {
  candidates: CandidatRow[];
  cursus: { id: string; name: string }[];
  profiles: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pipeline");
  const [view, setView] = useState<ViewMode>("kanban");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refusPending, setRefusPending] = useState<{ id: string; status: RefusType } | null>(null);
  const [pendingDegrade, setPendingDegrade] = useState<{ id: string; status: string; name: string; matchingsCount: number } | null>(null);
  const [pendingInterview, setPendingInterview] = useState<{ candidateId: string; candidateName: string; needs: { needId: string; needTitle: string }[] } | null>(null);
  const [pendingCompanyInterview, setPendingCompanyInterview] = useState<{ candidateId: string; candidateName: string; matchings: { matchingId: string; needId: string; needTitle: string }[] } | null>(null);
  const [pendingWaitingFre, setPendingWaitingFre] = useState<{ candidateId: string; candidateName: string; matchings: { matchingId: string; needId: string; needTitle: string }[] } | null>(null);
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
    if (status === "interview") {
      const candidat = candidates.find((c) => c.id === id);
      const matchings = candidat?.needMatchings ?? [];
      if (matchings.length === 1) {
        const needId = matchings[0].needId;
        startTransition(async () => {
          setOptimistic({ id, status });
          await updateCandidateStatus(id, status);
          await updateNeedStatus(needId, "interview");
        });
        return;
      } else if (matchings.length > 1) {
        const name = candidat ? `${candidat.firstName} ${candidat.lastName}` : "";
        setPendingInterview({
          candidateId: id,
          candidateName: name,
          needs: matchings.map((m) => ({ needId: m.needId, needTitle: m.needTitle })),
        });
        return;
      }
    }
    if (status === "company_interview") {
      const candidat = candidates.find((c) => c.id === id);
      const needMatchings = candidat?.needMatchings ?? [];
      const name = candidat ? `${candidat.firstName} ${candidat.lastName}` : "";
      if (needMatchings.length === 1) {
        const { matchingId, needId } = needMatchings[0];
        startTransition(async () => {
          setOptimistic({ id, status });
          await updateCandidateStatus(id, status);
          await updateMatchingStatus(matchingId, "interview");
          await updateNeedStatus(needId, "interview");
        });
        return;
      } else if (needMatchings.length > 1) {
        setPendingCompanyInterview({
          candidateId: id,
          candidateName: name,
          matchings: needMatchings.map((m) => ({ matchingId: m.matchingId, needId: m.needId, needTitle: m.needTitle })),
        });
        return;
      }
    }
    if (status === "waiting_fre") {
      const candidat = candidates.find((c) => c.id === id);
      const active = (candidat?.needMatchings ?? []).filter(
        (m) => !m.isFrozen && m.propositionStatus !== "not_retained"
      );
      const name = candidat ? `${candidat.firstName} ${candidat.lastName}` : "";
      if (active.length === 1) {
        const { matchingId, needId } = active[0];
        startTransition(async () => {
          setOptimistic({ id, status });
          await updateCandidateStatus(id, status);
          await updateMatchingStatus(matchingId, "waiting_fre");
          await updateNeedStatus(needId, "waiting_fre");
        });
        return;
      } else if (active.length > 1) {
        setPendingWaitingFre({
          candidateId: id,
          candidateName: name,
          matchings: active.map((m) => ({ matchingId: m.matchingId, needId: m.needId, needTitle: m.needTitle })),
        });
        return;
      }
    }
    if (PRE_ADMISSIBLE.has(status)) {
      const candidat = candidates.find((c) => c.id === id);
      const matchingsCount = candidat?.needMatchings?.length ?? 0;
      if (matchingsCount > 0) {
        const name = candidat ? `${candidat.firstName} ${candidat.lastName}` : "";
        setPendingDegrade({ id, status, name, matchingsCount });
        return;
      }
    }
    startTransition(async () => {
      setOptimistic({ id, status });
      await updateCandidateStatus(id, status);
    });
  }

  function handleInterviewConfirm(selectedNeedIds: string[]) {
    if (!pendingInterview) return;
    const { candidateId } = pendingInterview;
    setPendingInterview(null);
    startTransition(async () => {
      setOptimistic({ id: candidateId, status: "interview" });
      await updateCandidateStatus(candidateId, "interview");
      await Promise.all(selectedNeedIds.map((needId) => updateNeedStatus(needId, "interview")));
    });
  }

  function handleWaitingFreConfirm(selection: { matchingId: string; needId: string }) {
    if (!pendingWaitingFre) return;
    const { candidateId } = pendingWaitingFre;
    setPendingWaitingFre(null);
    startTransition(async () => {
      setOptimistic({ id: candidateId, status: "waiting_fre" });
      await updateCandidateStatus(candidateId, "waiting_fre");
      await updateMatchingStatus(selection.matchingId, "waiting_fre");
      await updateNeedStatus(selection.needId, "waiting_fre");
    });
  }

  function handleCompanyInterviewConfirm(selected: { matchingId: string; needId: string }[]) {
    if (!pendingCompanyInterview || selected.length === 0) return;
    const { candidateId } = pendingCompanyInterview;
    setPendingCompanyInterview(null);
    startTransition(async () => {
      setOptimistic({ id: candidateId, status: "company_interview" });
      await updateCandidateStatus(candidateId, "company_interview");
      await Promise.all([
        ...selected.map(({ matchingId }) => updateMatchingStatus(matchingId, "interview")),
        ...selected.map(({ needId }) => updateNeedStatus(needId, "interview")),
      ]);
    });
  }

  function handleDegradeConfirm() {
    if (!pendingDegrade) return;
    const { id, status } = pendingDegrade;
    setPendingDegrade(null);
    startTransition(async () => {
      setOptimistic({ id, status });
      await deleteAllMatchingsForCandidate(id);
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
            <PipelineList candidates={pipeline} onStatusChange={handleStatusChange} profiles={profiles} cursus={cursus} />
          )
        ) : (
          <PipelineList candidates={archives} onStatusChange={handleStatusChange} profiles={profiles} cursus={cursus} archived />
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

      <DegradeCandidatModal
        open={!!pendingDegrade}
        candidateName={pendingDegrade?.name ?? ""}
        targetStatus={pendingDegrade?.status ?? ""}
        matchingsCount={pendingDegrade?.matchingsCount ?? 0}
        onConfirm={handleDegradeConfirm}
        onCancel={() => setPendingDegrade(null)}
      />

      <InterviewNeedsModal
        open={!!pendingInterview}
        candidateName={pendingInterview?.candidateName ?? ""}
        needs={pendingInterview?.needs ?? []}
        onConfirm={handleInterviewConfirm}
        onCancel={() => setPendingInterview(null)}
      />

      <CompanyInterviewModal
        open={!!pendingCompanyInterview}
        candidateName={pendingCompanyInterview?.candidateName ?? ""}
        matchings={pendingCompanyInterview?.matchings ?? []}
        onConfirm={handleCompanyInterviewConfirm}
        onCancel={() => setPendingCompanyInterview(null)}
      />

      <WaitingFreNeedModal
        open={!!pendingWaitingFre}
        candidateName={pendingWaitingFre?.candidateName ?? ""}
        matchings={pendingWaitingFre?.matchings ?? []}
        onConfirm={handleWaitingFreConfirm}
        onCancel={() => setPendingWaitingFre(null)}
      />
    </div>
  );
}
