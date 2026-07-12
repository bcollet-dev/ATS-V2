import { describe, it, expect } from "vitest";
import {
  validateTrameQuestions,
  computeAverageScore,
  decisionToCandidateStatus,
  isValidDecision,
  canAutoApplyDecision,
  buildInterviewSummaryPrompt,
} from "./interview-logic";
import type { InterviewQuestion } from "./interview-grid";

const scoreQ: InterviewQuestion = { id: "q1", label: "Motivation", kind: "score" };
const textQ: InterviewQuestion = { id: "q2", label: "Projet professionnel", kind: "text" };
const singleQ: InterviewQuestion = {
  id: "q3",
  label: "Disponibilité",
  kind: "single_choice",
  options: ["Immédiate", "Sous 1 mois", "Plus tard"],
};
const multiQ: InterviewQuestion = {
  id: "q4",
  label: "Canaux de recherche",
  kind: "multiple_choice",
  options: ["Indeed", "LinkedIn", "Bouche à oreille"],
};
const matrixQ: InterviewQuestion = {
  id: "q5",
  label: "Savoir-être",
  kind: "matrix",
  rows: ["Expression orale", "Posture professionnelle"],
  columns: ["1", "2", "3", "4", "5"],
};

describe("validateTrameQuestions", () => {
  it("accepte une trame valide avec les 5 types", () => {
    expect(validateTrameQuestions([scoreQ, textQ, singleQ, multiQ, matrixQ])).toEqual([]);
  });

  it("rejette une trame vide", () => {
    expect(validateTrameQuestions([])).toContain("La trame doit contenir au moins une question");
  });

  it("rejette un QCM avec moins de 2 options", () => {
    const errors = validateTrameQuestions([
      { id: "a", label: "Choix", kind: "single_choice", options: ["Seule option"] },
    ]);
    expect(errors.some((e) => e.includes("2 options"))).toBe(true);
  });

  it("rejette une matrice sans lignes ou avec moins de 2 colonnes", () => {
    const errors = validateTrameQuestions([
      { id: "a", label: "Matrice", kind: "matrix", rows: [], columns: ["1"] },
    ]);
    expect(errors.some((e) => e.includes("1 ligne"))).toBe(true);
    expect(errors.some((e) => e.includes("2 colonnes"))).toBe(true);
  });

  it("rejette un intitulé vide et un id dupliqué", () => {
    const errors = validateTrameQuestions([
      { id: "a", label: "OK", kind: "text" },
      { id: "a", label: "  ", kind: "text" },
    ]);
    expect(errors.some((e) => e.includes("dupliqué"))).toBe(true);
    expect(errors.some((e) => e.includes("intitulé"))).toBe(true);
  });
});

describe("computeAverageScore", () => {
  it("fait la moyenne des questions notées", () => {
    const avg = computeAverageScore([scoreQ, { ...scoreQ, id: "q1b" }], {
      q1: { score: 4 },
      q1b: { score: 5 },
    });
    expect(avg).toBe(4.5);
  });

  it("intègre les lignes de matrice numérique normalisées sur 5", () => {
    const avg = computeAverageScore([matrixQ], {
      q5: { matrix: { "0": "5", "1": "3" } },
    });
    expect(avg).toBe(4); // (5 + 3) / 2
  });

  it("ignore les matrices à colonnes non numériques", () => {
    const nonNumeric: InterviewQuestion = {
      ...matrixQ,
      id: "q6",
      columns: ["Insuffisant", "Bon", "Excellent"],
    };
    expect(computeAverageScore([nonNumeric], { q6: { matrix: { "0": "Bon" } } })).toBeNull();
  });

  it("renvoie null sans réponse notable", () => {
    expect(computeAverageScore([textQ], { q2: { text: "..." } })).toBeNull();
  });
});

describe("decisionToCandidateStatus", () => {
  it("mappe chaque décision sur le statut pipeline correspondant", () => {
    expect(decisionToCandidateStatus("admissible")).toBe("admissible");
    expect(decisionToCandidateStatus("temporary_refusal")).toBe("temporary_refusal");
    expect(decisionToCandidateStatus("definitive_refusal")).toBe("definitive_refusal");
  });

  it("valide les décisions connues uniquement", () => {
    expect(isValidDecision("admissible")).toBe(true);
    expect(isValidDecision("pvpp")).toBe(false);
    expect(isValidDecision(null)).toBe(false);
  });

  it("n'applique automatiquement la décision qu'en phase pré-matching", () => {
    for (const status of ["to_call", "in_progress", "no_response", "interview", "pvpp", "admissible"]) {
      expect(canAutoApplyDecision(status)).toBe(true);
    }
    for (const status of ["company_interview", "waiting_fre", "placed", "rupture", "temporary_refusal", "definitive_refusal"]) {
      expect(canAutoApplyDecision(status)).toBe(false);
    }
  });
});

describe("buildInterviewSummaryPrompt", () => {
  it("rend tous les types de questions et la décision", () => {
    const prompt = buildInterviewSummaryPrompt({
      candidateName: "Marie Dupont",
      cursusName: "Bachelor RH",
      subcategory: "Entretien de positionnement",
      questions: [scoreQ, textQ, singleQ, multiQ, matrixQ],
      answers: {
        q1: { score: 4, text: "Très motivée" },
        q2: { text: "Devenir chargée RH" },
        q3: { choice: "Immédiate" },
        q4: { choices: ["Indeed", "LinkedIn"] },
        q5: { matrix: { "0": "4" } },
      },
      overallNotes: "Bon contact.",
      decision: "admissible",
    });

    expect(prompt).toContain("Marie Dupont");
    expect(prompt).toContain("Bachelor RH");
    expect(prompt).toContain("Motivation : 4/5 — commentaire : Très motivée");
    expect(prompt).toContain("Projet professionnel : Devenir chargée RH");
    expect(prompt).toContain("Disponibilité : Immédiate");
    expect(prompt).toContain("Canaux de recherche : Indeed, LinkedIn");
    expect(prompt).toContain("Expression orale : 4");
    expect(prompt).toContain("Posture professionnelle : sans réponse");
    expect(prompt).toContain("Décision de l'évaluateur : Admissible");
    expect(prompt).toContain("Notes générales de l'évaluateur : Bon contact.");
  });

  it("n'inclut jamais d'identifiant interne", () => {
    const prompt = buildInterviewSummaryPrompt({
      candidateName: "Marie Dupont",
      cursusName: null,
      subcategory: "Suivi",
      questions: [textQ],
      answers: { q2: { text: "RAS" } },
      overallNotes: null,
      decision: null,
    });
    expect(prompt).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
    expect(prompt).not.toContain("Décision");
  });
});
