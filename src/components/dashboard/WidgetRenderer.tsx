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
import { WidgetDelaiPlacement } from "./widgets/WidgetDelaiPlacement";
import { WidgetTauxRupture } from "./widgets/WidgetTauxRupture";
import { WidgetComparatif } from "./widgets/WidgetComparatif";
import { WidgetActiviteConseillers } from "./widgets/WidgetActiviteConseillers";
import { WidgetNouvellesInscriptions } from "./widgets/WidgetNouvellesInscriptions";
import { WidgetNouveauxBesoins } from "./widgets/WidgetNouveauxBesoins";
import { WidgetRupturesEnCours } from "./widgets/WidgetRupturesEnCours";

interface WidgetRendererProps {
  widget: WidgetConfig;
  scope: DashboardScope;
  startYear: number;
}

export function WidgetRenderer({ widget, scope, startYear }: WidgetRendererProps) {
  switch (widget.widgetType) {
    case "relances":
      return <WidgetRelances scope={scope} />;
    case "statuts_besoins":
      return <WidgetStatutsBesoins scope={scope} />;
    case "besoins_perdus":
      return <WidgetBesoinsLost scope={scope} startYear={startYear} />;
    case "taux_placement":
      return <WidgetTauxPlacement scope={scope} startYear={startYear} />;
    case "sources_lead":
      return <WidgetSources scope={scope} startYear={startYear} />;
    case "pipeline_cursus":
      return <WidgetPipelineCursus scope={scope} startYear={startYear} />;
    case "placements_classe":
      return <WidgetPlacementsClasse scope={scope} startYear={startYear} />;
    case "delai_placement":
      return <WidgetDelaiPlacement scope={scope} startYear={startYear} />;
    case "taux_rupture":
      return <WidgetTauxRupture scope={scope} startYear={startYear} />;
    case "comparatif_annees":
      return <WidgetComparatif scope={scope} startYear={startYear} />;
    case "activite_conseillers":
      return <WidgetActiviteConseillers scope={scope} startYear={startYear} />;
    case "nouvelles_inscriptions":
      return <WidgetNouvellesInscriptions scope={scope} />;
    case "nouveaux_besoins":
      return <WidgetNouveauxBesoins scope={scope} />;
    case "ruptures_en_cours":
      return <WidgetRupturesEnCours />;
    default:
      return (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          Widget inconnu
        </div>
      );
  }
}
