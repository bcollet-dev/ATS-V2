"use client";

import { useState, useRef, useEffect, useTransition, useOptimistic } from "react";
import Link from "next/link";
import { Plus, Trash2, Trophy, Lock, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  createMatching,
  updateMatchingStatus,
  markMatchingWinner,
  deleteMatching,
  type MatchingForCandidate,
  type NeedOption,
} from "@/app/(app)/matching/actions";

// ─── Constants ───────────────────────────────────────────────────────────────

const PROP_LABELS: Record<string, string> = {
  cv_sent:      "CV envoyé",
  interview:    "Entretien",
  waiting_fre:  "Attente FRE",
  placed:       "Placé",
  not_retained: "Non retenu",
};

const PROP_BADGE: Record<string, string> = {
  cv_sent:      "bg-blue-100 text-blue-700",
  interview:    "bg-orange-100 text-orange-700",
  waiting_fre:  "bg-amber-100 text-amber-700",
  placed:       "bg-emerald-100 text-emerald-700",
  not_retained: "bg-gray-100 text-gray-600",
};

const PROP_DOT: Record<string, string> = {
  cv_sent:      "bg-blue-400",
  interview:    "bg-orange-400",
  waiting_fre:  "bg-amber-400",
  placed:       "bg-emerald-400",
  not_retained: "bg-gray-400",
};

const PIPELINE_STATUSES = [
  { key: "cv_sent",      label: "CV envoyé" },
  { key: "interview",    label: "Entretien" },
  { key: "waiting_fre",  label: "Attente FRE" },
  { key: "placed",       label: "Placé" },
  { key: "not_retained", label: "Non retenu" },
];

// ─── Status Picker ────────────────────────────────────────────────────────────

