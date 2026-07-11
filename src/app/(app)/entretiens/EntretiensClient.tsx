"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Eye,
  MapPin,
  Play,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DECISION_LABELS, isPositioningSubcategory } from "@/lib/interview-grid";
import { StartInterviewModal } from "@/components/entretiens/StartInterviewModal";
import type { InterviewCandidateRow, CompletedInterviewRow } from "./actions";

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
  canConduct,
  canManageTrames,
}: {
  initialCandidates: InterviewCandidateRow[];
  initialCompleted: CompletedInterviewRow[];
  canConduct: boolean;
  canManageTrames: boolean;
}) {
  const [search, setSearch] = useState("");
  const [startTarget, setStartTarget] = useState<{ id: string; name: string } | null>(null);

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
