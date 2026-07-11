import { requireAuth } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { listInterviewTrames, listTrameSubcategories } from "@/app/(app)/entretiens/actions";
import { getActiveCursus } from "@/app/(app)/cursus/actions";
import { TramesEntretienClient } from "./TramesEntretienClient";

export default async function TramesEntretienPage() {
  const user = await requireAuth();
  const [trames, subcategories, cursusOptions] = await Promise.all([
    listInterviewTrames(),
    listTrameSubcategories(),
    getActiveCursus(),
  ]);

  return (
    <TramesEntretienClient
      initialTrames={trames}
      initialSubcategories={subcategories}
      cursusOptions={cursusOptions}
      canManage={can(user.role as AppRole, "interviewTrames:manage")}
    />
  );
}
