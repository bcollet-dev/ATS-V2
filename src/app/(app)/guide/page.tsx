import { requireAuth } from "@/lib/auth";
import fs from "node:fs/promises";
import path from "node:path";
import { GuideViewer, type GuideDoc } from "./GuideViewer";

export const dynamic = "force-dynamic";

// Ordre d'affichage des guides. Les fichiers sont la source unique (docs/guides),
// inclus dans le bundle via outputFileTracingIncludes (next.config.ts).
const GUIDE_FILES = [
  "01-candidats-documents.md",
  "02-taches-notifications.md",
  "03-mailing.md",
  "04-besoins.md",
  "05-utilisateurs-roles.md",
  "06-rgpd.md",
  "07-fre-cerfa.md",
  "08-catalogue-ypareo.md",
  "09-dashboard.md",
];

export default async function GuidePage() {
  await requireAuth();

  const dir = path.join(process.cwd(), "docs", "guides");
  const guides: GuideDoc[] = [];

  for (const file of GUIDE_FILES) {
    try {
      const raw = await fs.readFile(path.join(dir, file), "utf8");
      const titleMatch = raw.match(/^#\s+(.+)$/m);
      const title = titleMatch
        ? titleMatch[1].replace(/^Guide\s*[—–-]\s*/, "").trim()
        : file.replace(/\.md$/, "");
      guides.push({ slug: file.replace(/\.md$/, ""), title, markdown: raw });
    } catch {
      // fichier absent : on l'ignore silencieusement
    }
  }

  return <GuideViewer guides={guides} />;
}
