import { requireAuth } from "@/lib/auth";
import { getCursus } from "./actions";
import { CursusPageClient } from "./CursusPageClient";

export default async function CursusPage() {
  await requireAuth();
  const cursus = await getCursus();
  return <CursusPageClient initialCursus={cursus} />;
}
