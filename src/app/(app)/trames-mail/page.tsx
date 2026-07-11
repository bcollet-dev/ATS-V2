import type { Route } from "next";
import { redirect } from "next/navigation";

// Compatibilité : l'onglet Trames mail vit désormais sous /trames/mail.
// On préserve la query string (retours OAuth Gmail avec ?gmail=…).
export default async function LegacyTrameMailPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  redirect(`/trames/mail${suffix}` as Route);
}
