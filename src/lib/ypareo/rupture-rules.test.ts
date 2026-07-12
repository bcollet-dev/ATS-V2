import { describe, expect, it } from "vitest";
import { isRuptureAlreadyApplied } from "./rupture-rules";

describe("isRuptureAlreadyApplied", () => {
  it("tolère uniquement un 400 indiquant une rupture déjà enregistrée", () => {
    expect(isRuptureAlreadyApplied("Ypareo 400 : une rupture est déjà enregistrée sur ce contrat")).toBe(true);
    expect(isRuptureAlreadyApplied("Erreur 400 — contrat deja rompu")).toBe(true);
    expect(isRuptureAlreadyApplied("400: rupture existante")).toBe(true);
  });

  it("ne tolère pas les autres 400 (payload invalide, motif inconnu…)", () => {
    expect(isRuptureAlreadyApplied("Ypareo 400 : motif de rupture invalide")).toBe(false);
    expect(isRuptureAlreadyApplied("400 Bad Request — date incoherente")).toBe(false);
    expect(isRuptureAlreadyApplied("Erreur 400")).toBe(false);
  });

  it("ne tolère jamais les erreurs non-400", () => {
    expect(isRuptureAlreadyApplied("Ypareo 500 : contrat deja rompu")).toBe(false);
    expect(isRuptureAlreadyApplied("timeout")).toBe(false);
  });
});
