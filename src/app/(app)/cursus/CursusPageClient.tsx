"use client";

import { useState, useTransition } from "react";
import { PlusCircle, BookOpen, Tag, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CursusDrawer } from "@/components/cursus-drawer";
import { toggleCursusActive, type CursusRow } from "./actions";

export function CursusPageClient({ initialCursus }: { initialCursus: CursusRow[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <CursusDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Catalogue des cursus</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {initialCursus.length} cursus · saisie manuelle
            </p>
          </div>
          <Button onClick={() => setDrawerOpen(true)} className="gap-1.5">
            <PlusCircle className="h-4 w-4" />
            Nouveau cursus
          </Button>
        </div>

        {initialCursus.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Aucun cursus pour l'instant</p>
            <p className="text-sm text-muted-foreground mt-1">
              Créez votre premier cursus pour commencer.
            </p>
            <Button
              variant="outline"
              className="mt-4 gap-1.5"
              onClick={() => setDrawerOpen(true)}
            >
              <PlusCircle className="h-4 w-4" />
              Nouveau cursus
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {initialCursus.map((c) => (
              <CursusCard key={c.id} cursus={c} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function CursusCard({ cursus }: { cursus: CursusRow }) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(() => toggleCursusActive(cursus.id, !cursus.active));
  }

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-lg border bg-card px-4 py-3 transition-opacity",
        !cursus.active && "opacity-50",
        isPending && "opacity-40"
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{cursus.name}</span>
          {cursus.code && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="h-3 w-3" />
              {cursus.code}
            </span>
          )}
          {!cursus.active && (
            <Badge className="text-xs bg-muted text-muted-foreground border-0 px-1.5 py-0.5">
              Inactif
            </Badge>
          )}
        </div>
        {cursus.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{cursus.description}</p>
        )}
      </div>
      <button
        onClick={toggle}
        disabled={isPending}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        title={cursus.active ? "Désactiver" : "Activer"}
      >
        {cursus.active ? (
          <ToggleRight className="h-5 w-5 text-primary" />
        ) : (
          <ToggleLeft className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
