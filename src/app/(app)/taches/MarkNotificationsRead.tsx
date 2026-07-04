"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "../candidats/[id]/task-actions";

export function MarkNotificationsRead() {
  useEffect(() => {
    markNotificationsRead();
  }, []);
  return null;
}
