"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Phone, Mail, FileText, RefreshCw, Users, MoreHorizontal, ListTodo,
  ChevronUp, ChevronDown, SlidersHorizontal, Check, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskFull } from "./TaskSlideOver";

const CATEGORY_LABELS: Record<string, string> = {
  call: "Appel", email: "Email", document: "Document",
  follow_up: "Relance", interview: "Entretien", other: "Autre",
};

const CATEGORY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  call: Phone, email: Mail, document: FileText,
  follow_up: RefreshCw, interview: Users, other: MoreHorizontal,
};

const STATUS_META = {
  todo:    { label: "À faire",   className: "bg-blue-50 text-blue-700" },
  overdue: { label: "En retard", className: "bg-red-50 text-red-700" },
  done:    { label: "Terminé",   className: "bg-emerald-50 text-emerald-700" },
} as const;

type Status = keyof typeof STATUS_META;
type SortKey = "title" | "entity" | "assignee" | "dueAt" | "status";
type SortDir = "asc" | "desc";

function getStatus(t: TaskFull): Status {
  if (t.completedAt) return "done";
  if (new Date(t.dueAt) < new Date()) return "overdue";
  return "todo";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function getColValue(task: TaskFull, col: SortKey): string {
  switch (col) {
    case "title":    return task.title;
    case "entity":   return task.candidateFirstName ? `${task.candidateFirstName} ${task.candidateLastName}` : task.companyName ?? "";
    case "assignee": return task.assigneeName ?? "—";
    case "dueAt":    return task.completedAt ?? task.dueAt;
    case "status":   return STATUS_META[getStatus(task)].label;
  }
}

// ─── Excel Filter Popover ────────────────────────────────────────────────────

function FilterPopover({
  col,
  label,
  allValues,
  selected,
  onSelect,
  sort,
  onSort,
  onClose,
}: {
  col: SortKey;
  label: string;
  allValues: string[];
  selected: Set<string> | null;
  onSelect: (values: Set<string> | null) => void;
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
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onSelect(next);
  }

  function selectAll() { onSelect(null); }

  const activeSort = sort?.key === col ? sort.dir : null;

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 z-50 mt-1 w-52 rounded-lg border bg-popover shadow-lg overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Sort */}
      <div className="border-b">
        <button
          onClick={() => { onSort(col, "asc"); onClose(); }}
          className={cn("flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors", activeSort === "asc" && "text-primary font-medium")}
        >
          <ChevronUp className="h-3.5 w-3.5" />
          Trier A → Z
          {activeSort === "asc" && <Check className="h-3 w-3 ml-auto" />}
        </button>
        <button
          onClick={() => { onSort(col, "desc"); onClose(); }}
          className={cn("flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors", activeSort === "desc" && "text-primary font-medium")}
        >
          <ChevronDown className="h-3.5 w-3.5" />
          Trier Z → A
          {activeSort === "desc" && <Check className="h-3 w-3 ml-auto" />}
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-input bg-background pl-6 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
        </div>
      </div>

      {/* Filter values */}
      <div className="max-h-48 overflow-y-auto">
        {!search && (
          <button
            onClick={selectAll}
            className={cn("flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors border-b", allSelected && "text-primary font-medium")}
          >
            <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded border shrink-0", allSelected ? "bg-primary border-primary" : "border-input")}>
              {allSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
            </span>
            (Tout sélectionner)
          </button>
        )}
        {visibleValues.length === 0 && (
          <p className="px-3 py-3 text-xs text-muted-foreground text-center">Aucun résultat</p>
        )}
        {visibleValues.map((val) => {
          const checked = allSelected || (selected?.has(val) ?? false);
          return (
            <button
              key={val}
              onClick={() => toggle(val)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-accent transition-colors"
            >
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

// ─── Column Header ───────────────────────────────────────────────────────────

function ColHeader({
  col,
  label,
  allValues,
  filters,
  onFilters,
  sort,
  onSort,
}: {
  col: SortKey;
  label: string;
  allValues: string[];
  filters: Map<SortKey, Set<string> | null>;
  onFilters: (col: SortKey, values: Set<string> | null) => void;
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
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex items-center gap-1 text-xs font-medium transition-colors group",
            isFiltered || isSorted ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
          {isSorted && (sort?.dir === "asc"
            ? <ChevronUp className="h-3 w-3" />
            : <ChevronDown className="h-3 w-3" />
          )}
          <SlidersHorizontal className={cn("h-3 w-3 transition-opacity", isFiltered ? "opacity-100" : "opacity-0 group-hover:opacity-60")} />
        </button>

        {open && (
          <FilterPopover
            col={col}
            label={label}
            allValues={allValues}
            selected={selected}
            onSelect={(v) => onFilters(col, v)}
            sort={sort}
            onSort={onSort}
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    </th>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ListView({ tasks, onSelect }: { tasks: TaskFull[]; onSelect: (t: TaskFull) => void }) {
  const [filters, setFilters] = useState<Map<SortKey, Set<string> | null>>(new Map());
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>({ key: "dueAt", dir: "asc" });

  function handleFilters(col: SortKey, values: Set<string> | null) {
    setFilters((prev) => {
      const next = new Map(prev);
      if (values === null) next.delete(col);
      else next.set(col, values);
      return next;
    });
  }

  // Unique values per column (from ALL tasks, not filtered)
  const allValues = useMemo(() => {
    const cols: SortKey[] = ["title", "entity", "assignee", "status"];
    const map = new Map<SortKey, string[]>();
    for (const col of cols) {
      const vals = [...new Set(tasks.map((t) => getColValue(t, col)).filter(Boolean))].sort();
      map.set(col, vals);
    }
    return map;
  }, [tasks]);

  const processed = useMemo(() => {
    let result = tasks;

    // Apply column filters
    for (const [col, values] of filters.entries()) {
      if (values === null) continue;
      result = result.filter((t) => values.has(getColValue(t, col)));
    }

    // Sort
    if (sort) {
      result = [...result].sort((a, b) => {
        const va = getColValue(a, sort.key);
        const vb = getColValue(b, sort.key);
        return sort.dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }

    return result;
  }, [tasks, filters, sort]);

  const activeFilterCount = [...filters.values()].filter((s) => s !== null).length;

  const cols: { key: SortKey; label: string }[] = [
    { key: "title",    label: "Tâche" },
    { key: "entity",   label: "Rattachement" },
    { key: "assignee", label: "Assigné" },
    { key: "dueAt",    label: "Échéance" },
    { key: "status",   label: "Statut" },
  ];

  return (
    <div className="space-y-2">
      {/* Active filter indicator */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {processed.length} / {tasks.length} tâche{tasks.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setFilters(new Map())}
            className="text-xs text-primary hover:underline"
          >
            Effacer les filtres ({activeFilterCount})
          </button>
        </div>
      )}

      {processed.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-16 text-center">
          <ListTodo className="h-6 w-6 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground">Aucune tâche correspondante</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-visible">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                {cols.map(({ key, label }) => (
                  <ColHeader
                    key={key}
                    col={key}
                    label={label}
                    allValues={allValues.get(key) ?? []}
                    filters={filters}
                    onFilters={handleFilters}
                    sort={sort}
                    onSort={(k, d) => setSort({ key: k, dir: d })}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {processed.map((task) => {
                const Icon = CATEGORY_ICONS[task.category] ?? MoreHorizontal;
                const status = getStatus(task);
                const meta = STATUS_META[status];
                const entityName = task.candidateFirstName
                  ? `${task.candidateFirstName} ${task.candidateLastName}`
                  : task.companyName ?? "—";
                const dateToShow = task.completedAt ?? task.dueAt;

                return (
                  <tr
                    key={task.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => onSelect(task)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className={cn("font-medium", task.completedAt && "line-through text-muted-foreground")}>
                          {task.title}
                        </span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 pl-5 line-clamp-1">{task.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{entityName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{task.assigneeName ?? "—"}</td>
                    <td className={cn("px-4 py-3", status === "overdue" && "text-destructive font-medium")}>
                      {formatDate(dateToShow)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", meta.className)}>
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
