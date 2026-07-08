import { getRetentionConfig, getPurgeCounts } from "./actions";
import { RgpdClient } from "./RgpdClient";

export default async function RgpdPage() {
  const config = await getRetentionConfig();
  const counts = await getPurgeCounts(config);

  return (
    <div className="p-6 space-y-2">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">RGPD &amp; Rétention des données</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurez les durées de rétention et purgez les données expirées.
        </p>
      </div>
      <RgpdClient config={config} counts={counts} />
    </div>
  );
}
