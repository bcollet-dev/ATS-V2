"use client";

import { useEffect, useState, useTransition, useOptimistic } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Plus, Archive, Users, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { CandidatDrawer } from "@/components/candidat-drawer";
import { updateCandidateStatus, type CandidatRow } from "./actions";
import { permanentlyDeleteCandidate } from "@/app/(app)/candidats/[id]/actions";
import { deleteAllMatchingsForCandidate, updateMatchingStatus } from "@/app/(app)/matching/actions";
import { updateNeedStatus } from "@/app/(app)/besoins/actions";
import { KanbanPipeline } from "./KanbanPipeline";
import { PipelineList } from "./PipelineList";
import { RefusModal } from "./RefusModal";
import { YpareoPlacementModal } from "@/components/ypareo/YpareoPlacementModal";
import { RuptureDialog } from "@/components/ypareo/RuptureDialog";
import { pushYpareoPlacement } from "@/app/(app)/ypareo/actions";
import { triggerAbandon, getMotifsDepartYpareo } from "@/app/(app)/ypareo/rupture-actions";
import type { YpareoPlacementDraft } from "@/lib/ypareo/placement-draft";
import { toast } from "sonner";

const ARCHIVED = new Set(["temporary_refusal", "definitive_refusal"]);
const PRE_ADMISSIBLE = new Set(["to_call", "in_progress", "no_response", "pvpp"]);
type RefusType = "temporary_refusal" | "definitive_refusal";
type ArchiveType = "temporary_refusal" | "definitive_refusal" | "abandon";
type ViewMode = "kanban" | "list";
type Tab = "pipeline" | "archives";

type MotifDepart = { id: string; nom: string };

