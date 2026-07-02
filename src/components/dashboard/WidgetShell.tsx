"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  editMode: boolean;
  onDelete: () => void;
  children: React.ReactNode;
  className?: string;
};

export function WidgetShell({ title, editMode, onDelete, children, className }: Props) {
  return (
    <div className={cn("flex flex-col rounded-lg border bg-card h-full overflow-hidden", className)}>
      <div className={cn(
        "flex items-center justify-between px-4 py-2.5 border-b shrink-0",
        editMode && "cursor-grab active:cursor-grabbing bg-muted/40"
      )}>
        <h3 className="text-sm font-semibold truncate">{title}</h3>
        {editMode && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="ml-2 shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Supprimer ce widget"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4 min-h-0">
        {children}
      </div>
    </div>
  );
}
