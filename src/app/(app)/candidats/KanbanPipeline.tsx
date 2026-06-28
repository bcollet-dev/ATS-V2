"use client";

import { useState } from "react";
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
import { MoreHorizontal, Clock, AlertCircle } from "lucide-react";
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
] as const;

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

function checkInactive(c: CandidatRow) {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  if (new Date(c.updatedAt) > twoDaysAgo) return false;
  if (!c.nextTaskAt) return true;
  return new Date(c.nextTaskAt) < new Date();
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
  const inactive = checkInactive(candidate);
  const nextOverdue = candidate.nextTaskAt && new Date(candidate.nextTaskAt) < new Date();

  return (
    <div className={cn(
      "rounded-lg border bg-card p-3 transition-shadow select-none",
      isDragging ? "shadow-lg ring-2 ring-primary/20 opacity-90" : "shadow-sm hover:shadow-md",
      inactive && "border-amber-200"
    )}>
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
              <DropdownMenuLabel>Changer d'étape</DropdownMenuLabel>
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
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: candidate.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
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
