import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { notifications, profiles } from "@/db/schema";
import { eq, isNull, and, count, asc } from "drizzle-orm";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationListener } from "@/components/shell/NotificationListener";
import { ConfirmNameModal } from "./onboarding/ConfirmNameModal";
import { FloatingTaskCreator, TaskContextProvider } from "@/components/tasks/FloatingTaskCreator";

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
        {!user.nameConfirmed && <ConfirmNameModal defaultName={user.fullName} />}
        {children}
        <FloatingTaskCreator profiles={activeProfiles} currentUserId={user.id} />
      </AppShell>
    </TaskContextProvider>
  );
}
