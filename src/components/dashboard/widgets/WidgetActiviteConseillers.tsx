"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiviteConseillerData } from "@/app/(app)/dashboard/widget-actions";
import type { DashboardScope } from "@/app/(app)/dashboard/DashboardClient";

export function WidgetActiviteConseillers({ scope, startYear }: { scope: DashboardScope; startYear?: number }) {
  const [data, setData] = useState<{
    rows: { userId: string; name: string; events: number; tasksCompleted: number }[];
    schoolYear: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getActiviteConseillerData(scope, startYear).then(setData).finally(() => setLoading(false));
  }, [scope, startYear]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data || data.rows.length === 0) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Aucune activité enregistrée</div>;
  }

  const maxEvents = Math.max(...data.rows.map((r) => r.events), 1);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 shrink-0 mb-2 px-1">
        <span className="flex-1 text-xs text-muted-foreground font-medium">Conseiller</span>
        <span className="w-24 text-xs text-muted-foreground font-medium text-right">Activités</span>
        <span className="w-16 text-xs text-muted-foreground font-medium text-right">Tâches</span>
      </div>
      <div className="flex-1 overflow-auto min-h-0 space-y-2">
        {data.rows.map((row, i) => (
          <div key={row.userId} className="flex items-center gap-2 px-1">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className={cn("text-xs font-semibold w-4 shrink-0", i === 0 ? "text-amber-500" : "text-muted-foreground/50")}>
                {i + 1}
              </span>
              <span className="text-xs truncate">{row.name}</span>
            </div>
            <div className="w-24 flex items-center gap-1.5">
              <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                <div className="h-full rounded-full bg-primary/40" style={{ width: `${(row.events / maxEvents) * 100}%` }} />
              </div>
              <span className="text-xs font-semibold w-6 text-right shrink-0">{row.events}</span>
            </div>
            <span className="w-16 text-right text-xs font-semibold text-muted-foreground">{row.tasksCompleted}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground shrink-0 mt-2">Année scolaire {data.schoolYear}</p>
    </div>
  );
}
