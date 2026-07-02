"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTauxPlacementData } from "@/app/(app)/dashboard/widget-actions";
import type { DashboardScope } from "@/app/(app)/dashboard/DashboardClient";

function pct(num: number, den: number) {
  if (den === 0) return 0;
  return Math.round((num / den) * 100);
}

function progressColor(p: number) {
  if (p >= 50) return "bg-emerald-400";
  if (p >= 25) return "bg-amber-400";
  return "bg-red-400";
}

function KPI({ label, numerator, denominator }: { label: string; numerator: number; denominator: number }) {
  const p = pct(numerator, denominator);
  return (
    <div className="flex-1 space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold">{p}<span className="text-lg font-medium text-muted-foreground">%</span></p>
      <p className="text-xs text-muted-foreground">{numerator} sur {denominator}</p>
      <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", progressColor(p))} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

export function WidgetTauxPlacement({ scope }: { scope: DashboardScope }) {
  const [data, setData] = useState<{
    candidatesPlaced: number; candidatesTotal: number;
    needsFilled: number; needsTotal: number; schoolYear: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTauxPlacementData(scope).then(setData).finally(() => setLoading(false));
  }, [scope]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex gap-6">
        <KPI label="Candidats placés" numerator={data.candidatesPlaced} denominator={data.candidatesTotal} />
        <div className="w-px bg-border shrink-0" />
        <KPI label="Besoins pourvus" numerator={data.needsFilled} denominator={data.needsTotal} />
      </div>
      <p className="text-xs text-muted-foreground mt-auto">Année scolaire {data.schoolYear}</p>
    </div>
  );
}
