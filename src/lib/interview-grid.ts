// Types partagés (client + serveur) pour les trames d'entretien.
// Les questions d'une trame sont stockées en jsonb sur interview_trames.questions ;
// chaque entretien fige une copie des questions dans interviews.questions_snapshot
// pour que les modifications ultérieures de la trame n'altèrent pas les
// entretiens déjà réalisés.

export type InterviewQuestionKind =
  | "score"
  | "single_choice"
  | "multiple_choice"
  | "text"
  | "matrix";

export type InterviewQuestion = {
  id: string;
  label: string;
  kind: InterviewQuestionKind;
  // single_choice / multiple_choice
  options?: string[];
  // matrix : questions en ligne, colonnes de réponse communes (choix unique par ligne)
  rows?: string[];
  columns?: string[];
};

export type InterviewAnswer = {
  score?: number | null;
  text?: string;
  choice?: string | null;
  choices?: string[];
  // matrix : index de ligne (en chaîne) → colonne choisie
  matrix?: Record<string, string>;
};

export type InterviewAnswers = Record<string, InterviewAnswer>;

export const QUESTION_KIND_LABELS: Record<InterviewQuestionKind, string> = {
  score: "Note (1 à 5)",
  single_choice: "QCM — choix unique",
  multiple_choice: "QCM — choix multiple",
  text: "Texte libre",
  matrix: "Matrice",
};

export const SCORE_MAX = 5;

// Sous-catégorie spéciale : seule une trame de positionnement pilote
// l'admission du candidat (PVPP / Admissible / Refus + motif).
export const POSITIONING_SUBCATEGORY = "Entretien de positionnement";

export function isPositioningSubcategory(subcategory: string | null | undefined): boolean {
  return subcategory === POSITIONING_SUBCATEGORY;
}

export type InterviewDecision = "admissible" | "temporary_refusal" | "definitive_refusal";

export const DECISION_LABELS: Record<InterviewDecision, string> = {
  admissible: "Admissible",
  temporary_refusal: "Refus temporaire",
  definitive_refusal: "Refus définitif",
};
