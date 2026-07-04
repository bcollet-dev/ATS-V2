import { describe, expect, it } from "vitest";
import {
  normalizeContractDate,
  normalizeRemunerationLines,
  inferMasterApprenticeshipDiplomaLevel,
  ypareoDerniereClasse,
  ypareoDiplomeLePlusEleve,
  ypareoSituationAvantContrat,
} from "./cerfa-mapping";

describe("cerfa mapping helpers", () => {
  it("normalizes French dates as day/month/year", () => {
    expect(normalizeContractDate("01/09/2026")).toBe("2026-09-01");
    expect(normalizeContractDate("1.9.26")).toBe("2026-09-01");
  });

  it("normalizes partial FRE dates with a known year", () => {
    expect(normalizeContractDate("01/09", { fallbackYear: 2026 })).toBe("2026-09-01");
  });

  it("rebuilds remuneration rows when PDF extraction split percent and base into orphan rows", () => {
    expect(normalizeRemunerationLines([
      { startDate: "2026-09-01", endDate: "2026-12-31", percent: "100", reference: "SMIC" },
      { reference: "100" },
      { startDate: "2027-01-01", endDate: "2027-09-01" },
      { percent: "SMIC" },
    ])).toEqual([
      { startDate: "2026-09-01", endDate: "2026-12-31", percent: "100", reference: "SMIC" },
      { startDate: "2027-01-01", endDate: "2027-09-01", percent: "100", reference: "SMIC" },
    ]);
  });

  it("infers apprentice CERFA codes from ATS formation wording", () => {
    expect(ypareoSituationAvantContrat(null, true)).toBeNull();
    expect(ypareoSituationAvantContrat("6 - Contrat de professionnalisation", false)).toBe(6);
    expect(ypareoDiplomeLePlusEleve(null, "Master Marketing & Management")).toBe(73);
    expect(ypareoDerniereClasse(null, { isCurrent: false, endMonth: "2018-01" })).toBe(1);
  });

  it("infers master apprenticeship diploma levels from diploma wording", () => {
    expect(inferMasterApprenticeshipDiplomaLevel(null, "Master RH")).toBe(7);
    expect(inferMasterApprenticeshipDiplomaLevel("6 - Niveau licence", null)).toBe(6);
  });
});
