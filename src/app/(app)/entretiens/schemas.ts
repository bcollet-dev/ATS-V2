import { z } from "zod";

export const interviewQuestionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, "Intitulé requis"),
  kind: z.enum(["score", "single_choice", "multiple_choice", "text", "matrix"]),
  options: z.array(z.string()).optional(),
  rows: z.array(z.string()).optional(),
  columns: z.array(z.string()).optional(),
});

export const saveTrameSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Nom de trame requis"),
  subcategory: z.string().min(1, "Sous-catégorie requise"),
  cursusId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  questions: z.array(interviewQuestionSchema).min(1, "Ajoutez au moins une question"),
});

export type SaveTrameInput = z.infer<typeof saveTrameSchema>;

export const interviewAnswerSchema = z.object({
  score: z.number().int().min(1).max(5).nullable().optional(),
  text: z.string().optional(),
  choice: z.string().nullable().optional(),
  choices: z.array(z.string()).optional(),
  matrix: z.record(z.string(), z.string()).optional(),
});

export const interviewPayloadSchema = z.object({
  answers: z.record(z.string(), interviewAnswerSchema),
  overallNotes: z.string().optional(),
});

export type InterviewPayloadInput = z.infer<typeof interviewPayloadSchema>;

// Décision d'admission à la finalisation d'un entretien de positionnement
export const positioningDecisionSchema = z
  .object({
    admissible: z.boolean(),
    refusalType: z.enum(["temporary_refusal", "definitive_refusal"]).optional(),
    refusalReason: z.string().optional(),
  })
  .refine((d) => d.admissible || !!d.refusalType, {
    message: "Précisez le type de refus",
  });

export type PositioningDecisionInput = z.infer<typeof positioningDecisionSchema>;

// Édition a posteriori de la décision, avec application optionnelle au statut
export const decisionUpdateSchema = z.object({
  decision: z.enum(["admissible", "temporary_refusal", "definitive_refusal"]).nullable(),
  refusalReason: z.string().optional(),
  applyStatus: z.boolean(),
});

export type DecisionUpdateInput = z.infer<typeof decisionUpdateSchema>;
