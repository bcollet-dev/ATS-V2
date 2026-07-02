"use client";

import { useState, useTransition, useRef } from "react";
import { FileText, Download, Plus, Upload, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { toast } from "sonner";
import {
  type FreDocument,
  generateFre,
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
  masterPhone: "Maître — Téléphone",
  masterEmail: "Maître — Email",
  weeklyHours: "Durée hebdomadaire (h)",
  contractType: "Type de contrat",
  salaryReference: "Référence salaire",
  smcAmount: "Montant SMC",
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
  const [isPending, startTransition] = useTransition();

  function handleApply() {
    startTransition(async () => {
      const result = await applyFreExtraction(documentId, needId, fields);
      if (!result.success) {
        toast.error(result.error ?? "Erreur lors de l'application");
        return;
      }
      toast.success("Champs appliqués avec succès");
      onOpenChange(false);
    });
  }

  const populated = Object.entries(fields).filter(([, v]) => v);

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Champs extraits de la FRE</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-3 max-h-[60vh] overflow-y-auto">
          {populated.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun champ extrait automatiquement.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {populated.length} champ(s) extraits. Vérifiez et corrigez si nécessaire avant d&apos;appliquer.
              </p>
              {Object.entries(fields).filter(([, v]) => v).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {FIELD_LABELS[key] ?? key}
                  </Label>
                  <Input
                    value={value}
                    onChange={(e) => setFields((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleApply} disabled={isPending || populated.length === 0}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Appliquer
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

  function handleGenerate() {
    startGenerating(async () => {
      const result = await generateFre(needId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      // Trigger download
      const a = document.createElement("a");
      a.href = result.signedUrl;
      a.download = "fre-generated.docx";
      a.click();
      toast.success("FRE générée et téléchargée");
      // Reload docs list
      window.location.reload();
    });
  }

  function handleDownload(storagePath: string, fileName: string) {
    startGenerating(async () => {
      const url = await getSignedFreUrl(storagePath);
      if (!url) { toast.error("Impossible de générer le lien"); return; }
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
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
      toast.success("FRE importée — vérifiez les champs extraits");
      setConfirmModal({
        open: true,
        documentId: result.documentId,
        fields: result.extractedData,
      });
      window.location.reload();
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
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 shrink-0"
                onClick={() => handleDownload(current.storagePath, current.fileName)}
                disabled={isGenerating}
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger
              </Button>
            </div>
          )}

          {canEdit && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs gap-1"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Plus className="h-3.5 w-3.5" />
                }
                {current ? "Nouvelle version" : "Générer la FRE"}
              </Button>
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
                        onClick={() => handleDownload(doc.storagePath, doc.fileName)}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Télécharger
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
