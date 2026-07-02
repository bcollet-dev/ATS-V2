export type WidgetMeta = {
  type: string;
  label: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
};

export const WIDGET_REGISTRY: WidgetMeta[] = [
  {
    type: "relances",
    label: "Relances",
    description: "Tâches échues + candidats sans activité depuis 7 jours",
    defaultWidth: 8,
    defaultHeight: 5,
  },
  {
    type: "statuts_besoins",
    label: "Statuts besoins",
    description: "Vue entonnoir du pipeline besoins actifs",
    defaultWidth: 6,
    defaultHeight: 4,
  },
  {
    type: "besoins_perdus",
    label: "Besoins perdus",
    description: "Compteur et top motifs de perte (année scolaire)",
    defaultWidth: 4,
    defaultHeight: 4,
  },
  {
    type: "taux_placement",
    label: "Taux de placement",
    description: "Candidats placés et besoins pourvus (année scolaire)",
    defaultWidth: 4,
    defaultHeight: 3,
  },
  {
    type: "sources_lead",
    label: "Sources du lead",
    description: "Répartition des candidats par source (année scolaire)",
    defaultWidth: 12,
    defaultHeight: 4,
  },
  {
    type: "pipeline_cursus",
    label: "Pipeline par cursus",
    description: "Candidats en pipeline vs placés par cursus",
    defaultWidth: 6,
    defaultHeight: 4,
  },
  {
    type: "placements_classe",
    label: "Placements par classe",
    description: "Candidats placés par classe Ypareo",
    defaultWidth: 6,
    defaultHeight: 4,
  },
];
