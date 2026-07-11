import { requireAuth } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { getActiveCursus } from "@/app/(app)/cursus/actions";
import { getInterviewGrids } from "../actions";
import { GrillesClient } from "./GrillesClient";

export default async function GrillesPage() {
  const user = await requireAuth();
  if (!can(user.role as AppRole, "candidates:edit")) redirect("/entretiens");

  const [grids, activeCursus] = await Promise.all([getInterviewGrids(), getActiveCursus()]);

  return <GrillesClient initialGrids={grids} cursusOptions={activeCursus} />;
}
