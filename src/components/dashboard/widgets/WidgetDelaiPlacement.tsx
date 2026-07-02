"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDelaiPlacementData } from "@/app/(app)/dashboard/widget-actions";
import type { DashboardScope } from "@/app/(app)/dashboard/DashboardClient";

function delaiColor(days: number) {
  if (days <= 30) return "text-emerald-600";
  if (days <= 60) return "text-amber-600";
  return "text-red-600";
}

function barColor(days: number) {
  if (days <= 30) return "bg-emerald-400";
  if (days <= 60) return "bg-amber-400";
  return "bg-red-400";
}

export function WidgetDelaiPlacement({ scope, startYear }: { scope: DashboardScope; startYear?: number }) {
  const [data, setData] = useState<{
    avgDays: number | null;
    byCursus: { cursus: string; avgDays: number }[];
    schoolYear: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDelaiPlacementData(scope, startYear).then(setData).finally(() => setLoading(false));
  }, [scope, startYear]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  if (data.avgDays === null) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Aucun candidat placé cette année</div>;
  }

  const maxDays = Math.max(...data.byCursus.map((r) => r.avgDays), 1);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="text-center shrink-0">
        <p className={cn("text-4xl font-bold", delaiColor(data.avgDays))}>{data.avgDays}</p>
        <p className="text-xs text-muted-foreground mt-1">jours en moyenne · {data.schoolYear}</p>
      </div>

      {data.byCursus.length > 0 && (
        <div className="flex-1 min-h-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Par cursus (du + rapide)</p>
          {data.byCursus.map((r) => (
            <div key={r.cursus} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs truncate flex-1">{r.cursus}</span>
                <span className={cn("text-xs font-semibold shrink-0", delaiColor(r.avgDays))}>{r.avgDays}j</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                <div className={cn("h-full rounded-full", barColor(r.avgDays))} style={{ width: `${(r.avgDays / maxDays) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
