"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlacementsParClasseData } from "@/app/(app)/dashboard/widget-actions";
import type { DashboardScope } from "@/app/(app)/dashboard/DashboardClient";

export function WidgetPlacementsClasse({ scope, startYear }: { scope: DashboardScope; startYear?: number }) {
  const [data, setData] = useState<{
    rows: { classId: string; className: string; cursusName: string; total: number }[];
    hasData: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPlacementsParClasseData(scope, startYear).then(setData).finally(() => setLoading(false));
  }, [scope, startYear]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  if (!data.hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-4">
        <p className="text-sm text-muted-foreground">Aucun placement Ypareo enregistré.</p>
        <p className="text-xs text-muted-foreground/70">
          Utilisez le bouton Ypareo sur le pipeline pour alimenter ce widget.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 shrink-0 mb-2 px-1">
        <span className="flex-1 text-xs text-muted-foreground font-medium">Classe</span>
        <span className="w-20 text-xs text-muted-foreground font-medium">Cursus</span>
        <span className="w-12 text-right text-xs text-muted-foreground font-medium">Placés</span>
      </div>
      <div className="flex-1 overflow-auto min-h-0 space-y-1">
        {data.rows.map((row) => (
          <div key={row.classId} className="flex items-center gap-2 px-1 py-0.5">
            <span className="flex-1 text-xs font-medium truncate" title={row.className}>{row.className}</span>
            <span className="w-20 text-xs text-muted-foreground truncate">{row.cursusName}</span>
            <span className={cn("w-12 text-right text-xs font-semibold", row.total > 0 ? "text-emerald-600" : "text-muted-foreground/40")}>
              {row.total}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
