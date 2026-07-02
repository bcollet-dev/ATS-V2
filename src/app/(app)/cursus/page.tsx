import { requireAuth } from "@/lib/auth";
import { getCursus, getSyncedCursusWithClasses } from "./actions";
import { CursusPageClient } from "./CursusPageClient";

export default async function CursusPage() {
  await requireAuth();
  const [cursus, syncedCursus] = await Promise.all([
    getCursus(),
    getSyncedCursusWithClasses(),
  ]);
  return <CursusPageClient initialCursus={cursus} initialSyncedCursus={syncedCursus} />;
}
