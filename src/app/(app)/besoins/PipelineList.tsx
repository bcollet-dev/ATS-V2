"use client";

import { useState, useMemo, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  updateNeedTitle, updateNeedCursus, updateNeedOwner, updateNeedCity, type NeedRow,
} from "./actions";
import { PermanentDeleteEntityButton } from "@/components/entities/PermanentDeleteEntityButton";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  ad_chase:         "Ad Chase",
  prospect:         "Prospect",
  need_in_progress: "Besoin en cours",
  interview:        "Entretien",
  waiting_fre:      "Attente FRE",
  client:           "Client",
  rupture:          "Rupture",
  lost:             "Perdu",
};

const STATUS_BADGE: Record<string, string> = {
  ad_chase:         "bg-slate-100 text-slate-700",
  prospect:         "bg-blue-100 text-blue-700",
  need_in_progress: "bg-violet-100 text-violet-700",
  interview:        "bg-orange-100 text-orange-700",
  waiting_fre:      "bg-amber-100 text-amber-700",
  client:           "bg-emerald-100 text-emerald-700",
  rupture:          "bg-red-100 text-red-700",
  lost:             "bg-gray-100 text-gray-600",
};

const STATUS_DOT: Record<string, string> = {
  ad_chase:         "bg-slate-400",
  prospect:         "bg-blue-400",
  need_in_progress: "bg-violet-400",
  interview:        "bg-orange-400",
  waiting_fre:      "bg-amber-400",
  client:           "bg-emerald-400",
  rupture:          "bg-red-400",
  lost:             "bg-gray-400",
};

const PROP_DOT: Record<string, string> = {
  cv_sent:     "bg-blue-400",
  interview:   "bg-orange-400",
  waiting_fre: "bg-amber-400",
  placed:      "bg-amber-400",
};
const PROP_CHIP: Record<string, string> = {
  cv_sent:     "bg-blue-50 text-blue-700",
  interview:   "bg-orange-50 text-orange-700",
  waiting_fre: "bg-amber-50 text-amber-700",
  placed:      "bg-amber-50 text-amber-700",
};
const PROP_SHORT: Record<string, string> = {
  cv_sent:     "CV",
  interview:   "Entretien",
  waiting_fre: "Retenu",
  placed:      "Retenu ★",
};

const PIPELINE_STATUSES = [
  { key: "ad_chase",         label: "Ad Chase" },
  { key: "prospect",         label: "Prospect" },
  { key: "need_in_progress", label: "Besoin en cours" },
  { key: "interview",        label: "Entretien" },
  { key: "waiting_fre",      label: "Attente FRE" },
  { key: "client",           label: "Client" },
  { key: "rupture",          label: "Rupture" },
];

type SortKey = "title" | "company" | "status" | "cursus" | "city" | "owner" | "nextTask";
type FilterKey = "status" | "cursus" | "city" | "owner";
type SortDir = "asc" | "desc";

function getColValue(n: NeedRow, col: SortKey | FilterKey): string {
  switch (col) {
    case "title":   return n.title;
    case "company": return n.companyName;
    case "status":  return STATUS_LABELS[n.status] ?? n.status;
    case "cursus":  return n.targetCursusName ?? "";
    case "city":    return n.city ?? "";
    case "owner":   return n.ownerName ?? "";
    case "nextTask":return n.nextTaskAt ?? "9999";
  }
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ─── Inline Status Picker ────────────────────────────────────────────────────

function StatusCell({
  need,
  onStatusChange,
}: {
  need: NeedRow;
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
          STATUS_BADGE[need.status] ?? "bg-muted text-muted-foreground"
        )}
      >
        {STATUS_LABELS[need.status] ?? need.status}
      </button>
      {open && (
        <div
          ref={ref}
          className="absolute top-full left-0 z-50 mt-1 w-48 rounded-lg border bg-popover shadow-lg overflow-hidden"
        >
          {PIPELINE_STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => { setOpen(false); onStatusChange(need.id, s.key); }}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors",
                need.status === s.key && "font-semibold"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT[s.key])} />
              {s.label}
              {need.status === s.key && <Check className="h-3 w-3 ml-auto" />}
            </button>
          ))}
          <div className="border-t">
            <button
              onClick={() => { setOpen(false); onStatusChange(need.id, "lost"); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors text-destructive"
            >
              <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT.lost)} />
              Perdu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline Text Cell ────────────────────────────────────────────────────────

