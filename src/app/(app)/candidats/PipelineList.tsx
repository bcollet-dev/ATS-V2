"use client";

import { useState, useMemo, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  ChevronUp, ChevronDown, MoreHorizontal,
  SlidersHorizontal, Check, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  updateCandidatCursus, updateCandidatOwner, type CandidatRow,
} from "./actions";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  to_call:           "À appeler",
  in_progress:       "En cours",
  no_response:       "NRP",
  interview:         "Entretien",
  pvpp:              "PVPP",
  admissible:        "Admissible",
  company_interview: "Entretien entreprise",
  waiting_fre:       "Attente FRE",
  placed:            "Placé",
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
  waiting_fre:       "bg-teal-100 text-teal-700",
  placed:            "bg-emerald-100 text-emerald-700",
  contract_break:    "bg-red-100 text-red-700",
  temporary_refusal: "bg-gray-100 text-gray-600",
  definitive_refusal:"bg-red-100 text-red-700",
};

const STATUS_DOT: Record<string, string> = {
  to_call:           "bg-blue-400",
  in_progress:       "bg-indigo-400",
  no_response:       "bg-amber-400",
  interview:         "bg-violet-400",
  pvpp:              "bg-orange-400",
  admissible:        "bg-sky-400",
  company_interview: "bg-purple-400",
  waiting_fre:       "bg-teal-400",
  placed:            "bg-emerald-400",
  contract_break:    "bg-red-400",
  temporary_refusal: "bg-gray-400",
  definitive_refusal:"bg-red-400",
};

const PIPELINE_STATUSES = [
  { key: "to_call",           label: "À appeler" },
  { key: "in_progress",       label: "En cours" },
  { key: "no_response",       label: "NRP" },
  { key: "interview",         label: "Entretien" },
  { key: "pvpp",              label: "PVPP" },
  { key: "admissible",        label: "Admissible" },
  { key: "company_interview", label: "Entretien entreprise" },
  { key: "waiting_fre",       label: "Attente FRE" },
  { key: "placed",            label: "Placé" },
  { key: "contract_break",    label: "Rupture" },
];

type SortKey = "name" | "status" | "cursus" | "owner" | "nextTask";
type FilterKey = "status" | "cursus" | "owner";
type SortDir = "asc" | "desc";

function getColValue(c: CandidatRow, col: SortKey | FilterKey): string {
  switch (col) {
    case "name":    return `${c.firstName} ${c.lastName}`;
    case "status":  return STATUS_LABELS[c.status] ?? c.status;
    case "cursus":  return c.cursusEnvisage ?? "";
    case "owner":   return c.ownerName ?? "";
    case "nextTask":return c.nextTaskAt ?? "9999";
  }
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ─── Inline Status Picker ────────────────────────────────────────────────────

function StatusCell({
  candidate,
  onStatusChange,
}: {
  candidate: CandidatRow;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity cursor-pointer",
          STATUS_BADGE[candidate.status] ?? "bg-muted text-muted-foreground"
        )}
      >
        {STATUS_LABELS[candidate.status] ?? candidate.status}
      </button>
      {open && (
        <div
          ref={ref}
          className="absolute top-full left-0 z-50 mt-1 w-48 rounded-lg border bg-popover shadow-lg overflow-hidden"
        >
          {PIPELINE_STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => { setOpen(false); onStatusChange(candidate.id, s.key); }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors",
                candidate.status === s.key && "font-semibold"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT[s.key])} />
              {s.label}
              {candidate.status === s.key && <Check className="h-3 w-3 ml-auto" />}
            </button>
          ))}
          <div className="border-t">
            <button
              onClick={() => { setOpen(false); onStatusChange(candidate.id, "temporary_refusal"); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-muted-foreground"
            >
              <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT.temporary_refusal)} />
              Refus temporaire
            </button>
            <button
              onClick={() => { setOpen(false); onStatusChange(candidate.id, "definitive_refusal"); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-destructive"
            >
              <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT.definitive_refusal)} />
              Refus définitif
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline Cursus Cell ──────────────────────────────────────────────────────

