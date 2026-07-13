"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateRetentionConfig, triggerPurge } from "./actions";
import { RETENTION_OPTIONS, type RetentionConfig, type PurgeCounts } from "./constants";

const SELECT_CLASS =
  "flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function RgpdClient({
  config: initial,
  counts: initialCounts,
}: {
  config: RetentionConfig;
  counts: PurgeCounts;
}) {
  const [config, setConfig] = useState(initial);
  const [counts, setCounts] = useState(initialCounts);
  const [isSaving, startSaving] = useTransition();
  const [isPurging, startPurging] = useTransition();

  function handleSave() {
    startSaving(async () => {
      await updateRetentionConfig(config);
      toast.success("Configuration sauvegardée");
    });
  }

  function handlePurge() {
    startPurging(async () => {
      const result = await triggerPurge();
      toast.success(
        `Purge terminée — ${result.purgedCandidates} candidat(s), ${result.purgedCompanies} entreprise(s) supprimé(s)`
      );
      if (result.failed > 0) {
        toast.warning(
          `${result.failed} élément(s) n'ont pas pu être purgés (voir les logs) — réessai au prochain passage.`
        );
      }
      setCounts({ candidatesDue: 0, companiesDue: 0 });
    });
  }

  const totalDue = counts.candidatesDue + counts.companiesDue;
  const dirty =
    config.candidatesDays !== initial.candidatesDays ||
    config.companiesDays  !== initial.companiesDays;

  return (
    <div className="space-y-8 max-w-xl">
      {/* Retention config */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Durée de rétention</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Délai après lequel les enregistrements supprimés sont définitivement effacés.
          </p>
        </div>

        <div className="rounded-md border divide-y">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Candidats</p>
              <p className="text-xs text-muted-foreground">Données personnelles, NIR, documents</p>
            </div>
            <select
              className={SELECT_CLASS}
              value={config.candidatesDays}
              onChange={(e) => setConfig((c) => ({ ...c, candidatesDays: Number(e.target.value) }))}
            >
              {RETENTION_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">Entreprises</p>
              <p className="text-xs text-muted-foreground">Raison sociale, SIRET, contacts</p>
            </div>
            <select
              className={SELECT_CLASS}
              value={config.companiesDays}
              onChange={(e) => setConfig((c) => ({ ...c, companiesDays: Number(e.target.value) }))}
            >
              {RETENTION_OPTIONS.map((o) => (
                <option key={o.days} value={o.days}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving || !dirty} size="sm">
          {isSaving ? "Sauvegarde…" : "Sauvegarder"}
        </Button>
      </section>

      {/* Purge */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Purge des données expirées</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            La purge automatique s&apos;exécute chaque nuit à 2h. Vous pouvez aussi la déclencher manuellement.
          </p>
        </div>

        <div className="rounded-md border p-4 space-y-3">
          {totalDue === 0 ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              Aucune donnée expirée — la base est conforme.
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-destructive">
                {totalDue} enregistrement{totalDue > 1 ? "s" : ""} en attente de purge
              </p>
              {counts.candidatesDue > 0 && (
                <p className="text-muted-foreground">· {counts.candidatesDue} candidat{counts.candidatesDue > 1 ? "s" : ""}</p>
              )}
              {counts.companiesDue > 0 && (
                <p className="text-muted-foreground">· {counts.companiesDue} entreprise{counts.companiesDue > 1 ? "s" : ""}</p>
              )}
            </div>
          )}

          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={handlePurge}
            disabled={isPurging || totalDue === 0}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isPurging ? "Purge en cours…" : "Purger maintenant"}
          </Button>
        </div>
      </section>
    </div>
  );
}
