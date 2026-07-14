/**
 * Règles de « fenêtre de placement » d'une classe (promo) et d'année scolaire,
 * dérivées de la date de début (`startDate`) — aucune donnée stockée requise.
 *
 * Règle métier : une promo devient NON plaçable à partir de `startDate + 3 mois
 * + 1 jour`. Avant cette limite (y compris avant le début), elle reste plaçable.
 * Une date de début inconnue ne bloque pas (permissif).
 */

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date limite (exclue) à partir de laquelle la classe n'est plus plaçable. */
export function classPlaceableCutoff(startDate: string | Date | null | undefined): Date | null {
  const d = toDate(startDate);
  if (!d) return null;
  const cutoff = new Date(d);
  cutoff.setMonth(cutoff.getMonth() + 3);
  cutoff.setDate(cutoff.getDate() + 1);
  return cutoff;
}

/** true si on peut encore placer un candidat sur cette classe à l'instant `now`. */
export function isClassPlaceable(
  startDate: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  const cutoff = classPlaceableCutoff(startDate);
  if (!cutoff) return true; // date inconnue → on ne bloque pas
  return now < cutoff;
}

/** Année de début de l'année scolaire (sept→août) d'une date. Juillet bascule sur l'année suivante. */
export function schoolYearStartOf(startDate: string | Date | null | undefined): number | null {
  const d = toDate(startDate);
  if (!d) return null;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return month >= 7 ? year : year - 1;
}

/** Libellé long, ex. "2026-2027". */
export function schoolYearLabelOf(startDate: string | Date | null | undefined): string | null {
  const s = schoolYearStartOf(startDate);
  return s === null ? null : `${s}-${s + 1}`;
}

/** Libellé court, ex. "26-27". */
export function schoolYearShortLabelOf(startDate: string | Date | null | undefined): string | null {
  const s = schoolYearStartOf(startDate);
  return s === null ? null : `${String(s).slice(2)}-${String(s + 1).slice(2)}`;
}
