"use client";

import { useEffect, useState, useMemo } from "react";
import { AlertTriangle, Loader2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getRupturesEnCours, type RuptureEnCours } from "@/app/(app)/dashboard/widget-actions";

type SortKey = "name" | "deadline";
type SortDir = "asc" | "desc";
type Filter = "all" | "urgent" | "overdue";

function daysDiff(deadline: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline);
  d.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function deadlineBadge(diff: number): { label: string; cls: string } {
  if (diff < 0) return { label: `${Math.abs(diff)}j dépassé`, cls: "bg-red-100 text-red-700" };
  if (diff <= 30) return { label: `${diff}j restant${diff > 1 ? "s" : ""}`, cls: "bg-amber-100 text-amber-700" };
  return { label: `${diff}j restants`, cls: "bg-muted text-muted-foreground" };
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
  return dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
}

export function WidgetRupturesEnCours() {
  const [rows, setRows] = useState<RuptureEnCours[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "deadline", dir: "asc" });
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    getRupturesEnCours().then(setRows).finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    all: rows.length,
    urgent: rows.filter(r => { const d = daysDiff(r.ruptureRechercheDeadline); return d >= 0 && d <= 30; }).length,
    overdue: rows.filter(r => daysDiff(r.ruptureRechercheDeadline) < 0).length,
  }), [rows]);

  const displayed = useMemo(() => {
    let result = [...rows];

    if (filter === "urgent") {
      result = result.filter(r => { const d = daysDiff(r.ruptureRechercheDeadline); return d >= 0 && d <= 30; });
    } else if (filter === "overdue") {
      result = result.filter(r => daysDiff(r.ruptureRechercheDeadline) < 0);
    }

    result.sort((a, b) => {
      if (sort.key === "name") {
        const na = `${a.lastName} ${a.firstName}`.toLowerCase();
        const nb = `${b.lastName} ${b.firstName}`.toLowerCase();
        return sort.dir === "asc" ? na.localeCompare(nb, "fr") : nb.localeCompare(na, "fr");
      }
      const diff = new Date(a.ruptureRechercheDeadline).getTime() - new Date(b.ruptureRechercheDeadline).getTime();
      return sort.dir === "asc" ? diff : -diff;
    });

    return result;
  }, [rows, sort, filter]);

  function toggleSort(key: SortKey) {
    setSort(prev =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-sm text-muted-foreground gap-2">
        <AlertTriangle className="h-6 w-6 opacity-30" />
        Aucune rupture en cours
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1.5 px-2 pt-1.5 pb-2 border-b shrink-0 flex-wrap">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} color="neutral">
          Tous ({counts.all})
        </FilterChip>
        {counts.urgent > 0 && (
          <FilterChip active={filter === "urgent"} onClick={() => setFilter("urgent")} color="amber">
            ≤ 30j ({counts.urgent})
          </FilterChip>
        )}
        {counts.overdue > 0 && (
          <FilterChip active={filter === "overdue"} onClick={() => setFilter("overdue")} color="red">
            Dépassés ({counts.overdue})
          </FilterChip>
        )}
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {displayed.length === 0 ? (
          <div className="flex items-center justify-center h-12 text-xs text-muted-foreground">
            Aucun résultat
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b">
                <th className="px-2 py-1.5 text-left">
                  <button
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Candidat
                    <SortIcon active={sort.key === "name"} dir={sort.dir} />
                  </button>
                </th>
                <th className="px-2 py-1.5 text-left">
                  <button
                    onClick={() => toggleSort("deadline")}
                    className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    Date limite
                    <SortIcon active={sort.key === "deadline"} dir={sort.dir} />
                  </button>
                </th>
                <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">
                  Délai
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayed.map((r) => {
                const diff = daysDiff(r.ruptureRechercheDeadline);
                const badge = deadlineBadge(diff);
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-2 py-2">
                      <a href={`/candidats/${r.id}`} className="font-medium hover:underline">
                        {r.firstName} {r.lastName}
                      </a>
                    </td>
                    <td className="px-2 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(r.ruptureRechercheDeadline).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-2 py-2">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", badge.cls)}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color: "neutral" | "amber" | "red";
  children: React.ReactNode;
}) {
  const base = "px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer";
  if (color === "amber") {
    return (
      <button onClick={onClick} className={cn(base, active ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-700 hover:bg-amber-200")}>
        {children}
      </button>
    );
  }
  if (color === "red") {
    return (
      <button onClick={onClick} className={cn(base, active ? "bg-red-600 text-white" : "bg-red-100 text-red-700 hover:bg-red-200")}>
        {children}
      </button>
    );
  }
  return (
    <button onClick={onClick} className={cn(base, active ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")}>
      {children}
    </button>
  );
}
