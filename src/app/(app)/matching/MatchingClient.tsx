"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users, Briefcase, MapPin, GraduationCap, User, Paperclip,
  Search, X, RotateCcw, Zap, Link2Off, Mail, Trash2, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { batchCreateMatchings, deleteMatching } from "./actions";
import type { MatchingCandidateRow, MatchingNeedRow } from "./actions";
import { SendEmailModal } from "./SendEmailModal";

// ─── Status display ───────────────────────────────────────────────────────────

const CAND_STATUS_LABEL: Record<string, string> = {
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

const CAND_STATUS_BADGE: Record<string, string> = {
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

const NEED_STATUS_LABEL: Record<string, string> = {
  ad_chase:         "Ad Chase",
  prospect:         "Prospect",
  need_in_progress: "Besoin en cours",
  a_shooter:        "À shooter",
  cv_envoye:        "CV envoyé",
  interview:        "Entretien",
  waiting_fre:      "Attente FRE",
  client:           "Client",
  rupture:          "Rupture",
  lost:             "Perdu",
};

const NEED_STATUS_BADGE: Record<string, string> = {
  ad_chase:         "bg-slate-100 text-slate-700",
  prospect:         "bg-blue-100 text-blue-700",
  need_in_progress: "bg-violet-100 text-violet-700",
  a_shooter:        "bg-amber-100 text-amber-700",
  cv_envoye:        "bg-sky-100 text-sky-700",
  interview:        "bg-orange-100 text-orange-700",
  waiting_fre:      "bg-amber-100 text-amber-700",
  client:           "bg-emerald-100 text-emerald-700",
  rupture:          "bg-red-100 text-red-700",
  lost:             "bg-gray-100 text-gray-600",
};

// ─── Filters & sort ───────────────────────────────────────────────────────────

type CandFilters = {
  search: string; status: string; cursus: string;
  city: string; owner: string; cvOnly: boolean;
};
type NeedFilters = {
  search: string; status: string; cursus: string;
  city: string; owner: string; company: string;
};

const DEFAULT_CAND: CandFilters = {
  search: "", status: "", cursus: "", city: "", owner: "", cvOnly: false,
};
const DEFAULT_NEED: NeedFilters = {
  search: "", status: "", cursus: "", city: "", owner: "", company: "",
};

function isCandDirty(f: CandFilters) {
  return f.search !== "" || f.status !== "" || f.cursus !== "" ||
    f.city !== "" || f.owner !== "" || f.cvOnly;
}
function isNeedDirty(f: NeedFilters) {
  return f.search !== "" || f.status !== "" || f.cursus !== "" ||
    f.city !== "" || f.owner !== "" || f.company !== "";
}

const CAND_SORTS = [
  { value: "name_asc",     label: "Nom A→Z" },
  { value: "name_desc",    label: "Nom Z→A" },
  { value: "updated_desc", label: "Récent" },
  { value: "updated_asc",  label: "Ancien" },
];
const NEED_SORTS = [
  { value: "title_asc",      label: "Titre A→Z" },
  { value: "title_desc",     label: "Titre Z→A" },
  { value: "updated_desc",   label: "Récent" },
  { value: "updated_asc",    label: "Ancien" },
  { value: "matchings_desc", label: "Candidats ↓" },
];

function applyAndSortCandidates(
  data: MatchingCandidateRow[], f: CandFilters, sort: string
): MatchingCandidateRow[] {
  let r = data;
  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    r = r.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase().includes(q));
  }
  if (f.status)  r = r.filter((c) => c.status === f.status);
  if (f.cursus)  r = r.filter((c) => c.cursusEnvisage === f.cursus);
  if (f.city)    r = r.filter((c) => c.city === f.city);
  if (f.owner)   r = r.filter((c) => c.ownerId === f.owner);
  if (f.cvOnly)  r = r.filter((c) => c.hasCV);
  return [...r].sort((a, b) => {
    const na = `${a.firstName} ${a.lastName}`, nb = `${b.firstName} ${b.lastName}`;
    switch (sort) {
      case "name_desc":    return nb.localeCompare(na);
      case "updated_desc": return b.updatedAt.localeCompare(a.updatedAt);
      case "updated_asc":  return a.updatedAt.localeCompare(b.updatedAt);
      default:             return na.localeCompare(nb);
    }
  });
}

