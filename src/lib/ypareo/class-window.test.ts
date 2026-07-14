import { describe, expect, it } from "vitest";
import {
  isClassPlaceable,
  classPlaceableCutoff,
  schoolYearLabelOf,
  schoolYearShortLabelOf,
} from "./class-window";

describe("isClassPlaceable — règle 3 mois + 1 jour après la date de début", () => {
  const start = "2026-09-01"; // promo qui démarre le 1er sept 2026

  it("plaçable avant le début", () => {
    expect(isClassPlaceable(start, new Date("2026-06-15"))).toBe(true);
  });

  it("plaçable au tout début", () => {
    expect(isClassPlaceable(start, new Date("2026-09-01"))).toBe(true);
  });

  it("plaçable jusqu'à 3 mois après (30 nov / 1er déc)", () => {
    expect(isClassPlaceable(start, new Date("2026-12-01"))).toBe(true);
  });

  it("NON plaçable à partir de 3 mois + 1 jour (2 déc)", () => {
    // cutoff = 2026-12-02 (exclu)
    expect(isClassPlaceable(start, new Date("2026-12-02T00:00:00"))).toBe(false);
    expect(isClassPlaceable(start, new Date("2027-01-10"))).toBe(false);
  });

  it("le cutoff vaut startDate + 3 mois + 1 jour", () => {
    const cutoff = classPlaceableCutoff(start);
    expect(cutoff?.getFullYear()).toBe(2026);
    expect(cutoff?.getMonth()).toBe(11); // décembre (0-indexé)
    expect(cutoff?.getDate()).toBe(2);
  });

  it("date de début inconnue → plaçable (permissif)", () => {
    expect(isClassPlaceable(null, new Date("2030-01-01"))).toBe(true);
    expect(isClassPlaceable("", new Date("2030-01-01"))).toBe(true);
  });
});

describe("année scolaire dérivée de la date de début", () => {
  it("septembre → année en cours", () => {
    expect(schoolYearLabelOf("2026-09-01")).toBe("2026-2027");
    expect(schoolYearShortLabelOf("2026-09-01")).toBe("26-27");
  });
  it("janvier → année scolaire commencée l'automne précédent", () => {
    expect(schoolYearLabelOf("2027-01-15")).toBe("2026-2027");
  });
  it("juillet bascule sur l'année suivante", () => {
    expect(schoolYearLabelOf("2026-07-10")).toBe("2026-2027");
    expect(schoolYearLabelOf("2026-06-10")).toBe("2025-2026");
  });
  it("date inconnue → null", () => {
    expect(schoolYearLabelOf(null)).toBeNull();
  });
});
