"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getBesoinsPerduData } from "@/app/(app)/dashboard/widget-actions";
import type { DashboardScope } from "@/app/(app)/dashboard/DashboardClient";

export function WidgetBesoinsLost({ scope }: { scope: DashboardScope }) {
  const [data, setData] = useState<{ total: number; topMotifs: { motif: string; count: number }[]; schoolYear: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBesoinsPerduData(scope).then(setData).finally(() => setLoading(false));
  }, [scope]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const maxCount = Math.max(...data.topMotifs.map((m) => m.count), 1);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="text-center shrink-0">
        <p className="text-4xl font-bold text-destructive">{data.total}</p>
        <p className="text-xs text-muted-foreground mt-1">
          besoin{data.total !== 1 ? "s" : ""} perdu{data.total !== 1 ? "s" : ""} · {data.schoolYear}
        </p>
      </div>

      {data.topMotifs.length > 0 && (
        <div className="flex-1 min-h-0 space-y-2.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top motifs</p>
          {data.topMotifs.map((m, i) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs truncate flex-1">{m.motif}</span>
                <span className="text-xs font-semibold shrink-0 text-muted-foreground">{m.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-destructive/50"
                  style={{ width: `${(m.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {data.total === 0 && (
        <p className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Aucun besoin perdu cette année scolaire
        </p>
      )}
    </div>
  );
}