function ArchiveDragModal({
  open,
  candidateName,
  placedMatchingId,
  onConfirm,
  onAbandon,
  onDelete,
  onCancel,
}: {
  open: boolean;
  candidateName: string;
  placedMatchingId: string | null;
  onConfirm: (type: "temporary_refusal" | "definitive_refusal", reason: string) => void;
  onAbandon: (matchingId: string, motifDepartId: string) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<ArchiveType>("temporary_refusal");
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [motifsDepart, setMotifsDepart] = useState<MotifDepart[]>([]);
  const [motifDepartId, setMotifDepartId] = useState("");
  const [loadingMotifs, setLoadingMotifs] = useState(false);

  useEffect(() => {
    if (type === "abandon" && placedMatchingId && motifsDepart.length === 0) {
      setLoadingMotifs(true);
      getMotifsDepartYpareo()
        .then(setMotifsDepart)
        .catch(() => toast.error("Impossible de charger les motifs de départ"))
        .finally(() => setLoadingMotifs(false));
    }
  }, [type, placedMatchingId, motifsDepart.length]);

  function handleConfirm() {
    if (type === "abandon") {
      if (!placedMatchingId || !motifDepartId) { setError(true); return; }
      setMotifDepartId(""); setError(false);
      onAbandon(placedMatchingId, motifDepartId);
      return;
    }
    if (!reason.trim()) { setError(true); return; }
    const val = reason.trim();
    setReason(""); setError(false);
    onConfirm(type, val);
  }

  function handleCancel() {
    setReason(""); setError(false); setType("temporary_refusal"); setMotifDepartId("");
    onCancel();
  }

  function handleDelete() {
    setReason(""); setError(false);
    onDelete();
  }

  const SELECT_CLASS = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Archiver le candidat</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Archiver <span className="font-medium text-foreground">{candidateName}</span>
          </p>
          <div className="space-y-2">
            <label className="flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="radio"
                checked={type === "temporary_refusal"}
                onChange={() => setType("temporary_refusal")}
                className="mt-0.5 accent-primary"
              />
              <div>
                <p className="text-sm font-medium">Refus temporaire</p>
                <p className="text-xs text-muted-foreground">Le candidat pourra être relancé ultérieurement</p>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="radio"
                checked={type === "definitive_refusal"}
                onChange={() => setType("definitive_refusal")}
                className="mt-0.5 accent-primary"
              />
              <div>
                <p className="text-sm font-medium text-destructive">Refus définitif</p>
                <p className="text-xs text-muted-foreground">Le candidat ne sera plus relancé</p>
              </div>
            </label>
            {placedMatchingId && (
              <label className="flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  checked={type === "abandon"}
                  onChange={() => setType("abandon")}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-destructive">Abandon</p>
                  <p className="text-xs text-muted-foreground">Rupture contrat + départ inscription Ypareo à la date du jour</p>
                </div>
              </label>
            )}
          </div>

          {type !== "abandon" && (
            <div className="space-y-1.5">
              <Label htmlFor="archive-reason">
                Motif <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="archive-reason"
                value={reason}
                onChange={(e) => { setReason(e.target.value); setError(false); }}
                placeholder="Ex : profil ne correspond pas au niveau requis, candidat a trouvé autre chose…"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                autoFocus
              />
              {error && <p className="text-xs text-destructive">Le motif est obligatoire.</p>}
            </div>
          )}

          {type === "abandon" && (
            <div className="space-y-1.5">
              <Label htmlFor="archive-motif-depart">
                Motif de départ Ypareo <span className="text-destructive">*</span>
              </Label>
              {loadingMotifs ? (
                <div className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Chargement…
                </div>
              ) : (
                <select
                  id="archive-motif-depart"
                  value={motifDepartId}
                  onChange={(e) => { setMotifDepartId(e.target.value); setError(false); }}
                  className={SELECT_CLASS}
                >
                  <option value="">— Choisir un motif —</option>
                  {motifsDepart.map((m) => (
                    <option key={m.id} value={m.id}>{m.nom}</option>
                  ))}
                </select>
              )}
              {error && <p className="text-xs text-destructive">Sélectionnez un motif de départ.</p>}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="ghost"
            className="mr-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              if (window.confirm(`Supprimer définitivement ${candidateName} ? Cette action ne pourra pas être annulée.`)) {
                handleDelete();
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </Button>
          <Button variant="outline" onClick={handleCancel}>Annuler</Button>
          <Button
            variant={type !== "temporary_refusal" ? "destructive" : "default"}
            onClick={handleConfirm}
          >
            Confirmer
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

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
  const [pendingArchiveDrop, setPendingArchiveDrop] = useState<{ id: string; name: string; placedMatchingId: string | null } | null>(null);
  const [pendingYpareo, setPendingYpareo] = useState<{ id: string } | null>(null);
  const [pendingRupture, setPendingRupture] = useState<{
    candidateId: string;
    matchingId: string;
    ypareoInscriptionId: string | null;
    candidateName: string;
  } | null>(null);
  const [, startTransition] = useTransition();

  const [candidates, setOptimistic] = useOptimistic(
    initial,
    (state, { id, status }: { id: string; status: string }) =>
      state.map((c) => (c.id === id ? { ...c, status } : c))
  );

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setView("list");
    }
  }, []);

  const pipeline = candidates.filter((c) => !ARCHIVED.has(c.status));
  const archives = candidates.filter((c) => ARCHIVED.has(c.status));

  const refusCandidat = refusPending
    ? candidates.find((c) => c.id === refusPending.id)
    : null;
  const refusCandidatName = refusCandidat
    ? `${refusCandidat.firstName} ${refusCandidat.lastName}`
    : "";

  function handleStatusChange(id: string, status: string) {
    if (status === "contract_break") {
      const candidat = candidates.find((c) => c.id === id);
      const placed = candidat?.needMatchings.find((m) => m.propositionStatus === "placed");
      const name = candidat ? `${candidat.firstName} ${candidat.lastName}` : "";
      if (!placed?.ypareoContratId) {
        toast.error("Aucun contrat Ypareo associé à ce candidat");
        return;
      }
      setPendingRupture({
        candidateId: id,
        matchingId: placed.matchingId,
        ypareoInscriptionId: placed.ypareoInscriptionId,
        candidateName: name,
      });
      return;
    }
    if (status === "archived_drop") {
      const candidat = candidates.find((c) => c.id === id);
      const name = candidat ? `${candidat.firstName} ${candidat.lastName}` : "";
      const placedWithYpareo = candidat?.needMatchings.find((m) => m.propositionStatus === "placed" && !!m.ypareoInscriptionId);
      setPendingArchiveDrop({ id, name, placedMatchingId: placedWithYpareo?.matchingId ?? null });
      return;
    }
    if (status === "temporary_refusal" || status === "definitive_refusal") {
      setRefusPending({ id, status });
      return;
    }
    if (status === "placed") {
      setPendingYpareo({ id });
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

  function handleArchiveDropConfirm(type: "temporary_refusal" | "definitive_refusal", reason: string) {
    if (!pendingArchiveDrop) return;
    const { id } = pendingArchiveDrop;
    setPendingArchiveDrop(null);
    startTransition(async () => {
      setOptimistic({ id, status: type });
      await updateCandidateStatus(id, type, reason);
    });
  }

  function handleAbandonConfirm(matchingId: string, motifDepartId: string) {
    if (!pendingArchiveDrop) return;
    const { id } = pendingArchiveDrop;
    setPendingArchiveDrop(null);
    startTransition(async () => {
      setOptimistic({ id, status: "definitive_refusal" });
      const result = await triggerAbandon(matchingId, motifDepartId);
      if (!result.success) {
        toast.error(result.error ?? "Erreur lors de l'abandon");
        router.refresh();
        return;
      }
      toast.success("Candidat archivé — abandon enregistré dans Ypareo");
      router.refresh();
    });
  }

  function handleArchiveDropDelete() {
    if (!pendingArchiveDrop) return;
    const { id } = pendingArchiveDrop;
    setPendingArchiveDrop(null);
    startTransition(async () => {
      setOptimistic({ id, status: "definitive_refusal" });
      await updateCandidateStatus(id, "definitive_refusal", "Suppression définitive");
      const result = await permanentlyDeleteCandidate(id);
      if (!result.success) {
        toast.error(result.error ?? "Suppression définitive impossible");
        router.refresh();
        return;
      }
      toast.success("Candidat supprimé définitivement");
      router.refresh();
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

  async function handleYpareoConfirm(draft: YpareoPlacementDraft, selectedClassId: string | null) {
    if (!pendingYpareo) return;
    const { id } = pendingYpareo;
    try {
      const result = await pushYpareoPlacement(draft, selectedClassId);
      if (!result.success) {
        toast.error(result.error ?? "Erreur lors de l'envoi sur Ypareo");
        startTransition(() => {
          setOptimistic({ id, status: "waiting_fre" });
          router.refresh();
        });
        return;
      }
      toast.success("Envoi Ypareo confirme");
      setPendingYpareo(null);
      startTransition(() => {
        setOptimistic({ id, status: "placed" });
        router.refresh();
      });
    } catch {
      toast.error("Erreur lors de l'envoi sur Ypareo");
      startTransition(() => {
        setOptimistic({ id, status: "waiting_fre" });
        router.refresh();
      });
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-0 sm:flex-row sm:items-center sm:px-6 sm:pt-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold">Candidats</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pipeline.length} actif{pipeline.length !== 1 ? "s" : ""} · {archives.length} archivé{archives.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" className="w-full gap-1.5 sm:w-auto" onClick={() => setDrawerOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Nouveau candidat
        </Button>
      </div>

      {/* Tabs + view toggle */}
      <div className="mt-3 flex flex-wrap items-end gap-y-2 border-b px-4 sm:mt-4 sm:px-6">
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

      <ArchiveDragModal
        open={!!pendingArchiveDrop}
        candidateName={pendingArchiveDrop?.name ?? ""}
        placedMatchingId={pendingArchiveDrop?.placedMatchingId ?? null}
        onConfirm={handleArchiveDropConfirm}
        onAbandon={handleAbandonConfirm}
        onDelete={handleArchiveDropDelete}
        onCancel={() => setPendingArchiveDrop(null)}
      />

      <RuptureDialog
        open={!!pendingRupture}
        matchingId={pendingRupture?.matchingId ?? ""}
        ypareoInscriptionId={pendingRupture?.ypareoInscriptionId ?? null}
        candidateName={pendingRupture?.candidateName ?? ""}
        onSuccess={() => { setPendingRupture(null); router.refresh(); }}
        onCancel={() => setPendingRupture(null)}
      />

      <YpareoPlacementModal
        open={!!pendingYpareo}
        source="candidate"
        sourceId={pendingYpareo?.id ?? null}
        targetLabel="Placé"
        onCancel={() => setPendingYpareo(null)}
        onConfirm={handleYpareoConfirm}
      />
    </div>
  );
}
