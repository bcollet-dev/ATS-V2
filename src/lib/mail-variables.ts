export type MailVariableContext = Partial<Record<
  | "prenom_candidat"
  | "nom_candidat"
  | "email_candidat"
  | "telephone_candidat"
  | "cursus_candidat"
  | "ville_candidat"
  | "nom_besoin"
  | "titre_poste"
  | "ville_poste"
  | "date_debut"
  | "date_fin"
  | "type_contrat"
  | "entreprise_associee"
  | "nom_entreprise"
  | "ville_entreprise"
  | "siret_entreprise"
  | "prenom_contact"
  | "nom_contact"
  | "prenom_consultant"
  | "nom_consultant"
  | "nom_ecole",
  string
>>;

/**
 * Replace {{variable}} placeholders in an HTML string.
 * Unknown variables are left intact.
 */
export function substituteVariables(html: string, context: MailVariableContext): string {
  return html.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const value = context[key.trim() as keyof MailVariableContext];
    return value !== undefined && value !== "" ? value : match;
  });
}

/** Strip HTML tags for the plain-text fallback in emails. */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
