"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "../candidats/[id]/task-actions";

export function MarkNotificationsRead({ userId }: { userId: string }) {
  useEffect(() => {
    markNotificationsRead(userId);
  }, [userId]);
  return null;
}
