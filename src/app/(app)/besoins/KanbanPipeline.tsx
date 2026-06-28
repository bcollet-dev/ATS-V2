"use client";

import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { MoreHorizontal, Clock, AlertCircle, MapPin, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import type { NeedRow } from "./actions";

const ACTIVE_STATUSES = [
  { key: "ad_chase",        label: "À démarcher" },
  { key: "prospect",        label: "Prospect" },
  { key: "need_in_progress",label: "Besoin en cours" },
  { key: "interview",       label: "Entretien" },
  { key: "waiting_fre",     label: "Attente FRE" },
  { key: "client",          label: "Client" },
  { key: "rupture",         label: "Rupture" },
] as const;

const STATUS_STYLES: Record<string, { border: string; badge: string; dot: string }> = {
  ad_chase:         { border: "border-t-slate-400",   badge: "bg-slate-100 text-slate-700",    dot: "bg-slate-400" },
  prospect:         { border: "border-t-blue-400",    badge: "bg-blue-100 text-blue-700",      dot: "bg-blue-400" },
  need_in_progress: { border: "border-t-violet-400",  badge: "bg-violet-100 text-violet-700",  dot: "bg-violet-400" },
  interview:        { border: "border-t-orange-400",  badge: "bg-orange-100 text-orange-700",  dot: "bg-orange-400" },
  waiting_fre:      { border: "border-t-amber-400",   badge: "bg-amber-100 text-amber-700",    dot: "bg-amber-400" },
  client:           { border: "border-t-emerald-400", badge: "bg-emerald-100 text-emerald-700",dot: "bg-emerald-400" },
  rupture:          { border: "border-t-red-400",     badge: "bg-red-100 text-red-700",        dot: "bg-red-400" },
  lost:             { border: "border-t-gray-400",    badge: "bg-gray-100 text-gray-600",      dot: "bg-gray-400" },
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ─── Need Card ───────────────────────────────────────────────────────────────

function NeedCard({
  need,
  onStatusChange,
  isDragging = false,
}: {
  need: NeedRow;
  onStatusChange: (id: string, status: string) => void;
  isDragging?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-3 transition-shadow select-none",
      isDragging ? "shadow-lg ring-2 ring-primary/20 opacity-90" : "shadow-sm hover:shadow-md",
      need.isInactive && "border-amber-200"
    )}>
      <div className="flex items-start gap-1.5 mb-1.5">
        <div className="flex-1 min-w-0">
          <Link
            href={`/besoins/${need.id}`}
            className="text-sm font-medium leading-tight truncate block hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {need.title}
          </Link>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{need.companyName}</p>
        </div>
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
              {ACTIVE_STATUSES.filter((s) => s.key !== need.status).map((s) => (
                <DropdownMenuItem
                  key={s.key}
                  onClick={(e) => { e.stopPropagation(); onStatusChange(need.id, s.key); }}
                >
                  <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_STYLES[s.key].dot)} />
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Clore</DropdownMenuLabel>
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => { e.stopPropagation(); onStatusChange(need.id, "lost"); }}
              >
                Perdu
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {(need.targetCursusName || need.city) && (
        <div className="flex flex-col gap-0.5 mb-2">
          {need.targetCursusName && (
            <p className="text-xs text-muted-foreground truncate">{need.targetCursusName}</p>
          )}
          {need.city && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-2.5 w-2.5 shrink-0" />{need.city}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-2">
        {need.positionsCount > 1 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary bg-primary/10 rounded px-1 py-0.5">
            <Users className="h-2.5 w-2.5" />{need.positionsCount} postes
          </span>
        )}
        {need.ownerName && (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold shrink-0">
            {initials(need.ownerName)}
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {need.isInactive && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 bg-amber-50 rounded px-1 py-0.5">
              <AlertCircle className="h-2.5 w-2.5" />
              Inactif
            </span>
          )}
          {need.nextTaskAt && (
            <span className={cn(
              "inline-flex items-center gap-0.5 text-[10px] rounded px-1 py-0.5",
              need.nextTaskOverdue ? "text-destructive bg-red-50 font-medium" : "text-muted-foreground"
            )}>
              <Clock className="h-2.5 w-2.5" />
              {formatDate(need.nextTaskAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Draggable Card ──────────────────────────────────────────────────────────

function DraggableCard({
  need,
  onStatusChange,
  isGhost,
}: {
  need: NeedRow;
  onStatusChange: (id: string, status: string) => void;
  isGhost: boolean;
}) {
  const { listeners, setNodeRef, transform } = useDraggable({ id: need.id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      className={cn("cursor-grab active:cursor-grabbing", isGhost && "opacity-30")}
    >
      <NeedCard need={need} onStatusChange={onStatusChange} />
    </div>
  );
}

// ─── Droppable Column ────────────────────────────────────────────────────────

function DroppableColumn({
  status, label, needs, onStatusChange, activeId,
}: {
  status: string;
  label: string;
  needs: NeedRow[];
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
          {needs.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 flex flex-col gap-2 p-1.5 rounded-b-lg min-h-48 transition-colors",
          isOver ? "bg-accent/60 ring-2 ring-inset ring-primary/30" : "bg-muted/20"
        )}
      >
        {needs.map((n) => (
          <DraggableCard
            key={n.id}
            need={n}
            onStatusChange={onStatusChange}
            isGhost={activeId === n.id}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Kanban ─────────────────────────────────────────────────────────────

export function KanbanPipeline({
  needs,
  onStatusChange,
}: {
  needs: NeedRow[];
  onStatusChange: (id: string, status: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const grouped = Object.fromEntries(
    ACTIVE_STATUSES.map(({ key }) => [key, needs.filter((n) => n.status === key)])
  );

  const activeNeed = activeId ? needs.find((n) => n.id === activeId) ?? null : null;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const needId = active.id as string;
    const newStatus = over.id as string;
    const need = needs.find((n) => n.id === needId);
    if (!need || need.status === newStatus) return;
    onStatusChange(needId, newStatus);
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
              needs={grouped[key] ?? []}
              onStatusChange={onStatusChange}
              activeId={activeId}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeNeed && (
          <div className="w-56 cursor-grabbing rotate-1">
            <NeedCard need={activeNeed} onStatusChange={onStatusChange} isDragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
