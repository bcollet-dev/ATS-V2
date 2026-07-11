import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { getInterviewDetail } from "../actions";
import { InterviewClient } from "./InterviewClient";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [user, { id }] = await Promise.all([requireAuth(), params]);
  const interview = await getInterviewDetail(id);
  if (!interview) notFound();

  const role = user.role as AppRole;
  return (
    <InterviewClient
      interview={interview}
      canConduct={can(role, "interviews:conduct")}
      canDeleteCompleted={can(role, "candidates:delete")}
    />
  );
}
