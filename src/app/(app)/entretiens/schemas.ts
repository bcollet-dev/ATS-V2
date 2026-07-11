import { z } from "zod";

export const interviewQuestionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, "Intitulé requis"),
  kind: z.enum(["score", "text"]),
});

export const saveGridSchema = z.object({
  cursusId: z.string().uuid(),
  questions: z.array(interviewQuestionSchema).min(1, "Ajoutez au moins une question"),
});

export type SaveGridInput = z.infer<typeof saveGridSchema>;

export const interviewAnswerSchema = z.object({
  score: z.number().int().min(1).max(5).nullable().optional(),
  text: z.string().optional(),
});

export const interviewPayloadSchema = z.object({
  answers: z.record(z.string(), interviewAnswerSchema),
  overallNotes: z.string().optional(),
  recommendation: z.enum(["favorable", "reserve", "defavorable"]).nullable().optional(),
});

export type InterviewPayloadInput = z.infer<typeof interviewPayloadSchema>;