function StatusPicker({
  matching,
  onStatusChange,
}: {
  matching: MatchingForCandidate;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (matching.isFrozen && !matching.isWinner) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-400">
        <Lock className="h-3 w-3" /> Gelé
      </span>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => !matching.isFrozen && setOpen((o) => !o)}
        disabled={matching.isFrozen}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity",
          matching.isFrozen ? "cursor-default opacity-60" : "hover:opacity-80 cursor-pointer",
          PROP_BADGE[matching.propositionStatus] ?? "bg-muted text-muted-foreground"
        )}
      >
        {matching.isWinner && <Trophy className="h-3 w-3" />}
        {PROP_LABELS[matching.propositionStatus] ?? matching.propositionStatus}
      </button>
      {open && (
        <div
          ref={ref}
          className="absolute top-full left-0 z-50 mt-1 w-44 rounded-lg border bg-popover shadow-lg overflow-hidden"
        >
          {PIPELINE_STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => { setOpen(false); onStatusChange(matching.id, s.key); }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors",
                matching.propositionStatus === s.key && "font-semibold"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full shrink-0", PROP_DOT[s.key])} />
              {s.label}
              {matching.propositionStatus === s.key && <Check className="h-3 w-3 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Need Modal ───────────────────────────────────────────────────────────

function AddNeedModal({
  open,
  onOpenChange,
  needs,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  needs: NeedOption[];
  onAdd: (needId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");

  const filtered = search.trim()
    ? needs.filter((n) =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.companyName.toLowerCase().includes(search.toLowerCase())
      )
    : needs;

  function handleSubmit() {
    if (!selected) return;
    onAdd(selected);
    setSearch(""); setSelected(""); onOpenChange(false);
  }

  function handleClose() {
    setSearch(""); setSelected(""); onOpenChange(false);
  }

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <ModalContent className="max-w-md">
        <ModalHeader><ModalTitle>Proposer sur un besoin</ModalTitle></ModalHeader>
        <ModalBody className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              autoFocus
              placeholder="Rechercher par titre ou entreprise…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(""); }}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aucun besoin disponible</p>
            )}
            {filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelected(n.id)}
                className={cn(
                  "flex items-start w-full px-3 py-2.5 text-left hover:bg-accent transition-colors gap-3",
                  selected === n.id && "bg-accent"
                )}
              >
                <span className={cn(
                  "mt-0.5 h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center",
                  selected === n.id ? "bg-primary border-primary" : "border-input"
                )}>
                  {selected === n.id && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                </span>
                <span>
                  <span className="text-sm font-medium">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.companyName}</span>
                </span>
              </button>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!selected}>Proposer</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Refusal Reason Modal ─────────────────────────────────────────────────────

function RefusalModal({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
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
        <ModalHeader><ModalTitle>Non retenu</ModalTitle></ModalHeader>
        <ModalBody className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="refusal-reason-c">Motif <span className="text-destructive">*</span></Label>
            <textarea
              id="refusal-reason-c"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(false); }}
              placeholder="Ex : profil trop junior, poste pourvu…"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              autoFocus
            />
            {error && <p className="text-xs text-destructive">Le motif est obligatoire.</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={handleCancel}>Annuler</Button>
          <Button onClick={handleConfirm}>Confirmer</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BlocMatchings({
  candidateId,
  initialMatchings,
  availableNeeds,
}: {
  candidateId: string;
  initialMatchings: MatchingForCandidate[];
  availableNeeds: NeedOption[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [refusalPending, setRefusalPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [matchings, setOptimistic] = useOptimistic(
    initialMatchings,
    (state, action:
      | { type: "add"; matching: MatchingForCandidate }
      | { type: "update"; id: string; status: string }
      | { type: "remove"; id: string }
      | { type: "winner"; id: string }
    ) => {
      switch (action.type) {
        case "add":    return [...state, action.matching];
        case "update": return state.map((m) => m.id === action.id ? { ...m, propositionStatus: action.status } : m);
        case "remove": return state.filter((m) => m.id !== action.id);
        case "winner": return state.map((m) =>
          m.id === action.id
            ? { ...m, isWinner: true, isFrozen: false, propositionStatus: "placed" }
            : m
        );
      }
    }
  );

  const matchedNeedIds = new Set(matchings.map((m) => m.needId));
  const available = availableNeeds.filter((n) => !matchedNeedIds.has(n.id));

  function handleStatusChange(matchingId: string, status: string) {
    if (status === "not_retained") {
      setRefusalPending(matchingId);
      return;
    }
    if (status === "placed") {
      startTransition(async () => {
        setOptimistic({ type: "winner", id: matchingId });
        await markMatchingWinner(matchingId);
      });
      return;
    }
    startTransition(async () => {
      setOptimistic({ type: "update", id: matchingId, status });
      await updateMatchingStatus(matchingId, status);
    });
  }

  function handleRefusalConfirm(reason: string) {
    if (!refusalPending) return;
    const id = refusalPending;
    setRefusalPending(null);
    startTransition(async () => {
      setOptimistic({ type: "update", id, status: "not_retained" });
      await updateMatchingStatus(id, "not_retained", reason);
    });
  }

  function handleAdd(needId: string) {
    const need = availableNeeds.find((n) => n.id === needId);
    if (!need) return;
    startTransition(async () => {
      const result = await createMatching(candidateId, needId);
      if (!result.success) { toast.error(result.error); return; }
      setOptimistic({
        type: "add",
        matching: {
          id: result.data.id,
          needId,
          needTitle: need.title,
          companyName: need.companyName,
          targetCursusName: null,
          needStatus: need.status,
          propositionStatus: "cv_sent",
          isWinner: false,
          isFrozen: false,
          refusalReason: null,
          createdAt: new Date().toISOString(),
        },
      });
      toast.success(`Proposé sur « ${need.title} »`);
    });
  }

  function handleDelete(matchingId: string) {
    startTransition(async () => {
      setOptimistic({ type: "remove", id: matchingId });
      await deleteMatching(matchingId);
    });
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-5 py-3.5 border-b">
        <h2 className="text-sm font-semibold">
          Besoins
          <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground min-w-[1.25rem]">
            {matchings.length}
          </span>
        </h2>
        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Proposer sur un besoin
        </Button>
      </div>

      {matchings.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">Aucun besoin lié à ce candidat.</p>
          <button onClick={() => setAddOpen(true)} className="mt-2 text-sm text-primary hover:underline">
            Proposer sur un premier besoin
          </button>
        </div>
      ) : (
        <div className="divide-y">
          {matchings.map((m) => (
            <div key={m.id} className={cn("flex items-center gap-4 px-5 py-3", m.isFrozen && !m.isWinner && "opacity-60")}>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/besoins/${m.needId}`}
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  {m.needTitle}
                </Link>
                <p className="text-xs text-muted-foreground truncate">{m.companyName}</p>
                {m.refusalReason && (
                  <p className="text-xs text-muted-foreground/70 italic truncate mt-0.5">↳ {m.refusalReason}</p>
                )}
              </div>
              <StatusPicker matching={m} onStatusChange={handleStatusChange} />
              <button
                onClick={() => handleDelete(m.id)}
                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                title="Retirer cette proposition"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AddNeedModal
        open={addOpen}
        onOpenChange={setAddOpen}
        needs={available}
        onAdd={handleAdd}
      />

      <RefusalModal
        open={!!refusalPending}
        onConfirm={handleRefusalConfirm}
        onCancel={() => setRefusalPending(null)}
      />
    </section>
  );
}
