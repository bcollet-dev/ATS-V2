"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { CreateTaskModal, type TaskCreatorAttachment } from "@/app/(app)/taches/CreateTaskModal";

type TaskContextValue = {
  attachment: TaskCreatorAttachment | null;
  setAttachment: (attachment: TaskCreatorAttachment | null) => void;
};

const TaskContext = createContext<TaskContextValue>({
  attachment: null,
  setAttachment: () => {},
});

export function TaskContextProvider({ children }: { children: ReactNode }) {
  const [attachment, setAttachment] = useState<TaskCreatorAttachment | null>(null);
  const value = useMemo(() => ({ attachment, setAttachment }), [attachment]);

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export function TaskContextScope({ attachment }: { attachment: TaskCreatorAttachment }) {
  const { setAttachment } = useContext(TaskContext);
  const key = `${attachment.entityType}:${attachment.entityId}:${attachment.label}`;

  useEffect(() => {
    setAttachment(attachment);
    return () => setAttachment(null);
  }, [key, attachment, setAttachment]);

  return null;
}

export function FloatingTaskCreator({
  profiles,
  currentUserId,
}: {
  profiles: { id: string; fullName: string; email: string }[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const { attachment } = useContext(TaskContext);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 lg:bottom-6 lg:right-6"
        title="Nouvelle tache"
        aria-label="Nouvelle tache"
      >
        <Plus className="h-5 w-5" />
      </button>

      <CreateTaskModal
        open={open}
        onClose={() => setOpen(false)}
        profiles={profiles}
        defaultAssignedTo={currentUserId}
        initialAttachments={attachment ? [attachment] : []}
      />
    </>
  );
}
