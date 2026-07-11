import { requireAuth } from "@/lib/auth";
import { listMailTemplates, loadSignatureData } from "./actions";
import { TrameMailClient } from "./TrameMailClient";

export default async function TrameMailPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const gmailStatus =
    params.gmail === "connected" ? "connected" :
    params.gmail === "error"     ? "error" :
    params.gmail === "no_token"  ? "no_token" :
    undefined;

  const [templates, sigData] = await Promise.all([
    listMailTemplates({ includeArchived: true }),
    loadSignatureData(),
  ]);

  return (
    <TrameMailClient
      initialTemplates={templates}
      role={user.role}
      userId={user.id}
      userName={user.fullName}
      initialSigData={sigData}
      hasGmailConnected={!!user.googleRefreshToken}
      gmailStatus={gmailStatus}
    />
  );
}
