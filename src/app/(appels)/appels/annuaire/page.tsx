import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { SearchClient } from "./SearchClient";

export default async function AnnuairePage() {
  const user = await requireAuth();

  const members = await db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .where(and(eq(profiles.active, true), isNull(profiles.deletedAt)))
    .orderBy(asc(profiles.fullName));

  return <SearchClient currentUserId={user.id} profiles={members} />;
}
