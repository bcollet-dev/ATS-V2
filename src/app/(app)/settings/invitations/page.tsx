import { listInvitations } from "./actions";
import { InvitationsClient } from "./InvitationsClient";

export default async function InvitationsPage() {
  const invitations = await listInvitations();

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Invitations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez les accès à l&apos;ATS. Seuls les emails @eda-rh.fr pré-autorisés peuvent se connecter.
        </p>
      </div>
      <InvitationsClient initialInvitations={invitations} />
    </div>
  );
}
