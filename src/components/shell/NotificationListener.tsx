"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Bell } from "lucide-react";

type DbNotification = {
  id: string;
  title: string;
  body: string;
  type: string;
  candidate_id: string | null;
};

export function NotificationListener({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`notifs-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as DbNotification;
          toast(notif.title, {
            description: notif.body,
            icon: <Bell className="h-4 w-4 text-primary" />,
            duration: 7000,
            action: notif.candidate_id
              ? {
                  label: "Voir",
                  onClick: () => router.push(`/candidats/${notif.candidate_id}`),
                }
              : undefined,
          });
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
