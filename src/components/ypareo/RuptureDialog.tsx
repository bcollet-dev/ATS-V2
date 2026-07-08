"use client";

import { useState, useEffect, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MOTIFS_RUPTURE_CONTRAT, type MotifRuptureCode } from "@/lib/ypareo/client";
import { triggerRupture, getMotifsDepartYpareo } from "@/app/(app)/ypareo/rupture-actions";

type MotifDepart = { id: string; nom: string };

const INPUT_CLASS = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const TEXTAREA_CLASS = "flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none";

export function RuptureDialog({
  open,
  matchingId,
  ypareoInscriptionId,
  candidateName,
  onSuccess,
  onCancel,
}: {
  open: boolean;
  matchingId: string;
  ypareoInscriptionId: string | null;
  candidateName: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState("");
  const [motif, setMotif] = useState<MotifRuptureCode | "">("");
  const [commentaire, setCommentaire] = useState("");
  const [resteEnFormation, setResteEnFormation] = useState<boolean | null>(null);
  const [motifsDepart, setMotifsDepart] = useState<MotifDepart[]>([]);
  const [motifDepartId, setMotifDepartId] = useState("");
  const [loadingMotifs, setLoadingMotifs] = useState(false);
  const [submitting, startSubmit] = useTransition();

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setMotif("");
      setCommentaire("");
      setResteEnFormation(null);
      setMotifsDepart([]);
      setMotifDepartId("");
    }
  }, [open]);

  useEffect(() => {
    if (resteEnFormation === false && ypareoInscriptionId && motifsDepart.length === 0) {
      setLoadingMotifs(true);
      getMotifsDepartYpareo()
        .then(setMotifsDepart)
        .catch(() => toast.error("Impossible de charger les motifs de départ"))
        .finally(() => setLoadingMotifs(false));
    }
  }, [resteEnFormation, ypareoInscriptionId, motifsDepart.length]);

  function handleSubmit() {
    if (!motif) { toast.error("Sélectionnez un motif de rupture CERFA"); return; }
    if (resteEnFormation === null) { toast.error("Indiquez si le candidat reste en formation"); return; }
    if (!resteEnFormation && !motifDepartId) { toast.error("Sélectionnez un motif de départ"); return; }

    startSubmit(async () => {
      const result = await triggerRupture({
        matchingId,
        date,
        motif: motif as MotifRuptureCode,
        commentaire: commentaire.trim() || undefined,
        resteEnFormation,
        motifDepartId: resteEnFormation ? undefined : motifDepartId,
      });
      if (result.success === false) {
        toast.error(result.error);
        return;
      }
      if (result.success === "partial") {
        toast.warning(`Rupture enregistrée, mais : ${result.error}`);
      } else {
        toast.success(
          resteEnFormation
            ? "Rupture enregistrée — délai de 6 mois activé"
            : "Rupture enregistrée — candidat archivé"
        );
      }
      onSuccess();
    });
  }

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Rupture de contrat</ModalTitle>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Rupture pour <span className="font-medium text-foreground">{candidateName}</span>
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="rd-date">
              Date de rupture <span className="text-destructive">*</span>
            </Label>
            <input
              id="rd-date"
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rd-motif">
              Motif CERFA <span className="text-destructive">*</span>
            </Label>
            <select
              id="rd-motif"
              value={motif}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setMotif(isNaN(v) ? "" : (v as MotifRuptureCode));
              }}
              className={INPUT_CLASS}
            >
              <option value="">— Choisir un motif —</option>
              {MOTIFS_RUPTURE_CONTRAT.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code}. {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rd-comment">Commentaire (optionnel)</Label>
            <textarea
              id="rd-comment"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Précisions sur la rupture…"
              className={TEXTAREA_CLASS}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Le candidat reste-t-il en formation ? <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-1.5">
              <label className="flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  checked={resteEnFormation === true}
                  onChange={() => setResteEnFormation(true)}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium">Oui — il cherche une nouvelle entreprise</p>
                  <p className="text-xs text-muted-foreground">Délai de 6 mois à partir de la date de rupture</p>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  checked={resteEnFormation === false}
                  onChange={() => setResteEnFormation(false)}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <p className="text-sm font-medium text-destructive">Non — il quitte la formation</p>
                  <p className="text-xs text-muted-foreground">Départ inscription Ypareo + archivage du candidat</p>
                </div>
              </label>
            </div>
          </div>

          {resteEnFormation === false && (
            <div className="space-y-1.5">
              <Label htmlFor="rd-motif-depart">
                Motif de départ Ypareo <span className="text-destructive">*</span>
              </Label>
              {loadingMotifs ? (
                <div className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Chargement…
                </div>
              ) : (
                <select
                  id="rd-motif-depart"
                  value={motifDepartId}
                  onChange={(e) => setMotifDepartId(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="">— Choisir un motif —</option>
                  {motifsDepart.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nom}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Envoi…
              </>
            ) : (
              "Confirmer la rupture"
            )}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
