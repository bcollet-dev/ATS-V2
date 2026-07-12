// Ypareo répond 400 aussi bien pour « rupture déjà enregistrée » que pour un
// payload invalide (motif inconnu, date incohérente…). Seul le premier cas
// autorise à synchroniser la DB comme si la rupture avait réussi ; toute
// autre erreur doit remonter sans toucher aux statuts.
export function isRuptureAlreadyApplied(message: string): boolean {
  if (!message.includes("400")) return false;
  const normalized = message
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return /deja|existant|existe|rompu/.test(normalized);
}
