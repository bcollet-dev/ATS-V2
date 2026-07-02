import { requireAuth } from "@/lib/auth";
import { loadWidgetConfigs } from "./actions";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const [actor, widgets] = await Promise.all([requireAuth(), loadWidgetConfigs()]);

  return (
    <DashboardClient
      initialWidgets={widgets}
      role={actor.role}
      userId={actor.id}
    />
  );
}
