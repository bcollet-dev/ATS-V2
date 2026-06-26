import { z } from "zod";

export const createCandidatSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  phone: z.string().min(1, "Téléphone requis"),
  email: z.string().email("Email invalide"),
  cursusEnvisage: z.string().min(1, "Cursus envisagé requis"),
});

export type CreateCandidatInput = z.infer<typeof createCandidatSchema>;

export const createEntrepriseSchema = z.object({
  name: z.string().min(1, "Raison sociale requise"),
  siret: z
    .string()
    .min(1, "SIRET requis")
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{14}$/, "SIRET invalide (14 chiffres attendus)")),
  contactFirstName: z.string().min(1, "Prénom du contact requis"),
  contactLastName: z.string().min(1, "Nom du contact requis"),
  contactPhone: z.string().min(1, "Téléphone du contact requis"),
});

export type CreateEntrepriseInput = z.infer<typeof createEntrepriseSchema>;
