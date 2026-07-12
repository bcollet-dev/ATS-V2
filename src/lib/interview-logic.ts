// Logique métier pure des entretiens — sans DB ni framework, testée unitairement.
import {
  SCORE_MAX,
  DECISION_LABELS,
  type InterviewAnswers,
  type InterviewDecision,
  type InterviewQuestion,
} from "./interview-grid";

// ─── Validation de structure de trame ─────────────────────────────────────────

export function validateTrameQuestions(questions: InterviewQuestion[]): string[] {
  const errors: string[] = [];
  if (questions.length === 0) {
    errors.push("La trame doit contenir au moins une question");
    return errors;
  }

  const seenIds = new Set<string>();
  questions.forEach((q, index) => {
    const position = `Question ${index + 1}`;
    if (!q.id || seenIds.has(q.id)) {
      errors.push(`${position} : identifiant manquant ou dupliqué`);
    }
    seenIds.add(q.id);

    if (!q.label?.trim()) {
      errors.push(`${position} : intitulé requis`);
    }

    switch (q.kind) {
      case "single_choice":
      case "multiple_choice": {
        const options = (q.options ?? []).filter((o) => o.trim() !== "");
        if (options.length < 2) {
          errors.push(`${position} : un QCM nécessite au moins 2 options`);
        }
        break;
      }
      case "matrix": {
        const rows = (q.rows ?? []).filter((r) => r.trim() !== "");
        const columns = (q.columns ?? []).filter((c) => c.trim() !== "");
        if (rows.length < 1) {
          errors.push(`${position} : une matrice nécessite au moins 1 ligne`);
        }
        if (columns.length < 2) {
          errors.push(`${position} : une matrice nécessite au moins 2 colonnes`);
        }
        break;
      }
      case "score":
      case "text":
        break;
      default:
        errors.push(`${position} : type de question inconnu`);
    }
  });

  return errors;
}

// ─── Note moyenne ─────────────────────────────────────────────────────────────

// Moyenne sur les questions notées + les lignes de matrices dont les colonnes
// sont numériques (ex. "1".."5"), normalisée sur 5. Null si rien de notable.
export function computeAverageScore(
  questions: InterviewQuestion[],
  answers: InterviewAnswers
): number | null {
  const values: number[] = [];

  for (const q of questions) {
    const answer = answers[q.id];
    if (!answer) continue;

    if (q.kind === "score" && typeof answer.score === "number") {
      values.push(answer.score);
    }

    if (q.kind === "matrix" && answer.matrix) {
      const columns = q.columns ?? [];
      const numericColumns = columns.map((c) => Number(c.trim()));
      if (numericColumns.length === 0 || numericColumns.some((n) => Number.isNaN(n))) continue;
      const max = Math.max(...numericColumns);
      if (max <= 0) continue;

      for (const chosen of Object.values(answer.matrix)) {
        const value = Number(String(chosen).trim());
        if (!Number.isNaN(value)) {
          values.push((value / max) * SCORE_MAX);
        }
      }
    }
  }

  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

// ─── Décision → statut pipeline candidat ──────────────────────────────────────

export function decisionToCandidateStatus(
  decision: InterviewDecision
): "admissible" | "temporary_refusal" | "definitive_refusal" {
  return decision;
}

// La décision d'un entretien ne s'applique automatiquement au pipeline que si
// le candidat est encore en phase pré-matching : au-delà (entretien entreprise,
// attente FRE, placé…), écraser le statut gèlerait ses matchings actifs — la
// décision est alors enregistrée sur l'entretien sans toucher au pipeline.
const AUTO_APPLY_STATUSES = new Set([
  "to_call",
  "in_progress",
  "no_response",
  "interview",
  "pvpp",
  "admissible",
]);

export function canAutoApplyDecision(candidateStatus: string): boolean {
  return AUTO_APPLY_STATUSES.has(candidateStatus);
}

export function isValidDecision(value: unknown): value is InterviewDecision {
  return value === "admissible" || value === "temporary_refusal" || value === "definitive_refusal";
}

// ─── Prompt du résumé IA ──────────────────────────────────────────────────────

// Minimisation (ADR-0005) : prénom/nom et contenu de la trame uniquement,
// aucun identifiant interne.
export function buildInterviewSummaryPrompt(input: {
  candidateName: string;
  cursusName: string | null;
  subcategory: string;
  questions: InterviewQuestion[];
  answers: InterviewAnswers;
  overallNotes: string | null;
  decision: InterviewDecision | null;
}): string {
  const lines: string[] = [];
  lines.push(`Candidat : ${input.candidateName}`);
  if (input.cursusName) lines.push(`Cursus envisagé : ${input.cursusName}`);
  lines.push(`Type d'entretien : ${input.subcategory}`);
  if (input.decision) {
    lines.push(`Décision de l'évaluateur : ${DECISION_LABELS[input.decision]}`);
  }
  lines.push("");
  lines.push("Trame d'entretien remplie :");

  for (const q of input.questions) {
    const answer = input.answers[q.id] ?? {};
    switch (q.kind) {
      case "score": {
        const score = typeof answer.score === "number" ? `${answer.score}/${SCORE_MAX}` : "non noté";
        lines.push(`- ${q.label} : ${score}${answer.text?.trim() ? ` — commentaire : ${answer.text.trim()}` : ""}`);
        break;
      }
      case "single_choice":
        lines.push(`- ${q.label} : ${answer.choice?.trim() || "sans réponse"}`);
        break;
      case "multiple_choice": {
        const choices = (answer.choices ?? []).filter((c) => c.trim() !== "");
        lines.push(`- ${q.label} : ${choices.length > 0 ? choices.join(", ") : "sans réponse"}`);
        break;
      }
      case "text":
        lines.push(`- ${q.label} : ${answer.text?.trim() || "sans réponse"}`);
        break;
      case "matrix": {
        lines.push(`- ${q.label} :`);
        const rows = q.rows ?? [];
        rows.forEach((row, rowIndex) => {
          const chosen = answer.matrix?.[String(rowIndex)];
          lines.push(`  - ${row} : ${chosen?.trim() || "sans réponse"}`);
        });
        break;
      }
    }
  }

  if (input.overallNotes?.trim()) {
    lines.push("");
    lines.push(`Notes générales de l'évaluateur : ${input.overallNotes.trim()}`);
  }

  return lines.join("\n");
}
