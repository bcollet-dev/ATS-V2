import { describe, expect, it, vi } from "vitest";
import { resolveFrenchBirthDepartment } from "./birth-department";

describe("resolveFrenchBirthDepartment", () => {
  it("keeps an existing department code without calling the commune API", async () => {
    const fetcher = vi.fn();

    await expect(resolveFrenchBirthDepartment({
      birthCity: "Paris",
      birthCountry: "France",
      currentDepartment: "75 - Paris",
    }, fetcher)).resolves.toBe("75");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("resolves the department from a French birth city", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { nom: "Lyon", departement: { code: "69", nom: "Rhone" } },
      ],
    });

    await expect(resolveFrenchBirthDepartment({
      birthCity: "Lyon",
      birthCountry: "France",
    }, fetcher)).resolves.toBe("69");
  });

  it("does not resolve a French department for an explicit foreign country", async () => {
    const fetcher = vi.fn();

    await expect(resolveFrenchBirthDepartment({
      birthCity: "Bruxelles",
      birthCountry: "Belgique",
      currentDepartment: "75",
    }, fetcher)).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