function applyAndSortNeeds(
  data: MatchingNeedRow[], f: NeedFilters, sort: string
): MatchingNeedRow[] {
  let r = data;
  if (f.search.trim()) {
    const q = f.search.trim().toLowerCase();
    r = r.filter((n) =>
      n.title.toLowerCase().includes(q) || n.companyName.toLowerCase().includes(q)
    );
  }
  if (f.status)  r = r.filter((n) => n.status === f.status);
  if (f.cursus)  r = r.filter((n) => n.targetCursusId === f.cursus);
  if (f.city)    r = r.filter((n) => n.city === f.city);
  if (f.owner)   r = r.filter((n) => n.ownerId === f.owner);
  if (f.company) r = r.filter((n) => n.companyId === f.company);
  return [...r].sort((a, b) => {
    switch (sort) {
      case "title_desc":      return b.title.localeCompare(a.title);
      case "updated_desc":    return b.updatedAt.localeCompare(a.updatedAt);
      case "updated_asc":     return a.updatedAt.localeCompare(b.updatedAt);
      case "matchings_desc":  return b.activeMatchingsCount - a.activeMatchingsCount;
      default:                return a.title.localeCompare(b.title);
    }
  });
}

// ─── Shared select style ──────────────────────────────────────────────────────

const sel =
  "h-7 text-xs rounded-md border border-input bg-background px-2 " +
  "focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer";

// ─── Candidate card ───────────────────────────────────────────────────────────

