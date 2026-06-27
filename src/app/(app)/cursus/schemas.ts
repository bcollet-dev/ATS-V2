import { z } from "zod";

export const createCursusSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  code: z.string().optional(),
  description: z.string().optional(),
});

export type CreateCursusInput = z.infer<typeof createCursusSchema>;
