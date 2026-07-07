type JsonRecord = Record<string, unknown>;

const DEFAULT_PRODUCTS_PATH =
  "/formation?ShowArchive=false&ShowMasque=false&ShowFormationModule=false";
const DEFAULT_ACTIONS_PATH =
  "/parcours-action-formation?ShowArchive=false&ShowMasque=false&IsParcours=false&NombreMoisHistorique=24";
const DEFAULT_PLACEMENT_PATH = "/contrat-apprentissage";
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
export type YpareoApiPayload = JsonRecord;

function requiredConfig(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configuration Ypareo manquante : ${name}`);
  return value;
}

function baseUrl() {
  return requiredConfig("YPAREO_BASE_URL").replace(/\/$/, "");
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

const YPAREO_FIELD_LABELS: Record<string, string> = {
  "apprenti.sexe": "civilite / sexe de l'apprenti",
  "apprenti.nationalite": "nationalite de l'apprenti",
  "contrat.typeContratOuAvenant": "type de contrat ou avenant",
  "employeur.typeEmployeur": "type employeur",
  "employeur.idEntreprise": "identifiant entreprise Ypareo",
  "formation.diplomeOuTitreVise": "diplome ou titre vise",
  "formation.codeRncp": "code RNCP",
  "maitresApprentissages.maitreApprentissage1.idPersonnelEntreprise": "maitre d'apprentissage",
};

function normalizeMessage(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .toLowerCase();
}

function shortText(value: string, limit = 260) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function ypareoFieldLabel(field: string) {
  return YPAREO_FIELD_LABELS[field] ?? field;
}

function humanizeYpareoMessage(message: string) {
  const key = normalizeMessage(message);
  if (key.includes("identifiant du type organisme est non renseigne")) {
    return "Organisme de formation manquant : choisissez une classe Ypareo liee a un organisme, ou relancez la synchronisation des classes.";
  }
  if (key.includes("une inscription avec un statut de type contrat apprentissage doit etre presente")) {
    return "Le cursus Ypareo doit avoir une inscription au statut Contrat d'apprentissage avant de creer le contrat.";
  }
  if (key.includes("entite specifiee n existe pas") || key.includes("specified entity does not exist")) {
    return "Un identifiant Ypareo enregistre dans l'ATS n'existe plus cote Ypareo. Verifiez la personne, l'entreprise ou le cursus, puis retentez l'envoi.";
  }
  if (key.includes("erreur de mappage sur le champ") && key.includes("cerfa")) {
    return "Ypareo refuse le bloc CERFA : un champ envoye n'a pas le format attendu. Verifiez les champs candidat, entreprise, contrat et remuneration dans la modale.";
  }
  if (key.includes("could not convert string to integer")) {
    return "Ypareo attend un code numerique pour un champ envoye en texte. Verifiez les listes deroulantes et les champs codes dans la modale.";
  }
  return shortText(message);
}

function formatYpareoErrorDetail(payload: unknown) {
  if (!payload) return "";
  if (typeof payload === "string") return payload.slice(0, 800);

  if (typeof payload === "object") {
    const obj = payload as JsonRecord;
    const details: string[] = [];
    if (typeof obj.message === "string") details.push(humanizeYpareoMessage(obj.message));
    if (typeof obj.title === "string" && details.length === 0) details.push(shortText(obj.title));

    const errors = obj.errors;
    if (errors && typeof errors === "object" && !Array.isArray(errors)) {
      for (const [field, values] of Object.entries(errors as Record<string, unknown>).slice(0, 5)) {
        const messages = Array.isArray(values) ? values : [values];
        const text = messages
          .filter((item): item is string => typeof item === "string")
          .map(humanizeYpareoMessage)
          .join(" ");
        if (text) details.push(`${ypareoFieldLabel(field)} : ${shortText(text, 220)}`);
      }
    }

    if (details.length > 0) return details.join(" ");
  }

  try {
    return JSON.stringify(payload).slice(0, 1000);
  } catch {
    return "";
  }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const token = await getBearerToken();
  const cleanPath = path.replace(/^\//, "");
  const response = await fetch(`${baseUrl()}/${cleanPath}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const rawBody = await response.text();
  let payload: unknown = null;
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      payload = rawBody;
    }
  }
  if (!response.ok) {
    const detail = formatYpareoErrorDetail(payload);
    const suffix = detail ? ` : ${detail}` : ".";
    throw new Error(`Ypareo a repondu ${response.status} sur ${init?.method ?? "GET"} /${cleanPath}${suffix}`);
  }
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
  const placementPath = process.env.YPAREO_PLACEMENT_PATH?.trim() || DEFAULT_PLACEMENT_PATH;
  return request(placementPath, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createYpareoPerson(payload: YpareoApiPayload): Promise<unknown> {
  return request("/personne", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchYpareoPerson(personId: string): Promise<unknown> {
  return request(`/personne/${personId}`, { method: "GET" });
}

export async function searchYpareoPersons(searchValue: string): Promise<unknown> {
  const params = new URLSearchParams({
    SearchValue: searchValue,
    ShowArchive: "false",
    ShowMasque: "false",
    Skip: "0",
    Top: "10",
  });
  return request(`/personne?${params.toString()}`, { method: "GET" });
}

export async function searchYpareoEntreprises(searchValue: string): Promise<unknown> {
  const params = new URLSearchParams({
    SearchValue: searchValue,
    ShowArchive: "false",
    ShowMasque: "false",
    Skip: "0",
    Top: "10",
  });
  return request(`/entreprise?${params.toString()}`, { method: "GET" });
}

export async function createYpareoEntreprise(payload: YpareoApiPayload): Promise<unknown> {
  return request("/entreprise", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchYpareoEntreprise(entrepriseId: string): Promise<unknown> {
  return request(`/entreprise/${entrepriseId}`, { method: "GET" });
}

export async function updateYpareoEntreprise(
  entrepriseId: string,
  payload: YpareoApiPayload,
): Promise<unknown> {
  return request(`/entreprise/${entrepriseId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function fetchYpareoEntreprisePersonnel(entrepriseId: string): Promise<unknown> {
  return request(`/entreprise/${entrepriseId}/personnel?ShowArchive=false&ShowMasque=false&Skip=0&Top=100`, {
    method: "GET",
  });
}

export async function createYpareoEntreprisePersonnel(
  entrepriseId: string,
  payload: YpareoApiPayload,
): Promise<unknown> {
  return request(`/entreprise/${entrepriseId}/personnel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function searchYpareoLegalForms(searchValue: string): Promise<unknown> {
  const params = new URLSearchParams({
    SearchValue: searchValue,
    ShowArchive: "false",
    ShowMasque: "false",
    Skip: "0",
    Top: "20",
  });
  return request(`/forme-juridique?${params.toString()}`, { method: "GET" });
}

export async function searchYpareoRetirementFunds(searchValue: string): Promise<unknown> {
  const params = new URLSearchParams({
    SearchValue: searchValue,
    ShowArchive: "false",
    ShowMasque: "false",
    Skip: "0",
    Top: "20",
  });
  return request(`/caisse-retraite-complementaire?${params.toString()}`, { method: "GET" });
}

export async function fetchYpareoPersonCursus(personId: string): Promise<unknown> {
  return request(`/personne/${personId}/cursus`, { method: "GET" });
}

export async function fetchYpareoPersonCursusDetails(
  personId: string,
  cursusId: string,
): Promise<unknown> {
  return request(`/personne/${personId}/cursus/${cursusId}`, { method: "GET" });
}

export async function createYpareoLearnerCursus(
  personId: string,
  payload: YpareoApiPayload,
): Promise<unknown> {
  return request(`/personne/${personId}/cursus`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchYpareoStatuses(): Promise<unknown> {
  return request("/statut?ShowArchive=false&ShowMasque=false&Skip=0&Top=200", { method: "GET" });
}

export async function updateYpareoInscription(
  inscriptionId: string,
  payload: YpareoApiPayload,
): Promise<unknown> {
  return request(`/inscription/${inscriptionId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function fetchYpareoPersonContracts(personId: string): Promise<unknown> {
  return request(`/personne/${personId}/contrat-apprentissage?ShowArchive=false&ShowMasque=false&Skip=0&Top=100`, {
    method: "GET",
  });
}

export async function fetchYpareoPersonCursusContracts(
  personId: string,
  cursusId: string,
): Promise<unknown> {
  return request(`/personne/${personId}/cursus/${cursusId}/contrat-apprentissage?ShowArchive=false&ShowMasque=false&Skip=0&Top=100`, {
    method: "GET",
  });
}

export async function updateYpareoContratApprentissage(
  contratId: string,
  payload: YpareoApiPayload,
): Promise<unknown> {
  return request(`/contrat-apprentissage/${contratId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function fetchYpareoActionFormation(actionId: string): Promise<unknown> {
  return request(`/action-formation/${actionId}`, { method: "GET" });
}

export async function fetchYpareoFormation(formationId: string): Promise<unknown> {
  return request(`/formation/${formationId}`, { method: "GET" });
}

// ─── Rupture & Abandon ────────────────────────────────────────────────────────

export const MOTIFS_RUPTURE_CONTRAT = [
  { code: 1,  label: "À l'initiative de l'employeur" },
  { code: 2,  label: "À l'initiative de l'apprenti" },
  { code: 3,  label: "À l'initiative des deux parties" },
  { code: 4,  label: "Commun accord" },
  { code: 5,  label: "Obtention du diplôme avant le terme" },
  { code: 6,  label: "Force majeure" },
  { code: 7,  label: "Faute grave de l'employeur" },
  { code: 8,  label: "Faute grave de l'apprenti" },
  { code: 9,  label: "Décès de l'apprenti" },
  { code: 10, label: "Décès de l'employeur" },
  { code: 11, label: "Autre" },
] as const;

export type MotifRuptureCode = (typeof MOTIFS_RUPTURE_CONTRAT)[number]["code"];

export type YpareoMotifDepart = { id: string; nom: string };

export async function postRuptureContrat(
  contratId: string,
  body: { date: string; motif: MotifRuptureCode; commentaire?: string },
): Promise<void> {
  await request(`/contrat-apprentissage/${contratId}/rupture`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postCreerDepart(
  inscriptionId: string,
  body: { dateDepart: string; idMotifDepart: string },
): Promise<void> {
  await request(`/inscription/${inscriptionId}/creer-depart`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getMotifDepart(): Promise<YpareoMotifDepart[]> {
  const payload = await request("/motif-depart?ShowArchive=false&ShowMasque=false&Skip=0&Top=200", {
    method: "GET",
  });
  const items = records(payload as JsonRecord);
  return items
    .filter((item) => item.id && item.nom)
    .map((item) => ({ id: String(item.id), nom: String(item.nom) }));
}
