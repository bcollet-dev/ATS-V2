"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getComparatifData } from "@/app/(app)/dashboard/widget-actions";
import type { DashboardScope } from "@/app/(app)/dashboard/DashboardClient";

function pct(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 100);
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  if (delta === 0) return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />0 pt</span>;
  if (delta > 0) return <span className="flex items-center gap-0.5 text-xs text-emerald-600"><TrendingUp className="h-3 w-3" />+{delta} pt</span>;
  return <span className="flex items-center gap-0.5 text-xs text-red-500"><TrendingDown className="h-3 w-3" />{delta} pt</span>;
}

function YearColumn({ data, isMain }: { data: { label: string; candidatesPlaced: number; candidatesTotal: number; needsFilled: number; needsTotal: number }; isMain: boolean }) {
  const cp = pct(data.candidatesPlaced, data.candidatesTotal);
  const np = pct(data.needsFilled, data.needsTotal);
  return (
    <div className={cn("flex-1 rounded-lg p-3 space-y-3", isMain ? "bg-primary/5 border border-primary/20" : "bg-muted/40")}>
      <p className={cn("text-xs font-semibold text-center", isMain ? "text-primary" : "text-muted-foreground")}>{data.label}</p>
      <div className="space-y-2">
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Candidats placés</p>
          <p className="text-xl font-bold">{cp}<span className="text-sm font-normal text-muted-foreground">%</span></p>
          <p className="text-xs text-muted-foreground">{data.candidatesPlaced} / {data.candidatesTotal}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">Besoins pourvus</p>
          <p className="text-xl font-bold">{np}<span className="text-sm font-normal text-muted-foreground">%</span></p>
          <p className="text-xs text-muted-foreground">{data.needsFilled} / {data.needsTotal}</p>
        </div>
      </div>
    </div>
  );
}

export function WidgetComparatif({ scope, startYear }: { scope: DashboardScope; startYear?: number }) {
  const [data, setData] = useState<{
    current: { label: string; candidatesPlaced: number; candidatesTotal: number; needsFilled: number; needsTotal: number };
    previous: { label: string; candidatesPlaced: number; candidatesTotal: number; needsFilled: number; needsTotal: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getComparatifData(scope, startYear).then(setData).finally(() => setLoading(false));
  }, [scope, startYear]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const cpCurrent = pct(data.current.candidatesPlaced, data.current.candidatesTotal);
  const cpPrevious = pct(data.previous.candidatesPlaced, data.previous.candidatesTotal);
  const npCurrent = pct(data.current.needsFilled, data.current.needsTotal);
  const npPrevious = pct(data.previous.needsFilled, data.previous.needsTotal);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex gap-2 flex-1 min-h-0">
        <YearColumn data={data.previous} isMain={false} />
        <YearColumn data={data.current} isMain={true} />
      </div>
      <div className="flex gap-2 shrink-0">
        <div className="flex-1 flex flex-col items-center gap-0.5 rounded bg-muted/30 py-1.5">
          <p className="text-xs text-muted-foreground">Candidats</p>
          <Delta current={cpCurrent} previous={cpPrevious} />
        </div>
        <div className="flex-1 flex flex-col items-center gap-0.5 rounded bg-muted/30 py-1.5">
          <p className="text-xs text-muted-foreground">Besoins</p>
          <Delta current={npCurrent} previous={npPrevious} />
        </div>
      </div>
    </div>
  );
}
