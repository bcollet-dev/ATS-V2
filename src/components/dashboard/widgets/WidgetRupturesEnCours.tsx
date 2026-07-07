"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRupturesEnCours, type RuptureEnCours } from "@/app/(app)/dashboard/widget-actions";

function deadlineBadge(deadline: string): { label: string; cls: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: `${Math.abs(diffDays)}j dépassé`, cls: "bg-red-100 text-red-700" };
  }
  if (diffDays <= 30) {
    return { label: `${diffDays}j restant${diffDays > 1 ? "s" : ""}`, cls: "bg-amber-100 text-amber-700" };
  }
  return { label: `${diffDays}j restants`, cls: "bg-muted text-muted-foreground" };
}

export function WidgetRupturesEnCours() {
  const [rows, setRows] = useState<RuptureEnCours[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRupturesEnCours().then(setRows).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground gap-2">
        <AlertTriangle className="h-6 w-6 opacity-30" />
        Aucune rupture en cours
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto min-h-0">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b">
              <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Candidat</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Date limite</th>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Délai</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const badge = deadlineBadge(r.ruptureRechercheDeadline);
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-2 py-2">
                    <a href={`/candidats/${r.id}`} className="text-sm font-medium hover:underline">
                      {r.firstName} {r.lastName}
                    </a>
                  </td>
                  <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(r.ruptureRechercheDeadline).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-2 py-2">
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", badge.cls)}>
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
