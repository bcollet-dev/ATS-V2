import { Bell } from "lucide-react";
import Link from "next/link";

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Link
      href="/taches"
      className="relative flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors shrink-0"
      title="Tâches & notifications"
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white leading-none">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
