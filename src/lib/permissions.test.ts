import { describe, it, expect } from "vitest";
import { can, type AppRole, type Permission } from "./permissions";

const ALL_ROLES: AppRole[] = [
  "admin",
  "direction",
  "team_leader",
  "admissions",
  "relations_entreprises",
];

// Matrix: action → [allowed roles]
const MATRIX: Record<Permission, AppRole[]> = {
  "candidates:edit":      ["admin", "direction", "team_leader", "admissions"],
  "candidates:delete":    ["admin", "direction"],
  "candidates:viewNir":   ["admin", "direction", "team_leader", "admissions", "relations_entreprises"],
  "needs:edit":           ["admin", "direction", "team_leader", "relations_entreprises"],
  "needs:delete":         ["admin", "direction"],
  "companies:edit":       ["admin", "direction", "team_leader", "relations_entreprises"],
  "companies:delete":     ["admin", "direction"],
  "matchings:create":     ["admin", "direction", "team_leader", "relations_entreprises"],
  "matchings:editStatus": ["admin", "direction", "team_leader", "admissions", "relations_entreprises"],
  "interviews:conduct":   ["admin", "direction", "team_leader", "admissions"],
  "interviewTrames:manage": ["admin", "direction"],
  "dashboard:global":     ["admin", "direction", "team_leader"],
  "fre:manage":           ["admin", "direction", "admissions", "relations_entreprises"],
  "catalog:sync":         ["admin", "direction"],
  "system:access":        ["admin"],
};

describe("permissions matrix", () => {
  for (const [action, allowedRoles] of Object.entries(MATRIX) as [Permission, AppRole[]][]) {
    const deniedRoles = ALL_ROLES.filter((r) => !allowedRoles.includes(r));

    describe(`${action}`, () => {
      for (const role of allowedRoles) {
        it(`allows ${role}`, () => {
          expect(can(role, action)).toBe(true);
        });
      }
      for (const role of deniedRoles) {
        it(`denies ${role}`, () => {
          expect(can(role, action)).toBe(false);
        });
      }
    });
  }
});
