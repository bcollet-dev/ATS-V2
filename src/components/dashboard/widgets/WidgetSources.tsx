"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { getSourcesData } from "@/app/(app)/dashboard/widget-actions";
import type { DashboardScope } from "@/app/(app)/dashboard/DashboardClient";

const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);

export function WidgetSources({ scope }: { scope: DashboardScope }) {
  const [data, setData] = useState<{ sources: { source: string; count: number }[]; schoolYear: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSourcesData(scope).then(setData).finally(() => setLoading(false));
  }, [scope]);

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!data || data.sources.length === 0) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Aucune donnée</div>;
  }

  const total = data.sources.reduce((s, r) => s + r.count, 0);

  return (
    <div className="flex flex-col h-full gap-2">
      <p className="text-xs text-muted-foreground shrink-0">
        {total} candidat{total !== 1 ? "s" : ""} · Année scolaire {data.schoolYear}
      </p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data.sources}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
          >
            <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="source"
              width={110}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value) => {
                const v = typeof value === "number" ? value : 0;
                const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                return [`${v} candidat${v !== 1 ? "s" : ""} — ${pct}%`, ""];
              }}
              cursor={{ fill: "hsl(var(--muted))" }}
              contentStyle={{ fontSize: 12, borderRadius: 6 }}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
