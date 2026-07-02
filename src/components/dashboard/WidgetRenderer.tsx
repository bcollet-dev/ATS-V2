"use client";

import type { WidgetConfig } from "@/app/(app)/dashboard/actions";
import type { DashboardScope } from "@/app/(app)/dashboard/DashboardClient";
import { WidgetRelances } from "./widgets/WidgetRelances";
import { WidgetStatutsBesoins } from "./widgets/WidgetStatutsBesoins";
import { WidgetBesoinsLost } from "./widgets/WidgetBesoinsLost";
import { WidgetTauxPlacement } from "./widgets/WidgetTauxPlacement";
import { WidgetSources } from "./widgets/WidgetSources";
import { WidgetPipelineCursus } from "./widgets/WidgetPipelineCursus";
import { WidgetPlacementsClasse } from "./widgets/WidgetPlacementsClasse";

interface WidgetRendererProps {
  widget: WidgetConfig;
  scope: DashboardScope;
}

export function WidgetRenderer({ widget, scope }: WidgetRendererProps) {
  switch (widget.widgetType) {
    case "relances":
      return <WidgetRelances scope={scope} />;
    case "statuts_besoins":
      return <WidgetStatutsBesoins scope={scope} />;
    case "besoins_perdus":
      return <WidgetBesoinsLost scope={scope} />;
    case "taux_placement":
      return <WidgetTauxPlacement scope={scope} />;
    case "sources_lead":
      return <WidgetSources scope={scope} />;
    case "pipeline_cursus":
      return <WidgetPipelineCursus scope={scope} />;
    case "placements_classe":
      return <WidgetPlacementsClasse scope={scope} />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          Widget inconnu
        </div>
      );
  }
}
