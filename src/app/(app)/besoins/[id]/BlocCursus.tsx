"use client";

import { useRef, useEffect, useState, useTransition, useOptimistic } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { syncNeedCursus } from "@/app/(app)/besoins/actions";

type SelectedCursus = { cursusId: string; cursusName: string };
type CursusOption = { id: string; name: string; code: string | null };

export function BlocCursus({
  needId,
  initialSelected,
  allCursus,
  canEdit,
}: {
  needId: string;
  initialSelected: SelectedCursus[];
  allCursus: CursusOption[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const popoverRef = useRef<HTMLDivElement>(null);

  const [selected, setOptimistic] = useOptimistic(
    initialSelected,
    (_state: SelectedCursus[], next: SelectedCursus[]) => next
  );

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedIds = new Set(selected.map((s) => s.cursusId));

  const filtered = allCursus.filter(
    (c) =>
      !selectedIds.has(c.id) &&
      (search.trim() === "" ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.code ?? "").toLowerCase().includes(search.toLowerCase()))
  );

  function handleAdd(option: CursusOption) {
    const next = [...selected, { cursusId: option.id, cursusName: option.name }];
    startTransition(async () => {
      setOptimistic(next);
      await syncNeedCursus(needId, next.map((s) => s.cursusId));
    });
    setOpen(false);
    setSearch("");
  }

  function handleRemove(cursusId: string) {
    const next = selected.filter((s) => s.cursusId !== cursusId);
    startTransition(async () => {
      setOptimistic(next);
      await syncNeedCursus(needId, next.map((s) => s.cursusId));
    });
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between px-5 py-3.5 border-b">
        <h2 className="text-sm font-semibold">Cursus cibles</h2>
        {canEdit && (
          <div className="relative" ref={popoverRef}>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7 text-xs"
              onClick={() => setOpen((o) => !o)}
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter un cursus
            </Button>
            {open && (
              <div className="absolute top-full right-0 z-50 mt-1 w-64 rounded-lg border bg-popover shadow-lg overflow-hidden">
                <div className="p-2 border-b">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Rechercher…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                      Aucun cursus disponible
                    </p>
                  ) : (
                    filtered.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleAdd(c)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
                      >
                        <span className="flex-1 truncate">{c.name}</span>
                        {c.code && (
                          <span className="text-xs text-muted-foreground shrink-0">{c.code}</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 py-4">
        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun cursus cible défini.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selected.map((s) => (
              <Badge
                key={s.cursusId}
                variant="secondary"
                className="flex items-center gap-1 pr-1"
              >
                {s.cursusName}
                {canEdit && (
                  <button
                    onClick={() => handleRemove(s.cursusId)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                    aria-label={`Retirer ${s.cursusName}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