function CandidateCard({
  candidate, checked, onChange, alreadyMatched,
}: {
  candidate: MatchingCandidateRow;
  checked: boolean;
  onChange: (checked: boolean) => void;
  alreadyMatched: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-2.5 bg-card border rounded-lg p-3 cursor-pointer",
        "hover:shadow-sm transition-shadow select-none",
        checked && "ring-1 ring-primary/30 border-primary/40 bg-primary/5",
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium leading-tight">
            {candidate.firstName} {candidate.lastName}
          </span>
          <span
            className={cn(
              "text-[11px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap shrink-0",
              CAND_STATUS_BADGE[candidate.status] ?? "bg-muted text-muted-foreground"
            )}
          >
            {CAND_STATUS_LABEL[candidate.status] ?? candidate.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {candidate.cursusEnvisage && (
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3 w-3 shrink-0" />
              {candidate.cursusEnvisage}
            </span>
          )}
          {candidate.city && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {candidate.city}
            </span>
          )}
          {candidate.ownerName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3 shrink-0" />
              {candidate.ownerName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {candidate.hasCV && (
            <span className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">
              <Paperclip className="h-3 w-3" />
              CV
            </span>
          )}
          {alreadyMatched && (
            <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
              <Link2Off className="h-3 w-3" />
              Déjà rattaché
            </span>
          )}
          {candidate.activeMatchingNeedIds.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {candidate.activeMatchingNeedIds.length} besoin{candidate.activeMatchingNeedIds.length > 1 ? "s" : ""} en cours
            </span>
          )}
        </div>
      </div>
    </label>
  );
}

// ─── Need card ────────────────────────────────────────────────────────────────

function NeedCard({
  need, checked, onChange, alreadyMatched, deletedMatchingIds, onDeleteMatching,
}: {
  need: MatchingNeedRow;
  checked: boolean;
  onChange: (checked: boolean) => void;
  alreadyMatched: boolean;
  deletedMatchingIds: Set<string>;
  onDeleteMatching: (matchingId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleMatchings = need.activeMatchings.filter((m) => !deletedMatchingIds.has(m.matchingId));

  return (
    <label
      className={cn(
        "flex items-start gap-2.5 bg-card border rounded-lg p-3 cursor-pointer",
        "hover:shadow-sm transition-shadow select-none",
        checked && "ring-1 ring-primary/30 border-primary/40 bg-primary/5",
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight truncate">{need.title}</p>
            <p className="text-xs text-muted-foreground truncate">{need.companyName}</p>
          </div>
          <span
            className={cn(
              "text-[11px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap shrink-0",
              NEED_STATUS_BADGE[need.status] ?? "bg-muted text-muted-foreground"
            )}
          >
            {NEED_STATUS_LABEL[need.status] ?? need.status}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {need.targetCursusName && (
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3 w-3 shrink-0" />
              {need.targetCursusName}
            </span>
          )}
          {need.city && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              {need.city}
            </span>
          )}
          {need.ownerName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3 shrink-0" />
              {need.ownerName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {alreadyMatched && (
            <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
              <Link2Off className="h-3 w-3" />
              Déjà rattaché
            </span>
          )}
          {visibleMatchings.length > 0 && (
            <button
              onClick={(e) => { e.preventDefault(); setExpanded((v) => !v); }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Users className="h-3 w-3" />
              {visibleMatchings.length} candidat{visibleMatchings.length > 1 ? "s" : ""} en cours
              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
        </div>

        {expanded && visibleMatchings.length > 0 && (
          <div className="mt-1 rounded-md border divide-y bg-muted/20">
            {visibleMatchings.map((m) => (
              <div key={m.matchingId} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                <span className="flex-1 truncate font-medium">
                  {m.candidateFirstName} {m.candidateLastName}
                </span>
                {m.hasCV && (
                  <Paperclip className="h-3 w-3 text-emerald-600 shrink-0" />
                )}
                <button
                  onClick={(e) => { e.preventDefault(); onDeleteMatching(m.matchingId); }}
                  className="text-muted-foreground hover:text-red-600 transition-colors shrink-0 p-0.5"
                  title="Supprimer ce matching"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </label>
  );
}

// ─── Filter bar — Candidates ──────────────────────────────────────────────────

function CandFilterBar({
  candidates, filters, sort,
  onFilters, onSort,
}: {
  candidates: MatchingCandidateRow[];
  filters: CandFilters;
  sort: string;
  onFilters: (f: CandFilters) => void;
  onSort: (s: string) => void;
}) {
  const uniqueStatuses = useMemo(
    () => [...new Set(candidates.map((c) => c.status))].sort(),
    [candidates]
  );
  const uniqueCursus = useMemo(
    () => [...new Set(candidates.map((c) => c.cursusEnvisage).filter(Boolean) as string[])].sort(),
    [candidates]
  );
  const uniqueCities = useMemo(
    () => [...new Set(candidates.map((c) => c.city).filter(Boolean) as string[])].sort(),
    [candidates]
  );
  const uniqueOwners = useMemo(
    () => [...new Map(candidates.filter((c) => c.ownerId).map((c) => [c.ownerId, c.ownerName])).entries()]
      .sort((a, b) => (a[1] ?? "").localeCompare(b[1] ?? "")),
    [candidates]
  );

  const dirty = isCandDirty(filters);

  return (
    <div className="px-3 py-2 border-b bg-muted/10 flex flex-wrap gap-1.5 shrink-0">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher…"
          value={filters.search}
          onChange={(e) => onFilters({ ...filters, search: e.target.value })}
          className={cn(sel, "pl-6 w-36")}
        />
      </div>

      {/* Status */}
      <select className={sel} value={filters.status} onChange={(e) => onFilters({ ...filters, status: e.target.value })}>
        <option value="">Statut</option>
        {uniqueStatuses.map((s) => (
          <option key={s} value={s}>{CAND_STATUS_LABEL[s] ?? s}</option>
        ))}
      </select>

      {/* Cursus */}
      {uniqueCursus.length > 0 && (
        <select className={sel} value={filters.cursus} onChange={(e) => onFilters({ ...filters, cursus: e.target.value })}>
          <option value="">Cursus</option>
          {uniqueCursus.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {/* Ville */}
      {uniqueCities.length > 0 && (
        <select className={sel} value={filters.city} onChange={(e) => onFilters({ ...filters, city: e.target.value })}>
          <option value="">Ville</option>
          {uniqueCities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {/* Recruteur */}
      {uniqueOwners.length > 0 && (
        <select className={sel} value={filters.owner} onChange={(e) => onFilters({ ...filters, owner: e.target.value })}>
          <option value="">Recruteur</option>
          {uniqueOwners.map(([id, name]) => <option key={id!} value={id!}>{name}</option>)}
        </select>
      )}

      {/* CV toggle */}
      <button
        onClick={() => onFilters({ ...filters, cvOnly: !filters.cvOnly })}
        className={cn(
          "flex items-center gap-1 h-7 px-2 text-xs rounded-md border transition-colors",
          filters.cvOnly
            ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-medium"
            : "border-input bg-background text-muted-foreground hover:text-foreground"
        )}
      >
        <Paperclip className="h-3 w-3" />
        CV
      </button>

      {/* Sort */}
      <select className={sel} value={sort} onChange={(e) => onSort(e.target.value)}>
        {CAND_SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Reset */}
      {dirty && (
        <button
          onClick={() => onFilters(DEFAULT_CAND)}
          className="flex items-center gap-1 h-7 px-2 text-xs rounded-md border border-input bg-background text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Réinitialiser
        </button>
      )}
    </div>
  );
}

// ─── Filter bar — Needs ───────────────────────────────────────────────────────

function NeedFilterBar({
  needs, filters, sort,
  onFilters, onSort,
}: {
  needs: MatchingNeedRow[];
  filters: NeedFilters;
  sort: string;
  onFilters: (f: NeedFilters) => void;
  onSort: (s: string) => void;
}) {
  const uniqueStatuses = useMemo(
    () => [...new Set(needs.map((n) => n.status))].sort(),
    [needs]
  );
  const uniqueCursus = useMemo(
    () => [...new Map(needs.filter((n) => n.targetCursusId).map((n) => [n.targetCursusId, n.targetCursusName])).entries()]
      .sort((a, b) => (a[1] ?? "").localeCompare(b[1] ?? "")),
    [needs]
  );
  const uniqueCities = useMemo(
    () => [...new Set(needs.map((n) => n.city).filter(Boolean) as string[])].sort(),
    [needs]
  );
  const uniqueOwners = useMemo(
    () => [...new Map(needs.filter((n) => n.ownerId).map((n) => [n.ownerId, n.ownerName])).entries()]
      .sort((a, b) => (a[1] ?? "").localeCompare(b[1] ?? "")),
    [needs]
  );
  const uniqueCompanies = useMemo(
    () => [...new Map(needs.map((n) => [n.companyId, n.companyName])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1])),
    [needs]
  );

  const dirty = isNeedDirty(filters);

  return (
    <div className="px-3 py-2 border-b bg-muted/10 flex flex-wrap gap-1.5 shrink-0">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <input
          type="text"
          placeholder="Rechercher…"
          value={filters.search}
          onChange={(e) => onFilters({ ...filters, search: e.target.value })}
          className={cn(sel, "pl-6 w-36")}
        />
      </div>

      {/* Status */}
      <select className={sel} value={filters.status} onChange={(e) => onFilters({ ...filters, status: e.target.value })}>
        <option value="">Statut</option>
        {uniqueStatuses.map((s) => (
          <option key={s} value={s}>{NEED_STATUS_LABEL[s] ?? s}</option>
        ))}
      </select>

      {/* Entreprise */}
      {uniqueCompanies.length > 1 && (
        <select className={sel} value={filters.company} onChange={(e) => onFilters({ ...filters, company: e.target.value })}>
          <option value="">Entreprise</option>
          {uniqueCompanies.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      )}

      {/* Cursus */}
      {uniqueCursus.length > 0 && (
        <select className={sel} value={filters.cursus} onChange={(e) => onFilters({ ...filters, cursus: e.target.value })}>
          <option value="">Cursus</option>
          {uniqueCursus.map(([id, name]) => <option key={id!} value={id!}>{name}</option>)}
        </select>
      )}

      {/* Ville */}
      {uniqueCities.length > 0 && (
        <select className={sel} value={filters.city} onChange={(e) => onFilters({ ...filters, city: e.target.value })}>
          <option value="">Ville</option>
          {uniqueCities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {/* Recruteur */}
      {uniqueOwners.length > 0 && (
        <select className={sel} value={filters.owner} onChange={(e) => onFilters({ ...filters, owner: e.target.value })}>
          <option value="">Recruteur</option>
          {uniqueOwners.map(([id, name]) => <option key={id!} value={id!}>{name}</option>)}
        </select>
      )}

      {/* Sort */}
      <select className={sel} value={sort} onChange={(e) => onSort(e.target.value)}>
        {NEED_SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Reset */}
      {dirty && (
        <button
          onClick={() => onFilters(DEFAULT_NEED)}
          className="flex items-center gap-1 h-7 px-2 text-xs rounded-md border border-input bg-background text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Réinitialiser
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MatchingClient({
  candidates,
  needs,
}: {
  candidates: MatchingCandidateRow[];
  needs: MatchingNeedRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  // Filters & sort
  const [candFilters, setCandFilters] = useState<CandFilters>(DEFAULT_CAND);
  const [needFilters, setNeedFilters] = useState<NeedFilters>(DEFAULT_NEED);
  const [candSort, setCandSort] = useState("name_asc");
  const [needSort, setNeedSort] = useState("title_asc");

  // Selection (persists through filter changes — keyed on IDs, not visible cards)
  const [selectedCandIds, setSelectedCandIds] = useState<Set<string>>(new Set());
  const [selectedNeedIds, setSelectedNeedIds] = useState<Set<string>>(new Set());

  // Optimistic matching deletions (cleared on router.refresh)
  const [deletedMatchingIds, setDeletedMatchingIds] = useState<Set<string>>(new Set());

  useEffect(() => { setMounted(true); }, []);

  // Filtered & sorted data
  const filteredCands = useMemo(
    () => applyAndSortCandidates(candidates, candFilters, candSort),
    [candidates, candFilters, candSort]
  );
  const filteredNeeds = useMemo(
    () => applyAndSortNeeds(needs, needFilters, needSort),
    [needs, needFilters, needSort]
  );

  // Already-matched detection
  const alreadyMatchedCandIds = useMemo(() => {
    if (selectedNeedIds.size === 0) return new Set<string>();
    const result = new Set<string>();
    for (const cand of candidates) {
      if (!selectedCandIds.has(cand.id)) continue;
      const hasLink = cand.activeMatchingNeedIds.some((nid) => selectedNeedIds.has(nid));
      if (hasLink) result.add(cand.id);
    }
    return result;
  }, [candidates, selectedCandIds, selectedNeedIds]);

  const alreadyMatchedNeedIds = useMemo(() => {
    if (selectedCandIds.size === 0) return new Set<string>();
    const result = new Set<string>();
    for (const need of needs) {
      if (!selectedNeedIds.has(need.id)) continue;
      const hasLink = need.activeMatchings.some((m) => selectedCandIds.has(m.candidateId));
      if (hasLink) result.add(need.id);
    }
    return result;
  }, [needs, selectedCandIds, selectedNeedIds]);

  // Select / deselect helpers
  function toggleCand(id: string, checked: boolean) {
    setSelectedCandIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }
  function toggleNeed(id: string, checked: boolean) {
    setSelectedNeedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }
  function selectAllVisibleCands() {
    setSelectedCandIds((prev) => {
      const next = new Set(prev);
      filteredCands.forEach((c) => next.add(c.id));
      return next;
    });
  }
  function deselectAllCands() {
    setSelectedCandIds(new Set());
  }
  function selectAllVisibleNeeds() {
    setSelectedNeedIds((prev) => {
      const next = new Set(prev);
      filteredNeeds.forEach((n) => next.add(n.id));
      return next;
    });
  }
  function deselectAllNeeds() {
    setSelectedNeedIds(new Set());
  }

  // Delete matching (optimistic)
  function handleDeleteMatching(matchingId: string) {
    setDeletedMatchingIds((prev) => {
      const next = new Set(prev);
      next.add(matchingId);
      return next;
    });
    startTransition(async () => {
      await deleteMatching(matchingId);
      router.refresh();
    });
  }

  // Banner visibility
  const showBanner = selectedNeedIds.size >= 1;
  const showCreateButton = selectedCandIds.size >= 1 && selectedNeedIds.size >= 1;

  const selectedCandidatesData = useMemo(
    () => candidates.filter((c) => selectedCandIds.has(c.id)),
    [candidates, selectedCandIds]
  );
  const selectedNeedsData = useMemo(
    () => needs.filter((n) => selectedNeedIds.has(n.id)),
    [needs, selectedNeedIds]
  );

  // When no candidates are selected, derive effective candidates from selected needs' active matchings
  const effectiveCandidatesForModal = useMemo(() => {
    if (selectedCandIds.size > 0) return selectedCandidatesData;
    const seen = new Set<string>();
    const result: MatchingCandidateRow[] = [];
    for (const need of selectedNeedsData) {
      for (const m of need.activeMatchings) {
        if (deletedMatchingIds.has(m.matchingId)) continue;
        if (seen.has(m.candidateId)) continue;
        seen.add(m.candidateId);
        const existing = candidates.find((c) => c.id === m.candidateId);
        if (existing) {
          result.push(existing);
        } else {
          result.push({
            id: m.candidateId,
            firstName: m.candidateFirstName,
            lastName: m.candidateLastName,
            email: null,
            status: m.propositionStatus,
            cursusEnvisage: null,
            city: null,
            ownerId: null,
            ownerName: null,
            updatedAt: new Date().toISOString(),
            hasCV: m.hasCV,
            activeMatchingNeedIds: [],
          });
        }
      }
    }
    return result;
  }, [candidates, selectedCandIds, selectedCandidatesData, selectedNeedsData, deletedMatchingIds]);

  // Batch create
  function handleBatchCreate() {
    const pairs: { candidateId: string; needId: string }[] = [];
    for (const cid of selectedCandIds) {
      for (const nid of selectedNeedIds) {
        pairs.push({ candidateId: cid, needId: nid });
      }
    }
    startTransition(async () => {
      const result = await batchCreateMatchings(pairs);
      if (result.created > 0) {
        toast.success(
          result.skipped > 0
            ? `${result.created} matching${result.created > 1 ? "s" : ""} créé${result.created > 1 ? "s" : ""} · ${result.skipped} déjà existant${result.skipped > 1 ? "s" : ""} ignoré${result.skipped > 1 ? "s" : ""}`
            : `${result.created} matching${result.created > 1 ? "s" : ""} créé${result.created > 1 ? "s" : ""}`
        );
      } else {
        toast.info("Tous les matchings sélectionnés existent déjà");
      }
      setSelectedCandIds(new Set());
      setSelectedNeedIds(new Set());
      router.refresh();
    });
  }

  // Floating banner content
  const bannerContent = showBanner && mounted ? createPortal(
    <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 lg:bottom-6">
      <div className="flex items-center gap-3 bg-foreground text-background rounded-xl shadow-xl px-5 py-3 text-sm font-medium">
        <span className="tabular-nums">
          {selectedCandIds.size > 0 && `${selectedCandIds.size} candidat${selectedCandIds.size > 1 ? "s" : ""} · `}
          {selectedNeedIds.size} besoin{selectedNeedIds.size > 1 ? "s" : ""}
        </span>
        <div className="h-4 w-px bg-background/20" />
        {showCreateButton && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs gap-1.5"
            disabled={isPending}
            onClick={handleBatchCreate}
          >
            <Zap className="h-3.5 w-3.5" />
            {isPending ? "Création…" : "Créer les matchings"}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs gap-1.5"
          disabled={effectiveCandidatesForModal.length === 0}
          onClick={() => setEmailModalOpen(true)}
        >
          <Mail className="h-3.5 w-3.5" />
          Envoyer les CV
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-background/70 hover:text-background hover:bg-background/10"
          onClick={() => {
            setSelectedCandIds(new Set());
            setSelectedNeedIds(new Set());
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden border-t md:flex-row">
        {/* ── Left column — Candidats ── */}
        <div className="flex min-h-[45dvh] min-w-0 flex-1 flex-col md:min-h-0">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30 shrink-0">
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            <h2 className="text-sm font-semibold">Candidats</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {filteredCands.length}{filteredCands.length !== candidates.length ? `/${candidates.length}` : ""}
            </span>
            <div className="ml-auto flex items-center gap-1">
              {selectedCandIds.size > 0 ? (
                <button onClick={deselectAllCands} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  Désélectionner tout
                </button>
              ) : (
                <button onClick={selectAllVisibleCands} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  Tout sélectionner
                </button>
              )}
            </div>
          </div>

          {/* Filter bar */}
          <CandFilterBar
            candidates={candidates}
            filters={candFilters}
            sort={candSort}
            onFilters={setCandFilters}
            onSort={setCandSort}
          />

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {filteredCands.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun candidat</p>
            ) : (
              filteredCands.map((c) => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  checked={selectedCandIds.has(c.id)}
                  onChange={(v) => toggleCand(c.id, v)}
                  alreadyMatched={alreadyMatchedCandIds.has(c.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-border shrink-0" />

        {/* ── Right column — Besoins ── */}
        <div className="flex min-h-[45dvh] min-w-0 flex-1 flex-col border-t md:min-h-0 md:border-t-0 md:border-l">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30 shrink-0">
            <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
            <h2 className="text-sm font-semibold">Besoins</h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {filteredNeeds.length}{filteredNeeds.length !== needs.length ? `/${needs.length}` : ""}
            </span>
            <div className="ml-auto flex items-center gap-1">
              {selectedNeedIds.size > 0 ? (
                <button onClick={deselectAllNeeds} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  Désélectionner tout
                </button>
              ) : (
                <button onClick={selectAllVisibleNeeds} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  Tout sélectionner
                </button>
              )}
            </div>
          </div>

          {/* Filter bar */}
          <NeedFilterBar
            needs={needs}
            filters={needFilters}
            sort={needSort}
            onFilters={setNeedFilters}
            onSort={setNeedSort}
          />

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {filteredNeeds.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun besoin</p>
            ) : (
              filteredNeeds.map((n) => (
                <NeedCard
                  key={n.id}
                  need={n}
                  checked={selectedNeedIds.has(n.id)}
                  onChange={(v) => toggleNeed(n.id, v)}
                  alreadyMatched={alreadyMatchedNeedIds.has(n.id)}
                  deletedMatchingIds={deletedMatchingIds}
                  onDeleteMatching={handleDeleteMatching}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {bannerContent}

      <SendEmailModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        selectedCandidates={effectiveCandidatesForModal}
        selectedNeeds={selectedNeedsData}
      />
    </>
  );
}
