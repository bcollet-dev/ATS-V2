import { db } from "@/db";
import { interviews, candidates } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { InterviewAnswers, InterviewQuestion } from "@/lib/interview-grid";

const RECOMMENDATION_LABELS: Record<string, string> = {
  favorable: "Favorable",
  reserve: "Réservé",
  defavorable: "Défavorable",
};

function buildPrompt(input: {
  candidateName: string;
  cursusName: string | null;
  questions: InterviewQuestion[];
  answers: InterviewAnswers;
  overallNotes: string | null;
  recommendation: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`Candidat : ${input.candidateName}`);
  if (input.cursusName) lines.push(`Cursus envisagé : ${input.cursusName}`);
  if (input.recommendation) {
    lines.push(`Avis de l'évaluateur : ${RECOMMENDATION_LABELS[input.recommendation] ?? input.recommendation}`);
  }
  lines.push("");
  lines.push("Grille d'entretien :");
  for (const q of input.questions) {
    const answer = input.answers[q.id] ?? {};
    if (q.kind === "score") {
      const score = answer.score != null ? `${answer.score}/5` : "non noté";
      lines.push(`- ${q.label} : ${score}${answer.text ? ` — commentaire : ${answer.text}` : ""}`);
    } else {
      lines.push(`- ${q.label} : ${answer.text?.trim() || "sans réponse"}`);
    }
  }
  if (input.overallNotes?.trim()) {
    lines.push("");
    lines.push(`Notes générales de l'évaluateur : ${input.overallNotes.trim()}`);
  }
  return lines.join("\n");
}

// Génère le résumé IA d'un entretien terminé et le stocke sur la ligne interviews.
export async function generateAndStoreInterviewSummary(
  interviewId: string
): Promise<{ success: true; summary: string } | { success: false; error: string }> {
  const [row] = await db
    .select({
      id: interviews.id,
      cursusName: interviews.cursusName,
      gridSnapshot: interviews.gridSnapshot,
      answers: interviews.answers,
      overallNotes: interviews.overallNotes,
      recommendation: interviews.recommendation,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
    })
    .from(interviews)
    .innerJoin(candidates, eq(candidates.id, interviews.candidateId))
    .where(eq(interviews.id, interviewId))
    .limit(1);

  if (!row) return { success: false, error: "Entretien introuvable" };

  const prompt = buildPrompt({
    candidateName: `${row.firstName} ${row.lastName}`,
    cursusName: row.cursusName,
    questions: (row.gridSnapshot ?? []) as InterviewQuestion[],
    answers: (row.answers ?? {}) as InterviewAnswers,
    overallNotes: row.overallNotes,
    recommendation: row.recommendation,
  });

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic();

    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system:
        "Tu es assistant recrutement pour EDA Groupe, un centre de formation en alternance. " +
        "On te fournit la grille d'évaluation remplie lors de l'entretien de motivation d'un candidat. " +
        "Rédige un résumé de l'entretien en français, en 4 à 6 phrases, destiné à l'équipe recrutement : " +
        "profil et motivation du candidat, points forts, points de vigilance, et conclusion alignée sur l'avis de l'évaluateur. " +
        "Reste factuel, ne complète pas avec des informations absentes de la grille. " +
        "Réponds uniquement avec le résumé, sans titre ni préambule.",
      messages: [{ role: "user", content: prompt }],
    });

    const summary = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!summary) return { success: false, error: "Réponse vide du modèle" };

    await db
      .update(interviews)
      .set({ aiSummary: summary, aiSummaryGeneratedAt: new Date(), updatedAt: new Date() })
      .where(eq(interviews.id, interviewId));

    return { success: true, summary };
  } catch (err) {
    console.error("Interview summary generation failed:", err);
    return { success: false, error: "Échec de la génération du résumé IA" };
  }
}
