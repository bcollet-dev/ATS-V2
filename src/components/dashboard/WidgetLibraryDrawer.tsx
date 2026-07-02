"use client";

import { useState, useTransition } from "react";
import { X, Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WIDGET_REGISTRY } from "@/lib/dashboard/widget-registry";

type Props = {
  open: boolean;
  onClose: () => void;
  existingTypes: string[];
  onAdd: (widgetType: string) => Promise<void>;
};

export function WidgetLibraryDrawer({ open, onClose, existingTypes, onAdd }: Props) {
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState<string | null>(null);

  function handleAdd(type: string) {
    setAdding(type);
    startTransition(async () => {
      await onAdd(type);
      setAdding(null);
    });
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-80 bg-background border-l shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="text-base font-semibold">Bibliothèque de widgets</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {WIDGET_REGISTRY.map((widget) => {
            const alreadyAdded = existingTypes.includes(widget.type);
            const isAdding = adding === widget.type && isPending;

            return (
              <div
                key={widget.type}
                className="rounded-lg border bg-card p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{widget.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {widget.description}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {widget.defaultWidth}×{widget.defaultHeight} colonnes
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={alreadyAdded ? "outline" : "default"}
                  className="w-full gap-1.5"
                  disabled={alreadyAdded || isAdding}
                  onClick={() => handleAdd(widget.type)}
                >
                  {isAdding ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : alreadyAdded ? (
                    <><Check className="h-3.5 w-3.5" />Déjà ajouté</>
                  ) : (
                    <><Plus className="h-3.5 w-3.5" />Ajouter</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