function CursusCell({
  candidate,
  cursus,
}: {
  candidate: CandidatRow;
  cursus: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  function handleChange(value: string) {
    setEditing(false);
    startTransition(async () => {
      await updateCandidatCursus(candidate.id, value);
    });
  }

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={candidate.cursusEnvisage ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">— Non renseigné</option>
        {cursus.map((c) => (
          <option key={c.id} value={c.name}>{c.name}</option>
        ))}
      </select>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-left text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors w-full"
    >
      {candidate.cursusEnvisage ?? <span className="italic text-muted-foreground/50">—</span>}
    </button>
  );
}

// ─── Inline Owner Cell ───────────────────────────────────────────────────────

function OwnerCell({
  candidate,
  profiles,
}: {
  candidate: CandidatRow;
  profiles: { id: string; fullName: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  function handleChange(value: string) {
    setEditing(false);
    startTransition(async () => {
      await updateCandidatOwner(candidate.id, value || null);
    });
  }

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={candidate.ownerId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">— Non assigné</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>{p.fullName}</option>
        ))}
      </select>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-left text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors w-full"
    >
      {candidate.ownerName ?? <span className="italic text-muted-foreground/50">—</span>}
    </button>
  );
}

// ─── Filter Popover ──────────────────────────────────────────────────────────

