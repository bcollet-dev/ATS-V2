export type AppRole =
  | "admin"
  | "direction"
  | "team_leader"
  | "admissions"
  | "relations_entreprises";

export type Permission =
  | "candidates:edit"
  | "candidates:delete"
  | "candidates:viewNir"
  | "needs:edit"
  | "needs:delete"
  | "companies:edit"
  | "companies:delete"
  | "matchings:create"
  | "matchings:editStatus"
  | "interviews:conduct"
  | "interviewTrames:manage"
  | "dashboard:global"
  | "fre:manage"
  | "system:access";

const PERMISSIONS: Record<Permission, ReadonlySet<AppRole>> = {
  "candidates:edit":      new Set(["admin", "direction", "team_leader", "admissions"]),
  "candidates:delete":    new Set(["admin", "direction"]),
  "candidates:viewNir":   new Set(["admin", "direction", "team_leader", "admissions", "relations_entreprises"]),
  "needs:edit":           new Set(["admin", "direction", "team_leader", "relations_entreprises"]),
  "needs:delete":         new Set(["admin", "direction"]),
  "companies:edit":       new Set(["admin", "direction", "team_leader", "relations_entreprises"]),
  "companies:delete":     new Set(["admin", "direction"]),
  "matchings:create":     new Set(["admin", "direction", "team_leader", "relations_entreprises"]),
  "matchings:editStatus": new Set(["admin", "direction", "team_leader", "admissions", "relations_entreprises"]),
  "interviews:conduct":   new Set(["admin", "direction", "team_leader", "admissions"]),
  "interviewTrames:manage": new Set(["admin", "direction"]),
  "dashboard:global":     new Set(["admin", "direction", "team_leader"]),
  "fre:manage":           new Set(["admin", "direction", "admissions", "relations_entreprises"]),
  "system:access":        new Set(["admin"]),
};

export function can(role: AppRole, action: Permission): boolean {
  return PERMISSIONS[action].has(role);
}
