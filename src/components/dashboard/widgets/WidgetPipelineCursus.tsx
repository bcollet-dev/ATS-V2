"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPipelineCursusData } from "@/app/(app)/dashboard/widget-actions";
import type { DashboardScope } from "@/app/(app)/dashboard/DashboardClient";

export function WidgetPipelineCursus({ scope, startYear }: { scope: DashboardScope; startYear?: number }) {
  const [data, setData] = useState<{ rows: { cursus: string; inPipeline: number; placed: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPipelineCursusData(scope, startYear).then(setData).finally(() => setLoading(false));
  }, [scope, startYear]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data || data.rows.length === 0) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Aucun candidat actif</div>;
  }

  const maxPipeline = Math.max(...data.rows.map((r) => r.inPipeline), 1);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 shrink-0 mb-2 px-1">
        <span className="flex-1 text-xs text-muted-foreground font-medium">Cursus</span>
        <span className="w-20 text-xs text-muted-foreground font-medium text-right">Pipeline</span>
        <span className="w-14 text-xs text-muted-foreground font-medium text-right">Placés</span>
      </div>
      <div className="flex-1 overflow-auto min-h-0 space-y-1.5">
        {data.rows.map((row) => (
          <div key={row.cursus} className="flex items-center gap-2 px-1">
            <span className="flex-1 text-xs truncate" title={row.cursus}>{row.cursus}</span>
            <div className="w-20 flex items-center gap-1.5">
              <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/40"
                  style={{ width: `${(row.inPipeline / maxPipeline) * 100}%` }}
                />
              </div>
              <span className="text-xs font-semibold w-4 text-right shrink-0">{row.inPipeline}</span>
            </div>
            <span className={cn("w-14 text-right text-xs font-semibold", row.placed > 0 ? "text-emerald-600" : "text-muted-foreground/40")}>
              {row.placed > 0 ? row.placed : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