function FilterPopover({
  col, allValues, selected, onSelect, sort, onSort, onClose,
}: {
  col: FilterKey;
  allValues: string[];
  selected: Set<string> | null;
  onSelect: (v: Set<string> | null) => void;
  sort: { key: SortKey; dir: SortDir } | null;
  onSort: (key: SortKey, dir: SortDir) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const allSelected = selected === null;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const visibleValues = search.trim()
    ? allValues.filter((v) => v.toLowerCase().includes(search.toLowerCase()))
    : allValues;

  function toggle(value: string) {
    const base = selected ?? new Set(allValues);
    const next = new Set(base);
    if (next.has(value)) next.delete(value); else next.add(value);
    onSelect(next);
  }

  const activeSort = sort?.key === col ? sort.dir : null;

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 z-50 mt-1 w-52 rounded-lg border bg-popover shadow-lg overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="border-b">
        <button onClick={() => { onSort(col, "asc"); onClose(); }} className={cn("flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors", activeSort === "asc" && "text-primary font-medium")}>
          <ChevronUp className="h-3.5 w-3.5" />Trier A → Z
          {activeSort === "asc" && <Check className="h-3 w-3 ml-auto" />}
        </button>
        <button onClick={() => { onSort(col, "desc"); onClose(); }} className={cn("flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors", activeSort === "desc" && "text-primary font-medium")}>
          <ChevronDown className="h-3.5 w-3.5" />Trier Z → A
          {activeSort === "desc" && <Check className="h-3 w-3 ml-auto" />}
        </button>
      </div>
      <div className="px-2 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input type="text" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded border border-input bg-background pl-6 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring" autoFocus />
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {!search && (
          <button onClick={() => onSelect(null)} className={cn("flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors border-b", allSelected && "text-primary font-medium")}>
            <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded border shrink-0", allSelected ? "bg-primary border-primary" : "border-input")}>
              {allSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
            </span>
            (Tout sélectionner)
          </button>
        )}
        {visibleValues.length === 0 && <p className="px-3 py-3 text-xs text-muted-foreground text-center">Aucun résultat</p>}
        {visibleValues.map((val) => {
          const checked = allSelected || (selected?.has(val) ?? false);
          return (
            <button key={val} onClick={() => toggle(val)} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors">
              <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded border shrink-0", checked ? "bg-primary border-primary" : "border-input")}>
                {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
              </span>
              <span className="truncate">{val || "—"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Column Headers ──────────────────────────────────────────────────────────

function ColHeader({ col, label, allValues, filters, onFilters, sort, onSort }: {
  col: FilterKey; label: string; allValues: string[];
  filters: Map<FilterKey, Set<string> | null>;
  onFilters: (col: FilterKey, values: Set<string> | null) => void;
  sort: { key: SortKey; dir: SortDir } | null;
  onSort: (key: SortKey, dir: SortDir) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = filters.has(col) ? filters.get(col)! : null;
  const isFiltered = filters.has(col) && selected !== null;
  const isSorted = sort?.key === col;
  return (
    <th className="px-4 py-2.5 text-left">
      <div className="relative">
        <button onClick={() => setOpen((o) => !o)} className={cn("flex items-center gap-1 text-xs font-medium transition-colors group", isFiltered || isSorted ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
          {label}
          {isSorted && (sort?.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
          <SlidersHorizontal className={cn("h-3 w-3 transition-opacity", isFiltered ? "opacity-100" : "opacity-0 group-hover:opacity-60")} />
        </button>
        {open && <FilterPopover col={col} allValues={allValues} selected={selected} onSelect={(v) => onFilters(col, v)} sort={sort} onSort={onSort} onClose={() => setOpen(false)} />}
      </div>
    </th>
  );
}

function SortHeader({ col, label, sort, onSort }: {
  col: SortKey; label: string;
  sort: { key: SortKey; dir: SortDir } | null;
  onSort: (key: SortKey, dir: SortDir) => void;
}) {
  const active = sort?.key === col;
  return (
    <th className="px-4 py-2.5 text-left">
      <button onClick={() => onSort(col, active && sort?.dir === "asc" ? "desc" : "asc")} className={cn("flex items-center gap-1 text-xs font-medium transition-colors", active ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
        {label}
        {active && (sort?.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PipelineList({
  candidates,
  onStatusChange,
  archived = false,
  profiles,
  cursus,
}: {
  candidates: CandidatRow[];
  onStatusChange: (id: string, status: string) => void;
  archived?: boolean;
  profiles: { id: string; fullName: string }[];
  cursus: { id: string; name: string }[];
}) {
  const [filters, setFilters] = useState<Map<FilterKey, Set<string> | null>>(new Map());
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>({ key: "name", dir: "asc" });

  function handleFilters(col: FilterKey, values: Set<string> | null) {
    setFilters((prev) => {
      const next = new Map(prev);
      if (values === null) next.delete(col); else next.set(col, values);
      return next;
    });
  }

  const allValues = useMemo(() => {
    const map = new Map<FilterKey, string[]>();
    for (const col of ["status", "cursus", "owner"] as FilterKey[]) {
      const vals = [...new Set(candidates.map((c) => getColValue(c, col)).filter(Boolean))].sort();
      map.set(col, vals);
    }
    return map;
  }, [candidates]);

  const processed = useMemo(() => {
    let result = candidates;
    for (const [col, values] of filters.entries()) {
      if (values === null) continue;
      result = result.filter((c) => values.has(getColValue(c, col)));
    }
    if (sort) {
      result = [...result].sort((a, b) => {
        const va = getColValue(a, sort.key);
        const vb = getColValue(b, sort.key);
        return sort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return result;
  }, [candidates, filters, sort]);

  const activeFilterCount = [...filters.values()].filter((s) => s !== null).length;

  if (candidates.length === 0) {
    return <div className="px-6 py-16 text-center"><p className="text-sm text-muted-foreground">Aucun candidat</p></div>;
  }

  return (
    <div className="px-6 py-4 space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{processed.length} / {candidates.length} candidat{candidates.length !== 1 ? "s" : ""}</span>
          <button onClick={() => setFilters(new Map())} className="text-xs text-primary hover:underline">Effacer les filtres ({activeFilterCount})</button>
        </div>
      )}

      <div className="rounded-lg border overflow-visible">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <SortHeader col="name"     label="Candidat"        sort={sort} onSort={(k, d) => setSort({ key: k, dir: d })} />
              <ColHeader  col="status"   label="Étape"           allValues={allValues.get("status") ?? []}  filters={filters} onFilters={handleFilters} sort={sort} onSort={(k, d) => setSort({ key: k, dir: d })} />
              <ColHeader  col="cursus"   label="Cursus"          allValues={allValues.get("cursus") ?? []}  filters={filters} onFilters={handleFilters} sort={sort} onSort={(k, d) => setSort({ key: k, dir: d })} />
              <ColHeader  col="owner"    label="Recruteur"       allValues={allValues.get("owner") ?? []}   filters={filters} onFilters={handleFilters} sort={sort} onSort={(k, d) => setSort({ key: k, dir: d })} />
              <SortHeader col="nextTask" label="Prochaine tâche" sort={sort} onSort={(k, d) => setSort({ key: k, dir: d })} />
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {processed.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-xs text-muted-foreground">Aucun candidat correspondant aux filtres</td></tr>
            ) : processed.map((c) => {
              const nextDate = formatDate(c.nextTaskAt);
              return (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link href={`/candidats/${c.id}`} className="font-medium hover:text-primary transition-colors">
                      {c.firstName} {c.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusCell candidate={c} onStatusChange={onStatusChange} />
                  </td>
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <CursusCell candidate={c} cursus={cursus} />
                  </td>
                  <td className="px-4 py-2.5 max-w-[160px]">
                    <OwnerCell candidate={c} profiles={profiles} />
                  </td>
                  <td className={cn("px-4 py-2.5 text-sm", c.nextTaskOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                    {nextDate ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {!archived && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="bottom" align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Archiver</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onStatusChange(c.id, "temporary_refusal")}>Refus temporaire</DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => onStatusChange(c.id, "definitive_refusal")}>Refus définitif</DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {archived && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="bottom" align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Remettre dans pipeline</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onStatusChange(c.id, "to_call")}>À appeler</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onStatusChange(c.id, "in_progress")}>En cours</DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
