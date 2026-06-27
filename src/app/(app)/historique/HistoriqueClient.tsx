"use client";

import { useState, useTransition, useCallback } from "react";
import { Pencil, ListTodo, RefreshCw, Trash2, UserPlus, History, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadEvents, type EventRow } from "./actions";

const PAGE_SIZE = 50;

const ACTION_META: Record<string, { label: string; Icon: React.FC<{ className?: string }>; color: string }> = {
  "candidate.created": { label: "Candidat créé",   Icon: UserPlus,  color: "text-emerald-600 bg-emerald-50" },
  "candidate.updated": { label: "Fiche modifiée",  Icon: Pencil,    color: "text-blue-600 bg-blue-50" },
  "task.created":      { label: "Tâche créée",     Icon: ListTodo,  color: "text-orange-600 bg-orange-50" },
  "task.updated":      { label: "Tâche modifiée",  Icon: RefreshCw, color: "text-orange-600 bg-orange-50" },
  "task.deleted":      { label: "Tâche supprimée", Icon: Trash2,    color: "text-red-600 bg-red-50" },
};

const SELECT_CLASS = cn(
  "h-8 rounded-md border border-input bg-background px-3 text-sm",
  "focus:outline-none focus:ring-1 focus:ring-ring"
);

function dayKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function timeStr(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function exportCSV(events: EventRow[]) {
  const header = "Date,Heure,Acteur,Type,Résumé,Candidat\n";
  const rows = events.map((ev) => {
    const d = new Date(ev.createdAt);
    const date = d.toLocaleDateString("fr-FR");
    const time = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const actor = ev.actorName || ev.actorEmail || "Système";
    const type = ACTION_META[ev.actionType]?.label ?? ev.actionType;
    const summary = `"${(ev.summary || "").replace(/"/g, '""')}"`;
    const candidat = ev.candidateFirstName ? `${ev.candidateFirstName} ${ev.candidateLastName}` : "";
    return [date, time, actor, type, summary, candidat].join(",");
  }).join("\n");

  const blob = new Blob(["﻿" + header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historique_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function HistoriqueClient({
  initialEvents,
  actors,
  filterCandidat,
}: {
  initialEvents: EventRow[];
  actors: { id: string; name: string }[];
  filterCandidat: string;
}) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [offset, setOffset] = useState(initialEvents.length);
  const [hasMore, setHasMore] = useState(initialEvents.length === PAGE_SIZE);
  const [filterType, setFilterType] = useState("");
  const [filterActor, setFilterActor] = useState("");
  const [isLoading, startTransition] = useTransition();

  const applyFilters = useCallback((type: string, actor: string) => {
    startTransition(async () => {
      const fresh = await loadEvents({ offset: 0, filterType: type, filterActor: actor, filterCandidat });
      setEvents(fresh);
      setOffset(fresh.length);
      setHasMore(fresh.length === PAGE_SIZE);
    });
  }, [filterCandidat]);

  function handleTypeChange(val: string) {
    setFilterType(val);
    applyFilters(val, filterActor);
  }

  function handleActorChange(val: string) {
    setFilterActor(val);
    applyFilters(filterType, val);
  }

  function handleLoadMore() {
    startTransition(async () => {
      const more = await loadEvents({ offset, filterType, filterActor, filterCandidat });
      setEvents((prev) => [...prev, ...more]);
      setOffset((prev) => prev + more.length);
      setHasMore(more.length === PAGE_SIZE);
    });
  }

  // Group by day
  const groups: { day: string; events: EventRow[] }[] = [];
  for (const ev of events) {
    const day = dayKey(ev.createdAt);
    if (groups.length === 0 || groups[groups.length - 1].day !== day) {
      groups.push({ day, events: [ev] });
    } else {
      groups[groups.length - 1].events.push(ev);
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={filterType}
          onChange={(e) => handleTypeChange(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Tous les types</option>
          {Object.entries(ACTION_META).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <select
          value={filterActor}
          onChange={(e) => handleActorChange(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Tous les acteurs</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => exportCSV(events)}
            disabled={events.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Exporter CSV ({events.length})
          </Button>
        </div>
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="rounded-lg border bg-card px-5 py-12 text-center">
          <p className="text-sm text-muted-foreground italic">Aucun événement</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(({ day, events: dayEvents }) => (
            <div key={day}>
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 capitalize">
                {day}
              </h2>
              <ol className="relative border-l border-border ml-2 space-y-5">
                {dayEvents.map((ev) => {
                  const meta = ACTION_META[ev.actionType] ?? { label: ev.actionType, Icon: History, color: "text-muted-foreground bg-muted" };
                  const Icon = meta.Icon;
                  const actor = ev.actorName || ev.actorEmail || "Système";
                  const candidateName = ev.candidateFirstName
                    ? `${ev.candidateFirstName} ${ev.candidateLastName}`
                    : null;

                  return (
                    <li key={ev.id} className="ml-6">
                      <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background ${meta.color}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <p className="text-sm leading-snug">{ev.summary || meta.label}</p>
                      <div className="flex flex-wrap items-center gap-x-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{actor}</span>
                        {candidateName && ev.candidateId && (
                          <a
                            href={`/candidats/${ev.candidateId}`}
                            className="text-xs text-primary hover:underline"
                          >
                            · {candidateName}
                          </a>
                        )}
                        <span className="text-xs text-muted-foreground">· {timeStr(ev.createdAt)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={isLoading}>
                {isLoading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Chargement…</> : "Charger plus"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
