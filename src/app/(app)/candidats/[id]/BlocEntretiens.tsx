"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Play, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DECISION_LABELS,
  isPositioningSubcategory,
  type InterviewDecision,
} from "@/lib/interview-grid";
import { StartInterviewModal } from "@/components/entretiens/StartInterviewModal";
import type { CandidateInterviewRow } from "@/app/(app)/entretiens/actions";

const DECISION_BADGE: Record<string, string> = {
  admissible: "bg-emerald-100 text-emerald-700",
  temporary_refusal: "bg-amber-100 text-amber-700",
  definitive_refusal: "bg-red-100 text-red-700",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function BlocEntretiens({
  candidateId,
  candidateName,
  interviews,
  canConduct,
}: {
  candidateId: string;
  candidateName: string;
  interviews: CandidateInterviewRow[];
  canConduct: boolean;
}) {
  const [startOpen, setStartOpen] = useState(false);
  const hasDraft = interviews.some((i) => i.status === "draft");

  return (
    <section className="rounded-lg border bg-card">
      <StartInterviewModal
        open={startOpen}
        onOpenChange={setStartOpen}
        candidateId={candidateId}
        candidateName={candidateName}
      />

      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">Entretiens</h2>
        {canConduct && !hasDraft && (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setStartOpen(true)}>
            <Play className="h-3.5 w-3.5" />
            Nouvel entretien
          </Button>
        )}
      </div>

      {interviews.length === 0 ? (
        <p className="px-5 py-4 text-sm italic text-muted-foreground/60">Aucun entretien passé.</p>
      ) : (
        <div className="divide-y">
          {interviews.map((interview) => (
            <div key={interview.id} className="space-y-2 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{interview.trameName}</span>
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
                    {interview.status === "draft" ? (
                      <Badge className="border-0 bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                        Brouillon
                      </Badge>
                    ) : (
                      interview.decision && (
                        <Badge
                          className={`border-0 px-1.5 py-0.5 text-xs ${DECISION_BADGE[interview.decision] ?? "bg-muted text-muted-foreground"}`}
                        >
                          {DECISION_LABELS[interview.decision as InterviewDecision] ?? interview.decision}
                        </Badge>
                      )
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    <span>
                      {interview.status === "completed"
                        ? formatDate(interview.completedAt)
                        : `démarré le ${formatDate(interview.createdAt)}`}
                    </span>
                    {interview.conductedByName && <span>par {interview.conductedByName}</span>}
                    {interview.averageScore !== null && <span>moyenne {interview.averageScore}/5</span>}
                  </div>
                </div>
                <Link
                  href={`/entretiens/${interview.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 shrink-0 gap-1.5 text-xs")}
                >
                  {interview.status === "draft" ? (
                    <><Play className="h-3 w-3" />Reprendre</>
                  ) : (
                    <><Eye className="h-3 w-3" />Consulter</>
                  )}
                </Link>
              </div>

              {interview.status === "completed" && (
                interview.aiSummary ? (
                  <div className="rounded-md bg-muted/40 px-3 py-2.5">
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-violet-500" />
                      Résumé de l'entretien
                    </p>
                    <p className="whitespace-pre-wrap text-sm">{interview.aiSummary}</p>
                  </div>
                ) : (
                  <p className="text-xs italic text-muted-foreground/60">
                    Pas encore de résumé — consultez l'entretien pour le rédiger.
                  </p>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
