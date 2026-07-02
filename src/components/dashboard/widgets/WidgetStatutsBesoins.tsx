"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatutsBesoinsData } from "@/app/(app)/dashboard/widget-actions";
import type { DashboardScope } from "@/app/(app)/dashboard/DashboardClient";

const STATUS_COLORS: Record<string, string> = {
  ad_chase:         "bg-slate-200",
  prospect:         "bg-blue-200",
  need_in_progress: "bg-violet-200",
  a_shooter:        "bg-amber-200",
  cv_envoye:        "bg-sky-200",
  interview:        "bg-orange-200",
  waiting_fre:      "bg-amber-300",
  client:           "bg-emerald-200",
  rupture:          "bg-red-200",
};

export function WidgetStatutsBesoins({ scope }: { scope: DashboardScope }) {
  const [tab, setTab] = useState<"funnel" | "list">("funnel");
  const [data, setData] = useState<{ funnel: { status: string; label: string; count: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStatutsBesoinsData(scope).then(setData).finally(() => setLoading(false));
  }, [scope]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const max = Math.max(...data.funnel.map((f) => f.count), 1);
  const total = data.funnel.reduce((s, f) => s + f.count, 0);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-xs text-muted-foreground">{total} besoin{total !== 1 ? "s" : ""} actifs</span>
        <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/40">
          {(["funnel", "list"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("rounded-md px-2.5 py-0.5 text-xs font-medium transition-colors",
                tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "funnel" ? "Entonnoir" : "Liste"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0 space-y-1.5">
        {tab === "funnel" ? (
          data.funnel.map((item) => (
            <div key={item.status} className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-xs text-muted-foreground truncate">{item.label}</span>
              <div className="flex-1 h-5 rounded-sm bg-muted/40 overflow-hidden">
                <div
                  className={cn("h-full rounded-sm transition-all", STATUS_COLORS[item.status] ?? "bg-muted")}
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </div>
              <span className={cn("w-6 text-right text-xs font-semibold shrink-0", item.count === 0 ? "text-muted-foreground/40" : "text-foreground")}>
                {item.count}
              </span>
            </div>
          ))
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y">
              {data.funnel.map((item) => (
                <tr key={item.status} className={cn(item.count === 0 && "opacity-40")}>
                  <td className="py-1.5 pr-3">
                    <span className={cn("inline-block w-2.5 h-2.5 rounded-sm mr-1.5", STATUS_COLORS[item.status] ?? "bg-muted")} />
                    <span className="text-xs">{item.label}</span>
                  </td>
                  <td className="py-1.5 text-right text-xs font-semibold">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
