"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRelancesData, type OverdueTask, type InactiveCandidate } from "@/app/(app)/dashboard/widget-actions";
import type { DashboardScope } from "@/app/(app)/dashboard/DashboardClient";

const STATUS_LABELS: Record<string, string> = {
  to_call: "À appeler",
  in_progress: "En cours",
};

function daysBadge(days: number) {
  if (days >= 14) return "bg-red-100 text-red-700";
  if (days >= 7)  return "bg-amber-100 text-amber-700";
  return "bg-muted text-muted-foreground";
}

function overdueBadge(dueAt: string) {
  const diff = Math.floor((Date.now() - new Date(dueAt).getTime()) / (1000 * 60 * 60 * 24));
  if (diff >= 3) return "text-destructive";
  return "text-muted-foreground";
}

export function WidgetRelances({ scope }: { scope: DashboardScope }) {
  const [tab, setTab] = useState<"tasks" | "candidates">("tasks");
  const [data, setData] = useState<{ overdueTasks: OverdueTask[]; inactiveCandidates: InactiveCandidate[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRelancesData(scope).then(setData).finally(() => setLoading(false));
  }, [scope]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const taskCount = data.overdueTasks.length;
  const candidateCount = data.inactiveCandidates.length;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/40 w-fit shrink-0">
        <button
          onClick={() => setTab("tasks")}
          className={cn("flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
            tab === "tasks" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Tâches échues
          {taskCount > 0 && <span className="ml-1 rounded-full bg-destructive/15 text-destructive px-1.5 py-0.5 text-[10px] font-semibold">{taskCount}</span>}
        </button>
        <button
          onClick={() => setTab("candidates")}
          className={cn("flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
            tab === "candidates" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Candidats inactifs
          {candidateCount > 0 && <span className="ml-1 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-semibold">{candidateCount}</span>}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {tab === "tasks" && (
          taskCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground gap-2">
              <Clock className="h-6 w-6 opacity-30" />
              Aucune tâche en retard
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b">
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Tâche</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Lié à</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Échéance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.overdueTasks.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-2 py-2 text-sm font-medium">{t.title}</td>
                    <td className="px-2 py-2 text-xs text-muted-foreground">
                      {t.candidateName && (
                        <a href={`/candidats/${t.candidateId}`} className="hover:underline text-foreground block">
                          {t.candidateName}
                        </a>
                      )}
                      {t.needTitle && (
                        <a href={`/besoins/${t.needId}`} className="hover:underline block">
                          {t.needTitle}
                        </a>
                      )}
                    </td>
                    <td className={cn("px-2 py-2 text-xs whitespace-nowrap", overdueBadge(t.dueAt))}>
                      {new Date(t.dueAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {tab === "candidates" && (
          candidateCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground gap-2">
              <AlertCircle className="h-6 w-6 opacity-30" />
              Aucun candidat inactif depuis 7 jours
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b">
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Candidat</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Statut</th>
                  <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Inactif depuis</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.inactiveCandidates.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-2 py-2">
                      <a href={`/candidats/${c.id}`} className="text-sm font-medium hover:underline">
                        {c.firstName} {c.lastName}
                      </a>
                      {c.ownerName && <p className="text-xs text-muted-foreground">{c.ownerName}</p>}
                    </td>
                    <td className="px-2 py-2">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", daysBadge(c.daysSinceActivity))}>
                        {c.daysSinceActivity >= 999 ? "Jamais" : `${c.daysSinceActivity}j`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
