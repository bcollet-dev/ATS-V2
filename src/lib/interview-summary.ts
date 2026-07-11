import { db } from "@/db";
import { interviews, candidates } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { InterviewAnswers, InterviewDecision, InterviewQuestion } from "@/lib/interview-grid";
import { buildInterviewSummaryPrompt, isValidDecision } from "@/lib/interview-logic";

// Cadre ADR-0005 : l'envoi de données candidat à Anthropic est désactivé tant
// que la configuration ne l'autorise pas explicitement (décisions DPO en suspens).
function isAiSummaryEnabled(): boolean {
  return process.env.AI_INTERVIEW_SUMMARY_ENABLED === "true" && !!process.env.ANTHROPIC_API_KEY;
}

// Génère le résumé IA d'un entretien terminé et le stocke sur la ligne interviews.
// Ne lève jamais : un échec est renvoyé comme erreur et ne bloque pas la finalisation.
export async function generateAndStoreInterviewSummary(
  interviewId: string
): Promise<{ success: true; summary: string } | { success: false; error: string }> {
  if (!isAiSummaryEnabled()) {
    return { success: false, error: "Résumé IA désactivé — le champ reste modifiable manuellement" };
  }

  const [row] = await db
    .select({
      id: interviews.id,
      cursusName: interviews.cursusName,
      subcategory: interviews.subcategory,
      questionsSnapshot: interviews.questionsSnapshot,
      answers: interviews.answers,
      overallNotes: interviews.overallNotes,
      decision: interviews.decision,
      firstName: candidates.firstName,
      lastName: candidates.lastName,
    })
    .from(interviews)
    .innerJoin(candidates, eq(candidates.id, interviews.candidateId))
    .where(eq(interviews.id, interviewId))
    .limit(1);

  if (!row) return { success: false, error: "Entretien introuvable" };

  const prompt = buildInterviewSummaryPrompt({
    candidateName: `${row.firstName} ${row.lastName}`,
    cursusName: row.cursusName,
    subcategory: row.subcategory,
    questions: (row.questionsSnapshot ?? []) as InterviewQuestion[],
    answers: (row.answers ?? {}) as InterviewAnswers,
    overallNotes: row.overallNotes,
    decision: isValidDecision(row.decision) ? (row.decision as InterviewDecision) : null,
  });

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic();

    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system:
        "Tu es assistant recrutement pour EDA Groupe, un centre de formation en alternance. " +
        "On te fournit la trame d'évaluation remplie lors de l'entretien d'un candidat. " +
        "Rédige un résumé de l'entretien en français, en un paragraphe de 4 à 6 phrases, destiné à l'équipe recrutement : " +
        "profil et motivation du candidat, points forts, points de vigilance, et conclusion cohérente avec la décision de l'évaluateur le cas échéant. " +
        "Reste factuel, ne complète pas avec des informations absentes de la trame. " +
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
