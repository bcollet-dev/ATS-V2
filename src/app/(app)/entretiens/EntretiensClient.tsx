"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ClipboardList,
  Eye,
  Loader2,
  MapPin,
  Play,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  startInterview,
  type InterviewCandidateRow,
  type CompletedInterviewRow,
} from "./actions";

const RECOMMENDATION_BADGE: Record<string, { label: string; className: string }> = {
  favorable: { label: "Favorable", className: "bg-emerald-100 text-emerald-700" },
  reserve: { label: "Réservé", className: "bg-amber-100 text-amber-700" },
  defavorable: { label: "Défavorable", className: "bg-red-100 text-red-700" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CandidateCard({
  candidate,
  canConduct,
}: {
  candidate: InterviewCandidateRow;
  canConduct: boolean;
}) {
  const router = useRouter();
  const [isStarting, startStart] = useTransition();

  function handleStart() {
    startStart(async () => {
      const result = await startInterview(candidate.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      router.push(`/entretiens/${result.interviewId}`);
    });
  }

  const draft = candidate.interview?.status === "draft" ? candidate.interview : null;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <Link
          href={`/candidats/${candidate.id}`}
          className="text-sm font-medium hover:underline"
        >
          {candidate.firstName} {candidate.lastName}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{candidate.cursusEnvisage ?? "Cursus non renseigné"}</span>
          {candidate.city && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {candidate.city}
            </span>
          )}
        </div>
      </div>
      {!candidate.hasGrid && (
        <Badge className="shrink-0 border-0 bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
          Grille manquante
        </Badge>
      )}
      {canConduct && (
        <Button
          size="sm"
          variant={draft ? "outline" : "default"}
          className="h-8 shrink-0 gap-1.5"
          onClick={handleStart}
          disabled={isStarting || (!candidate.hasGrid && !draft)}
        >
          {isStarting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {draft ? "Reprendre l'entretien" : "Passer l'entretien"}
        </Button>
      )}
    </div>
  );
}

export function EntretiensClient({
  initialCandidates,
  initialCompleted,
  canConduct,
}: {
  initialCandidates: InterviewCandidateRow[];
  initialCompleted: CompletedInterviewRow[];
  canConduct: boolean;
}) {
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const filteredCandidates = q
    ? initialCandidates.filter((c) =>
        `${c.firstName} ${c.lastName} ${c.cursusEnvisage ?? ""}`.toLowerCase().includes(q)
      )
    : initialCandidates;
  const filteredCompleted = q
    ? initialCompleted.filter((i) =>
        `${i.candidateName} ${i.cursusName ?? ""}`.toLowerCase().includes(q)
      )
    : initialCompleted;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Entretiens</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Entretiens de motivation EDA — grille par cursus, résumé IA
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
            <Button asChild variant="outline" className="shrink-0 gap-1.5">
              <Link href="/entretiens/grilles">
                <Settings2 className="h-4 w-4" />
                Grilles
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* ── Candidats au statut Entretien ── */}
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
              pipeline pour lancer son entretien.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCandidates.map((c) => (
              <CandidateCard key={c.id} candidate={c} canConduct={canConduct} />
            ))}
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
            {filteredCompleted.map((interview) => {
              const badge = interview.recommendation
                ? RECOMMENDATION_BADGE[interview.recommendation]
                : null;
              return (
                <div
                  key={interview.id}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/candidats/${interview.candidateId}`}
                      className="text-sm font-medium hover:underline"
                    >
                      {interview.candidateName}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {interview.cursusName && <span>{interview.cursusName}</span>}
                      <span>{formatDate(interview.completedAt)}</span>
                      {interview.conductedByName && <span>par {interview.conductedByName}</span>}
                      {interview.averageScore !== null && (
                        <span>moyenne {interview.averageScore}/5</span>
                      )}
                    </div>
                  </div>
                  {interview.hasAiSummary && (
                    <span title="Résumé IA disponible">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                    </span>
                  )}
                  {badge && (
                    <Badge className={`shrink-0 border-0 px-2 py-0.5 text-xs ${badge.className}`}>
                      {badge.label}
                    </Badge>
                  )}
                  <Button asChild size="sm" variant="outline" className="h-8 shrink-0 gap-1.5">
                    <Link href={`/entretiens/${interview.id}`}>
                      <Eye className="h-3.5 w-3.5" />
                      Consulter
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
