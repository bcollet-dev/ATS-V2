"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, ExternalLink, Upload, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { GenerateFreButton } from "@/components/fre/GenerateFreButton";
import { toast } from "sonner";
import {
  type FreDocument,
  getSignedFreUrl,
  importFre,
  applyFreExtraction,
} from "./fre-actions";

// ─── Confirm modal for imported FRE fields ────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  masterFirstName: "Maître — Prénom",
  masterLastName: "Maître — Nom",
  masterBirthDate: "Maître — Date de naissance",
  masterJobTitle: "Maître — Fonction",
  masterDiploma: "Maître — Diplôme le plus élevé",
  masterDiplomaLevel: "Maître — Niveau du diplôme",
  masterPhone: "Maître — Téléphone",
  masterEmail: "Maître — Email",
  contactFirstName: "Contact contrat — Prénom",
  contactLastName: "Contact contrat — Nom",
  contactJobTitle: "Contact contrat — Fonction",
  contactPhone: "Contact contrat — Téléphone",
  contactEmail: "Contact contrat — Email",
  weeklyHours: "Durée hebdomadaire (h)",
  endDate: "Date de fin du contrat",
  contractType: "Type de contrat",
  salaryReference: "Référence salaire",
  smcAmount: "Montant SMC",
  remunerationStart1: "Rémunération 1 — Début",
  remunerationEnd1: "Rémunération 1 — Fin",
  remunerationPercent1: "Rémunération 1 — Pourcentage",
  remunerationReference1: "Rémunération 1 — Base",
  remunerationStart2: "Rémunération 2 — Début",
  remunerationEnd2: "Rémunération 2 — Fin",
  remunerationPercent2: "Rémunération 2 — Pourcentage",
  remunerationReference2: "Rémunération 2 — Base",
  remunerationStart3: "Rémunération 3 — Début",
  remunerationEnd3: "Rémunération 3 — Fin",
  remunerationPercent3: "Rémunération 3 — Pourcentage",
  remunerationReference3: "Rémunération 3 — Base",
  remunerationStart4: "Rémunération 4 — Début",
  remunerationEnd4: "Rémunération 4 — Fin",
  remunerationPercent4: "Rémunération 4 — Pourcentage",
  remunerationReference4: "Rémunération 4 — Base",
  remunerationStart5: "Rémunération 5 — Début",
  remunerationEnd5: "Rémunération 5 — Fin",
  remunerationPercent5: "Rémunération 5 — Pourcentage",
  remunerationReference5: "Rémunération 5 — Base",
  remunerationStart6: "Rémunération 6 — Début",
  remunerationEnd6: "Rémunération 6 — Fin",
  remunerationPercent6: "Rémunération 6 — Pourcentage",
  remunerationReference6: "Rémunération 6 — Base",
  remunerationStart7: "Rémunération 7 — Début",
  remunerationEnd7: "Rémunération 7 — Fin",
  remunerationPercent7: "Rémunération 7 — Pourcentage",
  remunerationReference7: "Rémunération 7 — Base",
  remunerationStart8: "Rémunération 8 — Début",
  remunerationEnd8: "Rémunération 8 — Fin",
  remunerationPercent8: "Rémunération 8 — Pourcentage",
  remunerationReference8: "Rémunération 8 — Base",
  monthlyGrossSalary: "Salaire brut mensuel",
  hourlyGrossSalary: "Salaire brut horaire",
  overtimeHandling: "Heures sup.",
  benefitFood: "Repas (€/repas)",
  benefitHousing: "Logement (€/mois)",
  benefitOther: "Autres avantages",
  opco: "OPCO",
  idcc: "Code IDCC",
  collectiveAgreement: "Convention collective",
  retirementFund: "Caisse de retraite",
  providentFund: "Organisme de prévoyance",
  legalRepFirstName: "Représentant légal — Prénom",
  legalRepLastName: "Représentant légal — Nom",
};

