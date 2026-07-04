type GeoCommune = {
  nom?: string;
  departement?: {
    code?: string;
    nom?: string;
  };
};

type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export type BirthDepartmentInput = {
  birthCity?: unknown;
  birthCountry?: unknown;
  currentDepartment?: unknown;
};

function clean(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function lookupKey(value: unknown) {
  return clean(value)
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim() ?? "";
}

function normalizeDepartmentCode(value: unknown) {
  const text = clean(value)?.toUpperCase();
  if (!text) return null;

  const explicit = text.match(/\b(2A|2B|\d{2,3})\b/);
  if (explicit) return explicit[1];

  const postal = text.match(/\b(\d{5})\b/);
  if (!postal) return null;

  const code = postal[1];
  if (code.startsWith("97") || code.startsWith("98")) return code.slice(0, 3);
  return code.slice(0, 2);
}

function isFrenchBirthCountry(value: unknown) {
  const key = lookupKey(value);
  if (!key) return true;
  return [
    "fr",
    "fra",
    "france",
    "francais",
    "francaise",
    "republique francaise",
  ].includes(key);
}

function communeQuery(value: unknown) {
  return clean(value)
    ?.replace(/\([^)]*\)/g, " ")
    .replace(/\b\d{5}\b/g, " ")
    .replace(/\b(2A|2B|\d{2,3})\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim() ?? null;
}

export async function resolveFrenchBirthDepartment(
  input: BirthDepartmentInput,
  fetcher: FetchLike = fetch,
) {
  if (!isFrenchBirthCountry(input.birthCountry)) return null;

  const currentCode = normalizeDepartmentCode(input.currentDepartment);
  if (currentCode) return currentCode;

  const postalCode = normalizeDepartmentCode(input.birthCity);
  if (postalCode) return postalCode;

  const query = communeQuery(input.birthCity);
  if (!query) return null;

  try {
    const params = new URLSearchParams({
      nom: query,
      fields: "nom,departement",
      boost: "population",
      limit: "8",
    });
    const response = await fetcher(`https://geo.api.gouv.fr/communes?${params.toString()}`, {
      cache: "force-cache",
    });
    if (!response.ok) return null;

    const data = await response.json();
    const rows = Array.isArray(data) ? data.filter((item): item is GeoCommune => (
      Boolean(item) && typeof item === "object"
    )) : [];
    if (rows.length === 0) return null;

    const key = lookupKey(query);
    const exact = rows.find((row) => lookupKey(row.nom) === key);
    return normalizeDepartmentCode((exact ?? rows[0]).departement?.code);
  } catch {
    return null;
  }
}
