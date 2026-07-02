"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getNouveauxBesoinsData } from "@/app/(app)/dashboard/widget-actions";
import type { DashboardScope } from "@/app/(app)/dashboard/DashboardClient";

function Trend({ current, previous, label }: { current: number; previous: number; label: string }) {
  const delta = current - previous;
  const pct = previous > 0 ? Math.round((delta / previous) * 100) : null;

  return (
    <div className="flex-1 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold">{current}</p>
      <div className={cn(
        "flex items-center gap-1 text-xs font-medium",
        delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-muted-foreground"
      )}>
        {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
        <span>
          {delta > 0 ? "+" : ""}{delta}
          {pct !== null && <span className="text-muted-foreground ml-1">({pct > 0 ? "+" : ""}{pct}%)</span>}
          {" vs période préc."}
        </span>
      </div>
    </div>
  );
}

export function WidgetNouveauxBesoins({ scope }: { scope: DashboardScope }) {
  const [data, setData] = useState<{ last7: number; last30: number; prev7: number; prev30: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getNouveauxBesoinsData(scope).then(setData).finally(() => setLoading(false));
  }, [scope]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  return (
    <div className="flex gap-6 h-full items-start pt-2">
      <Trend current={data.last7} previous={data.prev7} label="7 derniers jours" />
      <div className="w-px bg-border shrink-0 self-stretch" />
      <Trend current={data.last30} previous={data.prev30} label="30 derniers jours" />
    </div>
  );
}