function FreImportConfirmModal({
  open,
  onOpenChange,
  documentId,
  needId,
  initialFields,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  documentId: string;
  needId: string;
  initialFields: Record<string, string>;
}) {
  const [fields, setFields] = useState(initialFields);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => (
    new Set(Object.entries(initialFields).filter(([, value]) => value).map(([key]) => key))
  ));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setFields(initialFields);
    setSelectedKeys(new Set(Object.entries(initialFields).filter(([, value]) => value).map(([key]) => key)));
  }, [initialFields]);

  function handleApply() {
    const selectedFields = Object.fromEntries(
      Object.entries(fields).filter(([key]) => selectedKeys.has(key)),
    );
    startTransition(async () => {
      const result = await applyFreExtraction(documentId, needId, selectedFields);
      if (!result.success) {
        toast.error(result.error ?? "Erreur lors de l'application");
        return;
      }
      toast.success("Champs appliqués avec succès");
      onOpenChange(false);
      router.refresh();
    });
  }

  function toggleKey(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const entries = Object.entries(fields);
  const populated = entries;
  const selectedCount = entries.filter(([key]) => selectedKeys.has(key)).length;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Champs extraits de la FRE</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-3 max-h-[60vh] overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun champ extrait automatiquement.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {populated.length} champ(s) extraits. Vérifiez et corrigez si nécessaire avant d&apos;appliquer.
              </p>
              {entries.map(([key, value]) => (
                <div key={key} className="grid grid-cols-[auto_1fr] gap-2 rounded-md border px-2 py-2">
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(key)}
                    onChange={() => toggleKey(key)}
                    className="mt-6 h-4 w-4 rounded border-gray-300 accent-primary"
                  />
                  <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {FIELD_LABELS[key] ?? key}
                  </Label>
                    <Input
                      value={value}
                      onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleApply} disabled={isPending || selectedCount === 0}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Appliquer{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Main BlocFre component ───────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function BlocFre({
  needId,
  initialDocuments,
  canEdit,
}: {
  needId: string;
  initialDocuments: FreDocument[];
  canEdit: boolean;
}) {
  const [docs, setDocs] = useState(initialDocuments);
  const [isGenerating, startGenerating] = useTransition();
  const [isImporting, startImporting] = useTransition();
  const [oldExpanded, setOldExpanded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Import confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    documentId: string;
    fields: Record<string, string>;
  }>({ open: false, documentId: "", fields: {} });

  const [current, ...older] = docs;
  const currentIsLegacyGenerated =
    current?.kind === "generated" && /^fre-\d+-generated\.pdf$/.test(current.fileName);

  useEffect(() => {
    setDocs(initialDocuments);
  }, [initialDocuments]);

  function handleGenerated(document: FreDocument) {
    setDocs((previous) => [
      document,
      ...previous.filter((item) => item.id !== document.id),
    ]);
  }

  function handleOpen(documentId: string) {
    const targetTab = window.open("", "_blank", "noopener,noreferrer");
    startGenerating(async () => {
      const url = await getSignedFreUrl(documentId);
      if (!url) {
        targetTab?.close();
        toast.error("Impossible de générer le lien");
        return;
      }
      if (targetTab) {
        targetTab.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    });
  }

  function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    startImporting(async () => {
      const result = await importFre(needId, fd);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const extractedCount = Object.values(result.extractedData).filter(Boolean).length;
      setDocs((previous) => [
        result.document,
        ...previous.filter((item) => item.id !== result.document.id),
      ]);
      toast.success(
        extractedCount > 0
          ? "FRE importée — vérifiez les champs extraits"
          : "FRE importée — aucun champ détecté automatiquement"
      );
      setConfirmModal({
        open: true,
        documentId: result.documentId,
        fields: result.extractedData,
      });
    });
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  return (
    <>
      <div className="rounded-lg border bg-card text-sm">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <h2 className="font-semibold text-sm flex-1">Fiche de Rémunération (FRE)</h2>
        </div>

        <div className="px-4 py-3 space-y-3">
          {!current ? (
            <p className="text-xs text-muted-foreground">Aucune FRE générée pour ce besoin.</p>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">
                  {current.kind === "generated" ? "Générée" : "Importée"} le {formatDate(current.createdAt)}
                </p>
              </div>
              {currentIsLegacyGenerated ? (
                <GenerateFreButton
                  needId={needId}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 shrink-0"
                  label="Ouvrir"
                  onGenerated={handleGenerated}
                />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 shrink-0"
                  onClick={() => handleOpen(current.id)}
                  disabled={isGenerating}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ouvrir
                </Button>
              )}
            </div>
          )}

          {canEdit && (
            <div className="flex gap-2">
              <GenerateFreButton
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs gap-1"
                needId={needId}
                label={current ? "Nouvelle version" : "Générer la FRE"}
                onGenerated={handleGenerated}
              />
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs gap-1"
                onClick={() => fileRef.current?.click()}
                disabled={isImporting}
              >
                {isImporting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Upload className="h-3.5 w-3.5" />
                }
                Importer FRE signée
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.doc"
                className="hidden"
                onChange={handleImportChange}
              />
            </div>
          )}

          {older.length > 0 && (
            <div>
              <button
                onClick={() => setOldExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {oldExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {older.length} version{older.length > 1 ? "s" : ""} précédente{older.length > 1 ? "s" : ""}
              </button>
              {oldExpanded && (
                <div className="mt-2 space-y-1.5">
                  {older.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 bg-muted/30">
                      <p className="text-xs text-muted-foreground truncate">
                        {doc.kind === "generated" ? "Générée" : "Importée"} le {formatDate(doc.createdAt)}
                      </p>
                      <button
                        onClick={() => handleOpen(doc.id)}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Ouvrir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <FreImportConfirmModal
        open={confirmModal.open}
        onOpenChange={(v) => setConfirmModal((s) => ({ ...s, open: v }))}
        documentId={confirmModal.documentId}
        needId={needId}
        initialFields={confirmModal.fields}
      />
    </>
  );
}
