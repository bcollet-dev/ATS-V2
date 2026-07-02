"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTauxRuptureData } from "@/app/(app)/dashboard/widget-actions";
import type { DashboardScope } from "@/app/(app)/dashboard/DashboardClient";

export function WidgetTauxRupture({ scope, startYear }: { scope: DashboardScope; startYear?: number }) {
  const [data, setData] = useState<{ ruptures: number; placements: number; schoolYear: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTauxRuptureData(scope, startYear).then(setData).finally(() => setLoading(false));
  }, [scope, startYear]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const total = data.placements + data.ruptures;
  const pct = total > 0 ? Math.round((data.ruptures / total) * 100) : 0;

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="text-center shrink-0">
        <p className={cn("text-4xl font-bold", pct >= 15 ? "text-red-600" : pct >= 8 ? "text-amber-600" : "text-emerald-600")}>
          {pct}<span className="text-xl font-medium text-muted-foreground">%</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">de taux de rupture · {data.schoolYear}</p>
      </div>

      <div className="flex gap-4 justify-center shrink-0">
        <div className="text-center">
          <p className="text-2xl font-semibold text-red-500">{data.ruptures}</p>
          <p className="text-xs text-muted-foreground">rupture{data.ruptures !== 1 ? "s" : ""} de contrat</p>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <p className="text-2xl font-semibold text-emerald-600">{data.placements}</p>
          <p className="text-xs text-muted-foreground">placé{data.placements !== 1 ? "s" : ""}</p>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <p className="text-2xl font-semibold">{total}</p>
          <p className="text-xs text-muted-foreground">total</p>
        </div>
      </div>

      <div className="shrink-0 space-y-1">
        <div className="h-3 rounded-full bg-muted/60 overflow-hidden flex">
          <div className="h-full bg-emerald-400 transition-all" style={{ width: `${100 - pct}%` }} />
          <div className="h-full bg-red-400 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Maintenus</span>
          <span>Ruptures</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center mt-auto">
        {pct >= 15 ? "Taux élevé — à surveiller" : pct >= 8 ? "Taux modéré" : "Taux satisfaisant"}
      </p>
    </div>
  );
}
