export type CerfaRemunerationLine = {
  startDate?: string;
  endDate?: string;
  percent?: string;
  reference?: string;
};

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
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

export function normalizeContractDate(
  value: unknown,
  options: { fallbackYear?: string | number | null } = {},
) {
  const text = clean(value);
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const french = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (french) {
    const [, day, month, yearText] = french;
    const year = yearText.length === 2 ? `20${yearText}` : yearText;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const partial = text.match(/^(\d{1,2})[\/.-](\d{1,2})$/);
  const fallbackYear = clean(options.fallbackYear);
  if (partial && fallbackYear && /^\d{4}$/.test(fallbackYear)) {
    const [, day, month] = partial;
    return `${fallbackYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return text;
}

export function inferPreviousYearFromDate(value: unknown) {
  const normalized = normalizeContractDate(value);
  const year = normalized?.match(/^(\d{4})-/)?.[1];
  return year ? String(Number(year) - 1) : null;
}

export function integerCodeFromValue(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  const match = text.match(/^-?\d+/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isInteger(number) ? number : null;
}

export function ypareoSituationAvantContrat(value: unknown, _hasPreviousFormation: boolean) {
  const numeric = integerCodeFromValue(value);
  if (numeric !== null) return numeric;

  const key = lookupKey(value);
  if (key.includes("enseignement superieur") || key.includes("cpge")) return 5;
  if (key.includes("contrat de professionnalisation")) return 6;
  if (key.includes("stagiaire")) return 7;
  if (key.includes("emploi")) return 8;
  if (key.includes("demandeur") || key.includes("chomage")) return 9;
  if (key.includes("autre")) return 10;
  if (key.includes("inconnue")) return 11;
  return null;
}

export function ypareoDiplomeOuTitrePrepare(value: unknown, fallbackText?: unknown) {
  const numeric = integerCodeFromValue(value);
  if (numeric !== null) return numeric;
  return inferCerfaDiplomaCode(fallbackText ?? value);
}

export function ypareoDerniereClasse(value: unknown, latestFormation?: { isCurrent?: boolean | null; endMonth?: string | null } | null) {
  const numeric = integerCodeFromValue(value);
  if (numeric !== null) return numeric;

  const key = lookupKey(value);
  if (key.includes("1ere") || key.includes("premiere")) return key.includes("pas valide") ? 12 : 11;
  if (key.includes("2e") || key.includes("deuxieme")) return key.includes("pas valide") ? 22 : 21;
  if (key.includes("3e") || key.includes("troisieme")) return key.includes("pas valide") ? 32 : 31;
  if (key.includes("college")) return 40;
  if (key.includes("classe de 3")) return 41;
  if (key.includes("classe de 4")) return 42;
  return latestFormation?.isCurrent || !latestFormation?.endMonth ? 11 : 1;
}

export function ypareoDiplomeLePlusEleve(value: unknown, fallbackText?: unknown) {
  const numeric = integerCodeFromValue(value);
  if (numeric !== null) return numeric;
  return inferCerfaDiplomaCode(fallbackText ?? value);
}

// Référentiel "DIPLÔMES ET TITRES DE L'APPRENTI" du CERFA 10103*13 (nomenclature
// en vigueur, notice AKTO 25/01/2025). Utilisé pour "dernier diplôme préparé" et
// "diplôme le plus élevé obtenu". Attention : nomenclature différente des anciens
// CERFA (ex. Master = 73, plus 11).
export function inferCerfaDiplomaCode(value: unknown) {
  const key = lookupKey(value);
  if (!key) return null;

  // Bac +5 et plus
  if (key.includes("doctorat")) return 80;
  if (key.includes("ingenieur")) return 75;
  if (key.includes("ecole de commerce") || key.includes("mba") || key.includes("esc")) return 76;
  if (key.includes("master") || key.includes("mastere") || key.includes("dess") || key.includes("dea")) return 73;
  if (key.includes("grande ecole") || key.includes("bac 5") || key.includes("bac+5")) return 79;

  // Bac +3 et 4
  if (key.includes("licence professionnelle") || key.includes("licence pro")) return 62;
  if (key.includes("but") || key.includes("bachelor universitaire")) return 64;
  if (key.includes("licence")) return 63;
  if (key.includes("bachelor") || key.includes("maitrise") || key.includes("bac 3") || key.includes("bac 4")) return 69;

  // Bac +2
  if (key.includes("bts") || key.includes("brevet de technicien superieur")) return 54;
  if (key.includes("dut")) return 55;
  if (key.includes("deug") || key.includes("deust") || key.includes("bac 2")) return 58;

  // Niveau bac
  if (key.includes("bac pro")) return 41;
  if (key.includes("bac general") || key.includes("baccalaureat general")) return 42;
  if (key.includes("bac techno") || key.includes("baccalaureat technologique")) return 43;
  if (key.includes("specialisation professionnelle")) return 44;
  if (key.includes("bac")) return 49;

  // CAP / BEP
  if (key.includes("cap")) return 33;
  if (key.includes("bep")) return 34;
  if (key.includes("mention complementaire") || key.includes("certificat de specialisation")) return 35;

  // Aucun diplôme ni titre
  if (key.includes("brevet")) return 25;
  if (key.includes("certificat de formation generale")) return 26;
  if (key.includes("aucun")) return 13;

  return null;
}

export function inferMasterApprenticeshipDiplomaLevel(value: unknown, fallbackText?: unknown) {
  const numeric = integerCodeFromValue(value);
  if (numeric !== null) return numeric;

  const key = lookupKey(value) || lookupKey(fallbackText);
  if (!key) return null;
  if (key.includes("doctorat") || key.includes("habilitation")) return 8;
  if (
    key.includes("master")
    || key.includes("mastere")
    || key.includes("ingenieur")
    || key.includes("dess")
    || key.includes("dea")
  ) return 7;
  if (
    key.includes("licence")
    || key.includes("bachelor")
    || key.includes("but")
    || key.includes("maitrise")
    || key.includes("bac 3")
    || key.includes("bac 4")
  ) return 6;
  if (key.includes("bts") || key.includes("dut") || key.includes("deug") || key.includes("deust") || key.includes("bac 2")) return 5;
  if (key.includes("bac")) return 4;
  if (key.includes("cap") || key.includes("bep")) return 3;
  return null;
}

function salaryBase(value: unknown) {
  const key = lookupKey(value);
  if (key.includes("smic")) return "SMIC";
  if (key.includes("smc") || key.includes("convention")) return "SMC";
  return null;
}

function numericText(value: unknown) {
  const text = clean(value);
  if (!text) return null;
  const normalized = text.replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? text : null;
}

function dateYear(value: unknown) {
  return normalizeContractDate(value)?.match(/^(\d{4})-/)?.[1] ?? null;
}

function normalizeLine(line: CerfaRemunerationLine, fallbackYear?: string | null): CerfaRemunerationLine {
  return {
    startDate: normalizeContractDate(line.startDate, { fallbackYear }) ?? undefined,
    endDate: normalizeContractDate(line.endDate, { fallbackYear }) ?? undefined,
    percent: clean(line.percent) ?? undefined,
    reference: clean(line.reference) ?? undefined,
  };
}

function orphanValues(line: CerfaRemunerationLine | undefined) {
  if (!line || line.startDate || line.endDate) return { percent: null, reference: null };
  const values = [line.percent, line.reference].map(clean).filter(Boolean) as string[];
  return {
    percent: values.find((value) => numericText(value) && !salaryBase(value)) ?? null,
    reference: values.map(salaryBase).find(Boolean) ?? null,
  };
}

export function normalizeRemunerationLines(
  lines: CerfaRemunerationLine[] | null | undefined,
  options: { defaultReference?: string | null; fallbackYear?: string | null } = {},
) {
  const raw = Array.isArray(lines) ? lines : [];
  const normalized = raw.map((line) => normalizeLine(line, options.fallbackYear));
  const compacted: CerfaRemunerationLine[] = [];

  for (let index = 0; index < normalized.length; index += 1) {
    const line = normalized[index];
    if (!Object.values(line).some(Boolean)) continue;

    const hasDates = Boolean(line.startDate || line.endDate);
    if (!hasDates) {
      const orphan = orphanValues(line);
      if (!orphan.percent && !orphan.reference) compacted.push(line);
      continue;
    }

    let percent = line.percent;
    let reference = salaryBase(line.reference) ?? line.reference;
    const neighbors = [
      orphanValues(normalized[index - 1]),
      orphanValues(normalized[index + 1]),
      orphanValues(normalized[index + 2]),
    ];
    for (const neighbor of neighbors) {
      if (!percent && neighbor.percent) percent = neighbor.percent;
      if (!reference && neighbor.reference) reference = neighbor.reference;
    }

    compacted.push({
      startDate: line.startDate,
      endDate: line.endDate,
      percent: percent ?? undefined,
      reference: reference ?? clean(options.defaultReference) ?? undefined,
    });
  }

  return compacted
    .map((line) => normalizeLine(line, dateYear(line.endDate) ?? options.fallbackYear))
    .filter((line) => Object.values(line).some(Boolean))
    .slice(0, 8);
}
