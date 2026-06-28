import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, isNull, and, count } from "drizzle-orm";
import { AppShell } from "@/components/shell/app-shell";
import { NotificationListener } from "@/components/shell/NotificationListener";
import { ConfirmNameModal } from "./onboarding/ConfirmNameModal";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  let unreadCount = 0;
  try {
    const [row] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    unreadCount = Number(row?.count ?? 0);
  } catch {
    unreadCount = 0;
  }

  return (
    <AppShell user={user} unreadCount={unreadCount}>
      <NotificationListener userId={user.id} />
      {!user.nameConfirmed && <ConfirmNameModal defaultName={user.fullName} />}
      {children}
    </AppShell>
  );
}
