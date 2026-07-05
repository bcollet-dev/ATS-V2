import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { notifications, profiles } from "@/db/schema";
import { eq, isNull, and, count, asc } from "drizzle-orm";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationListener } from "@/components/shell/NotificationListener";
import { ConfirmNameModal } from "./onboarding/ConfirmNameModal";
import { FloatingTaskCreator, TaskContextProvider } from "@/components/tasks/FloatingTaskCreator";
import { exitPreview } from "./settings/users/preview-actions";
import { Eye } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  direction:             "Direction",
  team_leader:           "Team Leader",
  admissions:            "Recruteur",
  relations_entreprises: "Relation entreprise",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  let unreadCount = 0;
  let activeProfiles: { id: string; fullName: string; email: string }[] = [];
  try {
    const [row] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    unreadCount = Number(row?.count ?? 0);
  } catch {
    unreadCount = 0;
  }

  try {
    activeProfiles = await db
      .select({ id: profiles.id, fullName: profiles.fullName, email: profiles.email })
      .from(profiles)
      .where(and(eq(profiles.active, true), isNull(profiles.deletedAt)))
      .orderBy(asc(profiles.fullName));
  } catch {
    activeProfiles = [];
  }

  return (
    <TaskContextProvider>
      <AppShell user={user} unreadCount={unreadCount}>
        <NotificationListener userId={user.id} />
        {!user.nameConfirmed && !user._isPreview && <ConfirmNameModal defaultName={user.fullName} />}
        {user._isPreview && (
          <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-[var(--color-eda-orange)] px-4 py-2 text-white">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Eye className="h-4 w-4 shrink-0" />
              <span>
                Prévisualisation&nbsp;—&nbsp;{user.fullName}&nbsp;
                ({ROLE_LABELS[user.role] ?? user.role})&nbsp;—&nbsp;Lecture seule
              </span>
            </div>
            <form action={exitPreview}>
              <button
                type="submit"
                className="rounded bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition-colors shrink-0"
              >
                Quitter
              </button>
            </form>
          </div>
        )}
        {children}
        {!user._isPreview && <FloatingTaskCreator profiles={activeProfiles} currentUserId={user.id} />}
      </AppShell>
    </TaskContextProvider>
  );
}
