"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Eye,
  MapPin,
  Play,
  Plus,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Modal, ModalBody, ModalContent, ModalHeader, ModalTitle,
} from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { DECISION_LABELS, isPositioningSubcategory } from "@/lib/interview-grid";
import { StartInterviewModal } from "@/components/entretiens/StartInterviewModal";
import type {
  InterviewCandidateRow,
  CompletedInterviewRow,
  PickableCandidateRow,
} from "./actions";

const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  to_call: "À appeler",
  in_progress: "En cours",
  no_response: "NRP",
  interview: "Entretien EDA",
  pvpp: "PVPP",
  admissible: "Admissible",
  company_interview: "Entretien entreprise",
  waiting_fre: "Attente FRE",
  placed: "Placé",
  temporary_refusal: "Refus temporaire",
  definitive_refusal: "Refus définitif",
  rupture: "Rupture",
};

// Sélecteur de candidat pour lancer un entretien ponctuel, quel que soit le
// statut du candidat dans le pipeline.
function PickCandidateModal({
  open,
  onOpenChange,
  candidates,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: PickableCandidateRow[];
  onPick: (candidate: PickableCandidateRow) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const results = q
    ? candidates
        .filter((c) =>
          `${c.firstName} ${c.lastName} ${c.cursusEnvisage ?? ""}`.toLowerCase().includes(q)
        )
        .slice(0, 20)
    : [];

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) setSearch(""); onOpenChange(o); }}>
      <ModalContent className="max-w-md">
        <ModalHeader><ModalTitle>Nouvel entretien</ModalTitle></ModalHeader>
        <ModalBody className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Recherchez le candidat à faire passer — quel que soit son statut dans le pipeline.
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              autoFocus
              placeholder="Rechercher un candidat…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {q && (
            <div className="max-h-72 divide-y overflow-y-auto rounded-md border">
              {results.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Aucun candidat</p>
              ) : (
                results.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSearch(""); onPick(c); }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{c.firstName} {c.lastName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.cursusEnvisage ?? "Cursus non renseigné"}
                      </span>
                    </span>
                    <Badge className="shrink-0 border-0 bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {CANDIDATE_STATUS_LABELS[c.status] ?? c.status}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

const DECISION_BADGE: Record<string, string> = {
  admissible: "bg-emerald-100 text-emerald-700",
  temporary_refusal: "bg-amber-100 text-amber-700",
  definitive_refusal: "bg-red-100 text-red-700",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function EntretiensClient({
  initialCandidates,
  initialCompleted,
  allCandidates,
  canConduct,
  canManageTrames,
}: {
  initialCandidates: InterviewCandidateRow[];
  initialCompleted: CompletedInterviewRow[];
  allCandidates: PickableCandidateRow[];
  canConduct: boolean;
  canManageTrames: boolean;
}) {
  const [search, setSearch] = useState("");
  const [startTarget, setStartTarget] = useState<{ id: string; name: string } | null>(null);
  const [pickOpen, setPickOpen] = useState(false);

  const q = search.trim().toLowerCase();
  const filteredCandidates = q
    ? initialCandidates.filter((c) =>
        `${c.firstName} ${c.lastName} ${c.cursusEnvisage ?? ""}`.toLowerCase().includes(q)
      )
    : initialCandidates;
  const filteredCompleted = q
    ? initialCompleted.filter((i) =>
        `${i.candidateName} ${i.trameName} ${i.cursusName ?? ""}`.toLowerCase().includes(q)
      )
    : initialCompleted;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      {startTarget && (
        <StartInterviewModal
          open={!!startTarget}
          onOpenChange={(open) => { if (!open) setStartTarget(null); }}
          candidateId={startTarget.id}
          candidateName={startTarget.name}
        />
      )}

      {canConduct && (
        <PickCandidateModal
          open={pickOpen}
          onOpenChange={setPickOpen}
          candidates={allCandidates}
          onPick={(c) => {
            setPickOpen(false);
            setStartTarget({ id: c.id, name: `${c.firstName} ${c.lastName}` });
          }}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Entretiens</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Passation des trames d'entretien et historique — le positionnement pilote l'admission
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs sm:w-52",
              "focus:outline-none focus:ring-1 focus:ring-ring"
            )}
          />
          {canConduct && (
            <Button className="shrink-0 gap-1.5" onClick={() => setPickOpen(true)}>
              <Plus className="h-4 w-4" />
              Nouvel entretien
            </Button>
          )}
          {canManageTrames && (
            <Link
              href="/trames/entretien"
              className={cn(buttonVariants({ variant: "outline" }), "shrink-0 gap-1.5")}
            >
              <Settings2 className="h-4 w-4" />
              Trames
            </Link>
          )}
        </div>
      </div>

      {/* ── Candidats au statut Entretien EDA ── */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">
          À faire passer
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {filteredCandidates.length} candidat{filteredCandidates.length !== 1 ? "s" : ""} au
            statut Entretien EDA
          </span>
        </h2>
        {filteredCandidates.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aucun candidat au statut « Entretien EDA ». Placez un candidat dans cette colonne du
              pipeline, ou lancez un entretien depuis sa fiche.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCandidates.map((c) => {
              const draft = c.interview?.status === "draft" ? c.interview : null;
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/candidats/${c.id}`} className="text-sm font-medium hover:underline">
                      {c.firstName} {c.lastName}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{c.cursusEnvisage ?? "Cursus non renseigné"}</span>
                      {c.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {c.city}
                        </span>
                      )}
                    </div>
                  </div>
                  {canConduct && (
                    draft ? (
                      <Link
                        href={`/entretiens/${draft.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 shrink-0 gap-1.5")}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Reprendre l'entretien
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8 shrink-0 gap-1.5"
                        onClick={() => setStartTarget({ id: c.id, name: `${c.firstName} ${c.lastName}` })}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Passer l'entretien
                      </Button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Entretiens réalisés ── */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">
          Entretiens réalisés
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {filteredCompleted.length} entretien{filteredCompleted.length !== 1 ? "s" : ""}
          </span>
        </h2>
        {filteredCompleted.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Aucun entretien finalisé pour le moment.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCompleted.map((interview) => (
              <div key={interview.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/candidats/${interview.candidateId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {interview.candidateName}
                    </Link>
                    <Badge
                      className={cn(
                        "border-0 px-1.5 py-0.5 text-xs",
                        isPositioningSubcategory(interview.subcategory)
                          ? "bg-blue-100 text-blue-700"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {interview.subcategory}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{interview.trameName}</span>
                    <span>{formatDate(interview.completedAt)}</span>
                    {interview.conductedByName && <span>par {interview.conductedByName}</span>}
                    {interview.averageScore !== null && <span>moyenne {interview.averageScore}/5</span>}
                  </div>
                </div>
                {interview.hasAiSummary && (
                  <span title="Résumé IA disponible">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                  </span>
                )}
                {interview.decision && (
                  <Badge
                    className={`shrink-0 border-0 px-2 py-0.5 text-xs ${DECISION_BADGE[interview.decision] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {DECISION_LABELS[interview.decision as keyof typeof DECISION_LABELS] ?? interview.decision}
                  </Badge>
                )}
                <Link
                  href={`/entretiens/${interview.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 shrink-0 gap-1.5")}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Consulter
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
