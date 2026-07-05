import { requireAuth } from "@/lib/auth";
import { can, type AppRole } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { isNull, asc } from "drizzle-orm";
import { UsersClient } from "./UsersClient";

export default async function UsersPage() {
  const actor = await requireAuth();
  if (!can(actor.role as AppRole, "system:access")) redirect("/dashboard");

  const users = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      fullName: profiles.fullName,
      role: profiles.role,
      active: profiles.active,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .where(isNull(profiles.deletedAt))
    .orderBy(asc(profiles.fullName));

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comptes actifs sur l&apos;ATS. Pour modifier un rôle, contactez un administrateur.
        </p>
      </div>
      <UsersClient
        users={users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        }))}
        currentUserId={actor.id}
        isAdmin={actor.role === "admin"}
      />
    </div>
  );
}
