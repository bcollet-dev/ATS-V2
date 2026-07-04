"use client";

import { useState, useCallback } from "react";
import { Responsive, WidthProvider, type LayoutItem } from "react-grid-layout/legacy";
import { Plus, Pencil, Check, Users, Globe, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WidgetShell } from "@/components/dashboard/WidgetShell";
import { WidgetLibraryDrawer } from "@/components/dashboard/WidgetLibraryDrawer";
import { WidgetRenderer } from "@/components/dashboard/WidgetRenderer";
import { updateWidgetLayout, deleteWidget, addWidget, type WidgetConfig } from "./actions";
import { currentSchoolYear, availableSchoolYears } from "@/lib/dashboard/school-year";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

export type DashboardScope = "global" | "personal";

type Props = {
  initialWidgets: WidgetConfig[];
  role: string;
  userId: string;
};

const WIDGET_TITLES: Record<string, string> = {
  relances:          "Relances",
  taux_placement:    "Taux de placement",
  statuts_besoins:   "Statuts besoins",
  besoins_perdus:    "Besoins perdus",
  pipeline_cursus:   "Pipeline par cursus",
  placements_classe: "Placements par classe",
  sources_lead:      "Sources du lead",
};

const SCHOOL_YEARS = availableSchoolYears(4);

export function DashboardClient({ initialWidgets, role }: Props) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(initialWidgets);
  const [editMode, setEditMode] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [scope, setScope] = useState<DashboardScope>(
    role === "admissions" || role === "relations_entreprises" ? "personal" : "global"
  );
  const [selectedStartYear, setSelectedStartYear] = useState<number>(currentSchoolYear().startYear);

  const canToggleScope = role === "team_leader";
  const forcePersonal = role === "admissions" || role === "relations_entreprises";

  const desktopLayout = widgets.map((w) => ({
      i: w.id,
      x: w.posX,
      y: w.posY,
      w: w.width,
      h: w.height,
      minW: 3,
      minH: 2,
    }));
  const layouts = {
    lg: desktopLayout,
    md: desktopLayout.map((item) => ({ ...item, w: Math.min(item.w, 10) })),
    sm: desktopLayout.map((item) => ({ ...item, w: Math.min(item.w, 6) })),
    xs: widgets.map((w, index) => ({
      i: w.id,
      x: 0,
      y: index * Math.max(w.height, 3),
      w: 1,
      h: Math.max(w.height, 3),
      minW: 1,
      minH: 2,
    })),
  };

  const handleDragStop = useCallback(
    (_layout: readonly LayoutItem[], _old: LayoutItem | null, updated: LayoutItem | null) => {
      if (!updated) return;
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === updated.i ? { ...w, posX: updated.x, posY: updated.y } : w
        )
      );
      updateWidgetLayout(updated.i, {
        posX: updated.x,
        posY: updated.y,
        width: updated.w,
        height: updated.h,
      }).catch(() => toast.error("Erreur lors de la sauvegarde du layout"));
    },
    []
  );

  const handleResizeStop = useCallback(
    (_layout: readonly LayoutItem[], _old: LayoutItem | null, updated: LayoutItem | null) => {
      if (!updated) return;
      setWidgets((prev) =>
        prev.map((w) =>
          w.id === updated.i
            ? { ...w, posX: updated.x, posY: updated.y, width: updated.w, height: updated.h }
            : w
        )
      );
      updateWidgetLayout(updated.i, {
        posX: updated.x,
        posY: updated.y,
        width: updated.w,
        height: updated.h,
      }).catch(() => toast.error("Erreur lors de la sauvegarde du layout"));
    },
    []
  );

  const handleDelete = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    deleteWidget(id).catch(() => toast.error("Erreur lors de la suppression du widget"));
  }, []);

  const handleAddWidget = useCallback(async (widgetType: string) => {
    const result = await addWidget(widgetType);
    setWidgets((prev) => [...prev, result]);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-3 px-4 pt-4 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-6 sm:pt-6">
        <h1 className="text-2xl font-semibold sm:flex-1">Dashboard</h1>

        {canToggleScope && (
          <div className="flex w-full items-center gap-1 rounded-lg border bg-muted/40 p-1 sm:w-auto">
            <button
              onClick={() => setScope("global")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors sm:flex-none",
                scope === "global"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Globe className="h-3 w-3" />
              Vue équipe
            </button>
            <button
              onClick={() => setScope("personal")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors sm:flex-none",
                scope === "personal"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="h-3 w-3" />
              Ma vue
            </button>
          </div>
        )}

        {forcePersonal && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-md px-2.5 py-1.5">
            <Users className="h-3.5 w-3.5" />
            Ma vue
          </div>
        )}

        {/* Sélecteur d'année scolaire */}
        <div className="relative">
          <select
            value={selectedStartYear}
            onChange={(e) => setSelectedStartYear(Number(e.target.value))}
            className="appearance-none h-8 rounded-md border border-input bg-background pl-3 pr-7 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            {SCHOOL_YEARS.map((sy) => (
              <option key={sy.startYear} value={sy.startYear}>
                {sy.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        </div>

        <Button size="sm" variant="outline" className="w-full gap-1.5 sm:w-auto" onClick={() => setLibraryOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter un widget
        </Button>

        <Button
          size="sm"
          variant={editMode ? "default" : "outline"}
          className="w-full gap-1.5 sm:w-auto"
          onClick={() => setEditMode((p) => !p)}
        >
          {editMode ? (
            <><Check className="h-3.5 w-3.5" />Terminer</>
          ) : (
            <><Pencil className="h-3.5 w-3.5" />Modifier</>
          )}
        </Button>
      </div>

      {editMode && (
        <div className="px-4 pb-3 shrink-0 sm:px-6">
          <p className="text-xs text-muted-foreground bg-muted/60 rounded-md px-3 py-2">
            Mode édition — déplacez et redimensionnez les widgets, cliquez ✕ pour en supprimer.
          </p>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto px-2 pb-6 sm:px-6">
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-muted-foreground mb-4">Votre dashboard est vide.</p>
            <Button size="sm" className="gap-1.5" onClick={() => setLibraryOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Ajouter un widget
            </Button>
          </div>
        ) : (
          <ResponsiveGridLayout
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 1 }}
            rowHeight={80}
            margin={[12, 12]}
            isDraggable={editMode}
            isResizable={editMode}
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
            draggableHandle=".drag-handle"
          >
            {widgets.map((widget) => (
              <div key={widget.id} className={cn(editMode && "ring-2 ring-primary/20 rounded-lg")}>
                <WidgetShell
                  title={WIDGET_TITLES[widget.widgetType] ?? widget.widgetType}
                  editMode={editMode}
                  onDelete={() => handleDelete(widget.id)}
                  className={cn(editMode && "drag-handle")}
                >
                  <WidgetRenderer widget={widget} scope={scope} startYear={selectedStartYear} />
                </WidgetShell>
              </div>
            ))}
          </ResponsiveGridLayout>
        )}
      </div>

      <WidgetLibraryDrawer
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        existingTypes={widgets.map((w) => w.widgetType)}
        onAdd={handleAddWidget}
      />
    </div>
  );
}
