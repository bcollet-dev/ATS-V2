"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBody,
  ModalClose,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  loadYpareoPlacementDraft,
} from "@/app/(app)/ypareo/actions";
import type {
  YpareoPlacementDraft,
  YpareoPlacementSource,
} from "@/lib/ypareo/placement-draft";

type Props = {
  open: boolean;
  source: YpareoPlacementSource;
  sourceId: string | null;
  targetLabel: string;
  onCancel: () => void;
  onConfirm: (draft: YpareoPlacementDraft, selectedClassId: string | null) => void | Promise<void>;
};

export function YpareoPlacementModal({
  open,
  source,
  sourceId,
  targetLabel,
  onCancel,
  onConfirm,
}: Props) {
  const [draft, setDraft] = useState<YpareoPlacementDraft | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || !sourceId) {
      setDraft(null);
      setSelectedClassId("");
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    loadYpareoPlacementDraft(source, sourceId)
      .then((data) => {
        if (!active) return;
        setDraft(data);
        setSelectedClassId(data.classOptions[0]?.id ?? "");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Impossible de charger le dossier Ypareo.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, source, sourceId]);

  const canConfirm = Boolean(draft && draft.blockingIssues.length === 0);
  const selectedClass = useMemo(
    () => draft?.classOptions.find((option) => option.id === selectedClassId) ?? null,
    [draft, selectedClassId],
  );

  function handleConfirm() {
    if (!draft || !canConfirm) return;
    startTransition(async () => {
      await onConfirm(draft, selectedClassId || null);
    });
  }

  return (
    <Modal open={open} onOpenChange={(value) => { if (!value) onCancel(); }}>
      <ModalContent className="max-w-5xl">
        <ModalHeader>
          <div className="min-w-0">
            <ModalTitle>Revue CERFA / Ypareo</ModalTitle>
            {draft && (
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {draft.title} - {draft.subtitle}
              </p>
            )}
          </div>
          <ModalClose />
        </ModalHeader>

        <ModalBody className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement du dossier CERFA
            </div>
          )}

          {!loading && error && (
            <Notice tone="danger" icon={<AlertTriangle className="h-4 w-4" />}>
              {error}
            </Notice>
          )}

          {!loading && draft && (
            <>
              <div className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Passage en {targetLabel}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Les informations ci-dessous reprennent les blocs du CERFA et les donnees candidat, entreprise et besoin disponibles dans l'ATS.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <label className="block text-xs font-medium text-muted-foreground">Classe Ypareo</label>
                  <select
                    value={selectedClassId}
                    onChange={(event) => setSelectedClassId(event.target.value)}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {draft.classOptions.length === 0 ? (
                      <option value="">Aucune classe disponible</option>
                    ) : (
                      draft.classOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))
                    )}
                  </select>
                  {selectedClass && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[selectedClass.code, selectedClass.site, selectedClass.startDate, selectedClass.endDate]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                  )}
                </div>
              </div>

              {draft.blockingIssues.length > 0 && (
                <Notice tone="danger" icon={<AlertTriangle className="h-4 w-4" />}>
                  {draft.blockingIssues.join(" ")}
                </Notice>
              )}

              {draft.warnings.length > 0 && (
                <Notice tone="warning" icon={<AlertTriangle className="h-4 w-4" />}>
                  {draft.warnings.join(" ")}
                </Notice>
              )}

              {draft.missingFields.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-900">
                    Champs CERFA requis a completer ({draft.missingFields.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {draft.missingFields.map((item) => (
                      <span key={item} className="rounded-full bg-white px-2 py-0.5 text-xs text-amber-800 ring-1 ring-amber-200">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <Notice tone="success" icon={<CheckCircle2 className="h-4 w-4" />}>
                  Les champs requis identifies dans le CERFA sont renseignes.
                </Notice>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                {draft.sections.map((section) => (
                  <section key={section.title} className="rounded-lg border bg-card">
                    <div className="border-b px-4 py-2.5">
                      <h3 className="text-sm font-semibold">{section.title}</h3>
                    </div>
                    <div className="divide-y">
                      {section.fields.map((field) => (
                        <div key={`${section.title}-${field.label}`} className="grid grid-cols-[0.9fr_1.1fr] gap-3 px-4 py-2.5 text-sm">
                          <span className="text-xs text-muted-foreground">
                            {field.label}
                            {field.required && <span className="ml-1 text-destructive">*</span>}
                          </span>
                          <span className={cn("min-w-0 break-words", field.value ? "text-foreground" : "text-muted-foreground")}>
                            {field.value ?? "A completer"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm || loading || isPending}>
            {isPending ? "Confirmation..." : `Confirmer ${targetLabel}`}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: "danger" | "warning" | "success";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        tone === "danger" && "border-red-200 bg-red-50 text-red-800",
        tone === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