function TextCell({
  value,
  placeholder,
  href,
  onSave,
}: {
  value: string | null;
  placeholder: string;
  href?: string;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  function commit() {
    setEditing(false);
    onSave(draft);
  }

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); } }}
        className="w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  if (href && value) {
    return (
      <div className="flex items-center gap-1 group">
        <Link href={href as never} className="text-sm font-medium hover:text-primary transition-colors truncate">{value}</Link>
        <button onClick={() => { setDraft(value); setEditing(true); }} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground transition-opacity shrink-0" title="Modifier">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a4 4 0 01-2.828 1.172H7v-2a4 4 0 011.172-2.828z" /></svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(value ?? ""); setEditing(true); }}
      className="text-left text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors w-full"
    >
      {value ?? <span className="italic text-muted-foreground/50">{placeholder}</span>}
    </button>
  );
}

// ─── Inline Cursus Cell ──────────────────────────────────────────────────────

function CursusCell({
  need,
  cursus,
}: {
  need: NeedRow;
  cursus: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  function handleChange(value: string) {
    setEditing(false);
    startTransition(async () => {
      await updateNeedCursus(need.id, value || null);
    });
  }

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={need.targetCursusId ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">— Non renseigné</option>
        {cursus.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="text-left text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors w-full"
    >
      {need.targetCursusName ?? <span className="italic text-muted-foreground/50">—</span>}
    </button>
  );
}

// ─── Inline Owner Cell ───────────────────────────────────────────────────────

function OwnerCell({
  need,
  profiles,
}: {
  need: NeedRow;
  profiles: { id: string; fullName: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  function handleChange(value: string) {
    setEditing(false);
    startTransition(async () => {
      await updateNeedOwner(need.id, value || null);
    });
  }

  if (editing) {
    return (
      <select
        autoFocus
        defaultValue={need.ownerId ?? ""}
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
      {need.ownerName ?? <span className="italic text-muted-foreground/50">—</span>}
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
  needs,
  onStatusChange,
  archived = false,
  cursus,
  profiles,
}: {
  needs: NeedRow[];
  onStatusChange: (id: string, status: string) => void;
  archived?: boolean;
  cursus: { id: string; name: string }[];
  profiles: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<Map<FilterKey, Set<string> | null>>(new Map());
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>({ key: "title", dir: "asc" });
  const [, startTransition] = useTransition();

  function handleFilters(col: FilterKey, values: Set<string> | null) {
    setFilters((prev) => {
      const next = new Map(prev);
      if (values === null) next.delete(col); else next.set(col, values);
      return next;
    });
  }

  const allValues = useMemo(() => {
    const map = new Map<FilterKey, string[]>();
    for (const col of ["status", "cursus", "city", "owner"] as FilterKey[]) {
      const vals = [...new Set(needs.map((n) => getColValue(n, col)).filter(Boolean))].sort();
      map.set(col, vals);
    }
    return map;
  }, [needs]);

  const processed = useMemo(() => {
    let result = needs;
    for (const [col, values] of filters.entries()) {
      if (values === null) continue;
      result = result.filter((n) => values.has(getColValue(n, col)));
    }
    if (sort) {
      result = [...result].sort((a, b) => {
        const va = getColValue(a, sort.key);
        const vb = getColValue(b, sort.key);
        return sort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return result;
  }, [needs, filters, sort]);

  const activeFilterCount = [...filters.values()].filter((s) => s !== null).length;

  if (needs.length === 0) {
    return <div className="px-6 py-16 text-center"><p className="text-sm text-muted-foreground">Aucun besoin</p></div>;
  }

  return (
    <div className="px-6 py-4 space-y-2">
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{processed.length} / {needs.length} besoin{needs.length !== 1 ? "s" : ""}</span>
          <button onClick={() => setFilters(new Map())} className="text-xs text-primary hover:underline">Effacer les filtres ({activeFilterCount})</button>
        </div>
      )}

      <div className="rounded-lg border overflow-visible">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <SortHeader col="title"   label="Besoin"    sort={sort} onSort={(k, d) => setSort({ key: k, dir: d })} />
              <SortHeader col="company" label="Entreprise" sort={sort} onSort={(k, d) => setSort({ key: k, dir: d })} />
              <ColHeader  col="status"  label="Étape"      allValues={allValues.get("status") ?? []}  filters={filters} onFilters={handleFilters} sort={sort} onSort={(k, d) => setSort({ key: k, dir: d })} />
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Candidats</th>
              <ColHeader  col="cursus"  label="Cursus"     allValues={allValues.get("cursus") ?? []}  filters={filters} onFilters={handleFilters} sort={sort} onSort={(k, d) => setSort({ key: k, dir: d })} />
              <ColHeader  col="city"    label="Ville"      allValues={allValues.get("city") ?? []}    filters={filters} onFilters={handleFilters} sort={sort} onSort={(k, d) => setSort({ key: k, dir: d })} />
              <ColHeader  col="owner"   label="Recruteur"  allValues={allValues.get("owner") ?? []}   filters={filters} onFilters={handleFilters} sort={sort} onSort={(k, d) => setSort({ key: k, dir: d })} />
              <SortHeader col="nextTask" label="Prochaine tâche" sort={sort} onSort={(k, d) => setSort({ key: k, dir: d })} />
              <th className="w-10 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {processed.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-muted-foreground">Aucun besoin correspondant aux filtres</td></tr>
) : processed.map((n) => {
              const nextDate = formatDate(n.nextTaskAt);
              return (
                <tr key={n.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 max-w-[200px]">
                    <TextCell
                      value={n.title}
                      placeholder="Titre"
                      href={`/besoins/${n.id}`}
                      onSave={(val) => startTransition(async () => { await updateNeedTitle(n.id, val); })}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-sm text-muted-foreground max-w-[160px] truncate">
                    {n.companyName}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusCell need={n} onStatusChange={onStatusChange} />
                  </td>
                  <td className="px-4 py-2.5 max-w-[220px]">
                    {n.needCandidates.length === 0 ? (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {n.needCandidates.slice(0, 4).map((c, i) => (
                          <span key={i} className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full", PROP_CHIP[c.propositionStatus] ?? "bg-muted text-muted-foreground")}>
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", PROP_DOT[c.propositionStatus] ?? "bg-gray-400")} />
                            {c.firstName} · {PROP_SHORT[c.propositionStatus] ?? c.propositionStatus}
                          </span>
                        ))}
                        {n.needCandidates.length > 4 && (
                          <span className="text-[10px] text-muted-foreground self-center">+{n.needCandidates.length - 4}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 max-w-[180px]">
                    <CursusCell need={n} cursus={cursus} />
                  </td>
                  <td className="px-4 py-2.5 max-w-[140px]">
                    <TextCell
                      value={n.city}
                      placeholder="Ville"
                      onSave={(val) => startTransition(async () => { await updateNeedCity(n.id, val || null); })}
                    />
                  </td>
                  <td className="px-4 py-2.5 max-w-[140px]">
                    <OwnerCell need={n} profiles={profiles} />
                  </td>
                  <td className={cn("px-4 py-2.5 text-sm", n.nextTaskOverdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                    {nextDate ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {!archived ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="bottom" align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Clore</DropdownMenuLabel>
                            <DropdownMenuItem variant="destructive" onClick={() => onStatusChange(n.id, "lost")}>Perdu</DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <div className="flex items-center gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="bottom" align="end">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>Remettre dans pipeline</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => onStatusChange(n.id, "ad_chase")}>Ad Chase</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onStatusChange(n.id, "prospect")}>Prospect</DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <PermanentDeleteEntityButton
                          entityType="need"
                          entityId={n.id}
                          label={`${n.title} - ${n.companyName}`}
                          iconOnly
                          onDeleted={() => router.refresh()}
                        />
                      </div>
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
