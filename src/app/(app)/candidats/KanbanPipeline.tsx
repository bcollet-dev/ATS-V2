"use client";

import { useState, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Clock, AlertCircle, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import type { CandidatRow } from "./actions";
import {
  updateMatchingStatus,
  deleteMatching,
  createMatching,
  loadAvailableNeedsForCandidate,
  type NeedOption,
} from "@/app/(app)/matching/actions";

const ACTIVE_STATUSES = [
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
] as const;

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

const PICKER_STATUSES = [
  { key: "cv_sent",      label: "CV envoyé",      dot: "bg-blue-400" },
  { key: "interview",    label: "Entretien prévu", dot: "bg-orange-400" },
  { key: "waiting_fre",  label: "Retenu",          dot: "bg-amber-400" },
  { key: "not_retained", label: "Non retenu",      dot: "bg-red-400" },
];

const STATUS_STYLES: Record<string, { border: string; badge: string; dot: string }> = {
  to_call:           { border: "border-t-blue-400",    badge: "bg-blue-100 text-blue-700",      dot: "bg-blue-400" },
  in_progress:       { border: "border-t-indigo-400",  badge: "bg-indigo-100 text-indigo-700",  dot: "bg-indigo-400" },
  no_response:       { border: "border-t-amber-400",   badge: "bg-amber-100 text-amber-700",    dot: "bg-amber-400" },
  interview:         { border: "border-t-violet-400",  badge: "bg-violet-100 text-violet-700",  dot: "bg-violet-400" },
  pvpp:              { border: "border-t-orange-400",  badge: "bg-orange-100 text-orange-700",  dot: "bg-orange-400" },
  admissible:        { border: "border-t-sky-400",     badge: "bg-sky-100 text-sky-700",        dot: "bg-sky-400" },
  company_interview: { border: "border-t-purple-400",  badge: "bg-purple-100 text-purple-700",  dot: "bg-purple-400" },
  placed:            { border: "border-t-emerald-400", badge: "bg-emerald-100 text-emerald-700",dot: "bg-emerald-400" },
  waiting_fre:       { border: "border-t-teal-400",    badge: "bg-teal-100 text-teal-700",      dot: "bg-teal-400" },
  contract_break:    { border: "border-t-red-400",     badge: "bg-red-100 text-red-700",        dot: "bg-red-400" },
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ─── Refusal Modal ───────────────────────────────────────────────────────────

function RefusalModal({ open, onConfirm, onCancel }: {
  open: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div className="bg-background rounded-lg shadow-xl p-5 w-80" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold mb-3">Motif de non-rétention</h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Pourquoi ce candidat n'est pas retenu ? (optionnel)"
          className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded-md border hover:bg-accent transition-colors">
            Annuler
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className="text-sm px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Need Modal ──────────────────────────────────────────────────────────

function AddNeedModal({ open, needs, onConfirm, onCancel }: {
  open: boolean;
  needs: NeedOption[];
  onConfirm: (needId: string) => void;
  onCancel: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => { if (open) { setSearch(""); setSelectedId(null); } }, [open]);
  if (!open) return null;

  const filtered = needs.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.companyName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-background rounded-lg shadow-xl p-5 w-96 max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold mb-3">Proposer sur un besoin</h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un besoin..."
          autoFocus
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {needs.length === 0 ? "Aucun besoin disponible." : "Aucun résultat."}
            </p>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => setSelectedId(n.id === selectedId ? null : n.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                  selectedId === n.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                <span className="font-medium">{n.title}</span>
                <span className={cn("text-xs ml-2", selectedId === n.id ? "opacity-80" : "text-muted-foreground")}>
                  {n.companyName}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
          <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded-md border hover:bg-accent transition-colors">
            Annuler
          </button>
          <button
            onClick={() => selectedId && onConfirm(selectedId)}
            disabled={!selectedId}
            className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Proposer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Candidate Card ─────────────────────────────────────────────────────────

function CandidatCard({
  candidate,
  onStatusChange,
  isDragging = false,
}: {
  candidate: CandidatRow;
  onStatusChange: (id: string, status: string) => void;
  isDragging?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);
  const [refusalPending, setRefusalPending] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [availableNeeds, setAvailableNeeds] = useState<NeedOption[]>([]);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  function handleChipStatusChange(matchingId: string, status: string) {
    setPickerOpen(null);
    if (status === "not_retained") { setRefusalPending(matchingId); return; }
    startTransition(async () => {
      await updateMatchingStatus(matchingId, status);
      router.refresh();
    });
  }

  function handleChipDelete(matchingId: string) {
    startTransition(async () => {
      await deleteMatching(matchingId);
      router.refresh();
    });
  }

  function handleRefusalConfirm(reason: string) {
    if (!refusalPending) return;
    const mid = refusalPending;
    setRefusalPending(null);
    startTransition(async () => {
      await updateMatchingStatus(mid, "not_retained", reason || undefined);
      router.refresh();
    });
  }

  async function handleAddOpen() {
    setLoadingAdd(true);
    const list = await loadAvailableNeedsForCandidate(candidate.id);
    setAvailableNeeds(list);
    setLoadingAdd(false);
    setAddOpen(true);
  }

  function handleAddConfirm(needId: string) {
    setAddOpen(false);
    startTransition(async () => {
      await createMatching(candidate.id, needId);
      router.refresh();
    });
  }

  const inactive = candidate.isInactive;
  const nextOverdue = candidate.nextTaskOverdue;
  const canAdd = !isDragging;

  return (
    <>
      {mounted && createPortal(
        <>
          <RefusalModal
            open={!!refusalPending}
            onConfirm={handleRefusalConfirm}
            onCancel={() => setRefusalPending(null)}
          />
          <AddNeedModal
            open={addOpen}
            needs={availableNeeds}
            onConfirm={handleAddConfirm}
            onCancel={() => setAddOpen(false)}
          />
        </>,
        document.body
      )}

      <div className={cn(
        "rounded-lg border bg-card p-3 transition-shadow select-none",
        isDragging ? "shadow-lg ring-2 ring-primary/20 opacity-90" : "shadow-sm hover:shadow-md",
        inactive && "border-amber-200"
      )}>
        {/* Header */}
        <div className="flex items-start gap-1.5 mb-2">
          <Link
            href={`/candidats/${candidate.id}`}
            className="flex-1 text-sm font-medium hover:text-primary transition-colors leading-tight"
            onClick={(e) => e.stopPropagation()}
          >
            {candidate.firstName} {candidate.lastName}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Changer d&apos;étape</DropdownMenuLabel>
                {ACTIVE_STATUSES.filter((s) => s.key !== candidate.status).map((s) => (
                  <DropdownMenuItem
                    key={s.key}
                    onClick={(e) => { e.stopPropagation(); onStatusChange(candidate.id, s.key); }}
                  >
                    <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_STYLES[s.key].dot)} />
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Archiver</DropdownMenuLabel>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange(candidate.id, "temporary_refusal"); }}>
                  Refus temporaire
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => { e.stopPropagation(); onStatusChange(candidate.id, "definitive_refusal"); }}
                >
                  Refus définitif
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {candidate.cursusEnvisage && (
          <p className="text-xs text-muted-foreground truncate mb-2">{candidate.cursusEnvisage}</p>
        )}

        {/* Besoins section */}
        {(candidate.needMatchings.length > 0 || canAdd) && (
          <div className="flex flex-col gap-0.5 mb-2 pt-1 border-t border-dashed">
            {candidate.needMatchings.length > 0 && (
              <div className={cn("flex flex-col gap-0.5", canAdd && "mb-1")}>
                {isDragging ? (
                  candidate.needMatchings.slice(0, 2).map((m) => (
                    <div key={m.matchingId} className="flex items-center gap-1.5 min-w-0">
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", PROP_DOT[m.propositionStatus] ?? "bg-gray-400")} />
                      <span className="text-[10px] text-foreground truncate flex-1">{m.needTitle}</span>
                      <span className={cn("text-[10px] px-1 rounded shrink-0", PROP_CHIP[m.propositionStatus] ?? "bg-muted text-muted-foreground")}>
                        {PROP_SHORT[m.propositionStatus] ?? m.propositionStatus}
                      </span>
                    </div>
                  ))
                ) : (
                  candidate.needMatchings.map((m) => {
                    const isEditable = !m.isFrozen && m.propositionStatus !== "placed";
                    return (
                      <div key={m.matchingId} className="relative group/chip flex items-center gap-1 min-w-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isEditable) setPickerOpen(pickerOpen === m.matchingId ? null : m.matchingId);
                          }}
                          className={cn(
                            "flex items-center gap-1.5 flex-1 min-w-0 text-left",
                            isEditable ? "cursor-pointer hover:opacity-75" : "cursor-default"
                          )}
                        >
                          <span className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            m.isFrozen ? "bg-gray-300" : (PROP_DOT[m.propositionStatus] ?? "bg-gray-400")
                          )} />
                          <span className={cn(
                            "text-[10px] truncate flex-1",
                            m.isFrozen ? "text-muted-foreground" : "text-foreground"
                          )}>{m.needTitle}</span>
                          <span className={cn(
                            "text-[10px] px-1 rounded shrink-0",
                            m.isFrozen ? "bg-muted text-muted-foreground" : (PROP_CHIP[m.propositionStatus] ?? "bg-muted text-muted-foreground")
                          )}>
                            {PROP_SHORT[m.propositionStatus] ?? m.propositionStatus}
                          </span>
                        </button>
                        {isEditable && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleChipDelete(m.matchingId); }}
                            className="opacity-0 group-hover/chip:opacity-100 flex items-center justify-center h-3.5 w-3.5 rounded text-muted-foreground hover:text-destructive transition-all shrink-0"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                        {pickerOpen === m.matchingId && isEditable && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={(e) => { e.stopPropagation(); setPickerOpen(null); }}
                            />
                            <div
                              className="absolute left-0 top-full z-50 mt-0.5 w-36 rounded-md border bg-popover shadow-lg overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {PICKER_STATUSES.map((s) => (
                                <button
                                  key={s.key}
                                  onClick={(e) => { e.stopPropagation(); handleChipStatusChange(m.matchingId, s.key); }}
                                  className={cn(
                                    "flex items-center gap-1.5 w-full px-2 py-1.5 text-[10px] hover:bg-accent transition-colors text-left",
                                    m.propositionStatus === s.key && "font-semibold bg-accent/50"
                                  )}
                                >
                                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.dot)} />
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
                {isDragging && candidate.needMatchings.length > 2 && (
                  <p className="text-[10px] text-muted-foreground pl-3">
                    +{candidate.needMatchings.length - 2} autre{candidate.needMatchings.length - 2 > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}
            {canAdd && (
              <button
                onClick={(e) => { e.stopPropagation(); handleAddOpen(); }}
                disabled={loadingAdd}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Plus className="h-2.5 w-2.5" />
                {loadingAdd ? "Chargement..." : "Proposer sur un besoin"}
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1.5 mt-2">
          {candidate.ownerName && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold shrink-0">
              {initials(candidate.ownerName)}
            </span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {inactive && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 bg-amber-50 rounded px-1 py-0.5">
                <AlertCircle className="h-2.5 w-2.5" />
                Inactif
              </span>
            )}
            {candidate.nextTaskAt && (
              <span className={cn(
                "inline-flex items-center gap-0.5 text-[10px] rounded px-1 py-0.5",
                nextOverdue ? "text-destructive bg-red-50 font-medium" : "text-muted-foreground"
              )}>
                <Clock className="h-2.5 w-2.5" />
                {formatDate(candidate.nextTaskAt)}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Draggable Card ──────────────────────────────────────────────────────────

function DraggableCard({
  candidate,
  onStatusChange,
  isGhost,
}: {
  candidate: CandidatRow;
  onStatusChange: (id: string, status: string) => void;
  isGhost: boolean;
}) {
  const { listeners, setNodeRef, transform } = useDraggable({ id: candidate.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      className={cn("cursor-grab active:cursor-grabbing", isGhost && "opacity-30")}
    >
      <CandidatCard candidate={candidate} onStatusChange={onStatusChange} />
    </div>
  );
}

// ─── Droppable Column ────────────────────────────────────────────────────────

function DroppableColumn({
  status,
  label,
  candidates,
  onStatusChange,
  activeId,
}: {
  status: string;
  label: string;
  candidates: CandidatRow[];
  onStatusChange: (id: string, status: string) => void;
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const style = STATUS_STYLES[status];

  return (
    <div className="flex flex-col w-56 shrink-0">
      <div className={cn(
        "flex items-center justify-between px-2.5 py-2 rounded-t-lg border-t-[3px] bg-muted/50",
        style.border
      )}>
        <span className="text-xs font-semibold truncate">{label}</span>
        <span className={cn(
          "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold min-w-[1.25rem] shrink-0 ml-1",
          style.badge
        )}>
          {candidates.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 flex flex-col gap-2 p-1.5 rounded-b-lg min-h-48 transition-colors",
          isOver ? "bg-accent/60 ring-2 ring-inset ring-primary/30" : "bg-muted/20"
        )}
      >
        {candidates.map((c) => (
          <DraggableCard
            key={c.id}
            candidate={c}
            onStatusChange={onStatusChange}
            isGhost={activeId === c.id}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Kanban ─────────────────────────────────────────────────────────────

export function KanbanPipeline({
  candidates,
  onStatusChange,
}: {
  candidates: CandidatRow[];
  onStatusChange: (id: string, status: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const grouped = Object.fromEntries(
    ACTIVE_STATUSES.map(({ key }) => [key, candidates.filter((c) => c.status === key)])
  );

  const activeCandidate = activeId ? candidates.find((c) => c.id === activeId) ?? null : null;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const candidateId = active.id as string;
    const newStatus = over.id as string;
    const candidate = candidates.find((c) => c.id === candidateId);
    if (!candidate || candidate.status === newStatus) return;
    onStatusChange(candidateId, newStatus);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="px-6 py-4 overflow-x-auto">
        <div className="flex gap-3 min-w-max pb-4">
          {ACTIVE_STATUSES.map(({ key, label }) => (
            <DroppableColumn
              key={key}
              status={key}
              label={label}
              candidates={grouped[key] ?? []}
              onStatusChange={onStatusChange}
              activeId={activeId}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeCandidate && (
          <div className="w-56 cursor-grabbing rotate-1">
            <CandidatCard candidate={activeCandidate} onStatusChange={onStatusChange} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
