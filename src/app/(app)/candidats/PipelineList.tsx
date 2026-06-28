"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import type { CandidatRow } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  to_call:           "À appeler",
  in_progress:       "En cours",
  no_response:       "NRP",
  interview:         "Entretien",
  pvpp:              "PVPP",
  admissible:        "Admissible",
  company_interview: "Entretien entreprise",
  placed:            "Placé",
  waiting_fre:       "Attente FRE",
  contract_break:    "Rupture",
  temporary_refusal: "Refus temporaire",
  definitive_refusal:"Refus définitif",
};

const STATUS_BADGE: Record<string, string> = {
  to_call:           "bg-blue-100 text-blue-700",
  in_progress:       "bg-indigo-100 text-indigo-700",
  no_response:       "bg-amber-100 text-amber-700",
  interview:         "bg-violet-100 text-violet-700",
  pvpp:              "bg-orange-100 text-orange-700",
  admissible:        "bg-sky-100 text-sky-700",
  company_interview: "bg-purple-100 text-purple-700",
  placed:            "bg-emerald-100 text-emerald-700",
  waiting_fre:       "bg-teal-100 text-teal-700",
  contract_break:    "bg-red-100 text-red-700",
  temporary_refusal: "bg-gray-100 text-gray-600",
  definitive_refusal:"bg-red-100 text-red-700",
};

const ACTIVE_STATUSES = [
  { key: "to_call",           label: "À appeler" },
  { key: "in_progress",       label: "En cours" },
  { key: "no_response",       label: "NRP" },
  { key: "interview",         label: "Entretien" },
  { key: "pvpp",              label: "PVPP" },
  { key: "admissible",        label: "Admissible" },
  { key: "company_interview", label: "Entretien entreprise" },
  { key: "placed",            label: "Placé" },
  { key: "waiting_fre",       label: "Attente FRE" },
  { key: "contract_break",    label: "Rupture" },
];

type SortKey = "name" | "status" | "cursus" | "owner" | "nextTask";
type SortDir = "asc" | "desc";

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function PipelineList({
  candidates,
  onStatusChange,
  archived = false,
}: {
  candidates: CandidatRow[];
  onStatusChange: (id: string, status: string) => void;
  archived?: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "name", dir: "asc" });

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }

  const sorted = [...candidates].sort((a, b) => {
    let va = "";
    let vb = "";
    switch (sort.key) {
      case "name":     va = `${a.firstName} ${a.lastName}`; vb = `${b.firstName} ${b.lastName}`; break;
      case "status":   va = STATUS_LABELS[a.status] ?? ""; vb = STATUS_LABELS[b.status] ?? ""; break;
      case "cursus":   va = a.cursusEnvisage ?? ""; vb = b.cursusEnvisage ?? ""; break;
      case "owner":    va = a.ownerName ?? ""; vb = b.ownerName ?? ""; break;
      case "nextTask": va = a.nextTaskAt ?? "9999"; vb = b.nextTaskAt ?? "9999"; break;
    }
    return sort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  function SortHeader({ col, label }: { col: SortKey; label: string }) {
    const active = sort.key === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className={cn(
          "flex items-center gap-1 text-xs font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {label}
        {active && (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">Aucun candidat</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4">
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="px-4 py-2.5 text-left"><SortHeader col="name" label="Candidat" /></th>
              <th className="px-4 py-2.5 text-left"><SortHeader col="status" label="Étape" /></th>
              <th className="px-4 py-2.5 text-left"><SortHeader col="cursus" label="Cursus" /></th>
              <th className="px-4 py-2.5 text-left"><SortHeader col="owner" label="Recruteur" /></th>
              <th className="px-4 py-2.5 text-left"><SortHeader col="nextTask" label="Prochaine tâche" /></th>
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((c) => {
              const nextDate = formatDate(c.nextTaskAt);
              const nextOverdue = c.nextTaskAt && new Date(c.nextTaskAt) < new Date();
              return (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/candidats/${c.id}`} className="font-medium hover:text-primary transition-colors">
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_BADGE[c.status] ?? "bg-muted text-muted-foreground"
                    )}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.cursusEnvisage ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.ownerName ?? "—"}</td>
                  <td className={cn("px-4 py-3 text-sm", nextOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                    {nextDate ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="bottom" align="end">
                        {archived ? (
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Remettre dans pipeline</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onStatusChange(c.id, "to_call")}>
                              À appeler
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onStatusChange(c.id, "in_progress")}>
                              En cours
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        ) : (
                          <>
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>Changer d'étape</DropdownMenuLabel>
                              {ACTIVE_STATUSES.filter((s) => s.key !== c.status).map((s) => (
                                <DropdownMenuItem key={s.key} onClick={() => onStatusChange(c.id, s.key)}>
                                  {s.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>Archiver</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => onStatusChange(c.id, "temporary_refusal")}>
                                Refus temporaire
                              </DropdownMenuItem>
                              <DropdownMenuItem variant="destructive" onClick={() => onStatusChange(c.id, "definitive_refusal")}>
                                Refus définitif
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
