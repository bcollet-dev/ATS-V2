type JsonRecord = Record<string, unknown>;

const DEFAULT_PRODUCTS_PATH =
  "/formation?ShowArchive=false&ShowMasque=false&ShowFormationModule=false";
const DEFAULT_ACTIONS_PATH =
  "/parcours-action-formation?ShowArchive=false&ShowMasque=false&IsParcours=false&NombreMoisHistorique=24";
const PAGE_SIZE = 500;

let bearerCache: { token: string; expiresAt: number } | null = null;

export type YpareoCursus = {
  externalId: string;
  code: string | null;
  name: string;
  description: string | null;
  active: boolean;
  raw: JsonRecord;
};

export type YpareoClass = {
  externalId: string;
  productExternalId: string;
  code: string | null;
  name: string;
  site: string | null;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
  raw: JsonRecord;
};

export type YpareoPlacementPayload = JsonRecord;

function requiredConfig(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuration Ypareo manquante : ${name}`);
  return value;
}

function baseUrl() {
  return (process.env.YPAREO_BASE_URL?.trim() ?? "").replace(/\/$/, "");
}

function records(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is JsonRecord => Boolean(item) && typeof item === "object"
    );
  }
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as JsonRecord;
  for (const key of ["data", "items", "results", "produits", "products", "actions"]) {
    if (Array.isArray(obj[key])) return records(obj[key]);
  }
  return [];
}

function valueAt(record: JsonRecord, path: string): unknown {
  let value: unknown = record;
  for (const part of path.split(".")) {
    if (!value || typeof value !== "object") return undefined;
    value = (value as JsonRecord)[part];
  }
  return value;
}

function textAt(record: JsonRecord, paths: string[]): string {
  for (const path of paths) {
    const value = valueAt(record, path);
    if (typeof value === "string" || typeof value === "number") {
      return String(value).trim();
    }
  }
  return "";
}

function cleanBearer(value: string) {
  return value.replace(/^Bearer\s+/i, "").trim();
}

async function getBearerToken(): Promise<string> {
  const directToken = process.env.YPAREO_API_TOKEN?.trim();
  if (directToken) return cleanBearer(directToken);

  if (bearerCache && bearerCache.expiresAt > Date.now()) {
    return bearerCache.token;
  }

  const identificationToken = requiredConfig("YPAREO_IDENTIFICATION_TOKEN");
  const response = await fetch(`${baseUrl()}/authenticate`, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ token: identificationToken }),
  });
  const payload = (await response.json().catch(() => null)) as { token?: string } | null;
  if (!response.ok || !payload?.token) {
    throw new Error(`Authentification Ypareo refusée (${response.status}).`);
  }

  bearerCache = {
    token: cleanBearer(payload.token),
    expiresAt: Date.now() + 45 * 60 * 1000,
  };
  return bearerCache.token;
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const token = await getBearerToken();
  const response = await fetch(`${baseUrl()}/${path.replace(/^\//, "")}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Ypareo a répondu ${response.status}.`);
  return payload;
}

function paginatedPath(path: string, skip: number) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}Skip=${skip}&Top=${PAGE_SIZE}`;
}

async function fetchAll(path: string): Promise<JsonRecord[]> {
  const result: JsonRecord[] = [];
  for (let skip = 0; skip < 100_000; skip += PAGE_SIZE) {
    const page = records(await request(paginatedPath(path, skip)));
    result.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return result;
}

function normalizeAction(raw: JsonRecord): YpareoClass {
  return {
    externalId: textAt(raw, ["id", "idAction", "id_action"]),
    productExternalId: textAt(raw, ["formation.id", "productId", "produitId", "idProduit"]),
    code: textAt(raw, ["reference", "code", "codeAction"]) || null,
    name: textAt(raw, ["nom", "name", "libelle", "intitule"]),
    site:
      textAt(raw, [
        "lieuFormation.lieuExterne.nom",
        "lieuFormation.entreprise.nom",
        "lieuFormation.salle.nom",
        "site",
      ]) || null,
    startDate: textAt(raw, ["calendrier.dateDebut", "startDate", "dateDebut"]) || null,
    endDate: textAt(raw, ["calendrier.dateFin", "endDate", "dateFin"]) || null,
    active: raw.isArchive !== true && raw.active !== false && raw.actif !== false,
    raw,
  };
}

export async function fetchYpareoCatalog(): Promise<{
  cursus: YpareoCursus[];
  classes: YpareoClass[];
}> {
  const productsPath = process.env.YPAREO_PRODUCTS_PATH?.trim() || DEFAULT_PRODUCTS_PATH;
  const actionsPath = process.env.YPAREO_ACTIONS_PATH?.trim() || DEFAULT_ACTIONS_PATH;

  const [rawProducts, rawActions] = await Promise.all([
    fetchAll(productsPath),
    fetchAll(actionsPath),
  ]);

  const cursus = rawProducts
    .map((raw): YpareoCursus => ({
      externalId: textAt(raw, ["id", "idProduit", "id_produit"]),
      code: textAt(raw, ["code", "reference", "codeProduit"]) || null,
      name: textAt(raw, ["nom", "name", "libelle", "intitule"]),
      description: textAt(raw, ["description", "descriptif"]) || null,
      active: raw.isArchive !== true && raw.active !== false && raw.actif !== false,
      raw,
    }))
    .filter((item) => item.externalId && item.name);

  const classes = rawActions
    .map(normalizeAction)
    .filter((item) => item.externalId && item.productExternalId && item.name);

  return { cursus, classes };
}

export async function pushPlacementToYpareo(payload: YpareoPlacementPayload): Promise<unknown> {
  return request(requiredConfig("YPAREO_PLACEMENT_PATH"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
