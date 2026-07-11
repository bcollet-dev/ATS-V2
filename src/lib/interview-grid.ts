// Types partagés (client + serveur) pour les grilles d'entretien.
// La grille est stockée en jsonb sur interview_grids.questions ; chaque
// entretien fige une copie de la grille dans interviews.grid_snapshot pour
// que les modifications ultérieures de la grille n'altèrent pas les
// entretiens déjà réalisés.

export type InterviewQuestionKind = "score" | "text";

export type InterviewQuestion = {
  id: string;
  label: string;
  kind: InterviewQuestionKind;
};

// score : note 1–5 (questions "score"), text : réponse libre ou commentaire
export type InterviewAnswer = {
  score?: number | null;
  text?: string;
};

export type InterviewAnswers = Record<string, InterviewAnswer>;

export const RECOMMENDATION_OPTIONS = [
  { value: "favorable", label: "Favorable" },
  { value: "reserve", label: "Réservé" },
  { value: "defavorable", label: "Défavorable" },
] as const;

export type InterviewRecommendation =
  (typeof RECOMMENDATION_OPTIONS)[number]["value"];

export const SCORE_MAX = 5;
