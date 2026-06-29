"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Upload, FileText, Check, AlertCircle, Mail } from "lucide-react";
import {
  Modal, ModalContent, ModalHeader, ModalTitle,
  ModalClose, ModalBody, ModalFooter,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  loadEmailModalData, sendMatchingEmails,
  type EmailModalData, type EmailModalCVInfo,
} from "./actions";
import { uploadCandidateCV } from "@/app/(app)/candidats/[id]/actions";
import type { MatchingCandidateRow, MatchingNeedRow } from "./actions";

type BesoinState = {
  recipientContactId: string;
  subject: string;
  body: string;
  result: "idle" | "success" | "error";
  error?: string;
};

const ACCEPT =
  ".pdf,.doc,.docx,application/pdf,application/msword," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function SendEmailModal({
  open,
  onClose,
  selectedCandidates,
  selectedNeeds,
}: {
  open: boolean;
  onClose: () => void;
  selectedCandidates: MatchingCandidateRow[];
  selectedNeeds: MatchingNeedRow[];
}) {
  const [loading, setLoading] = useState(false);
  const [modalData, setModalData] = useState<EmailModalData | null>(null);
  const [cvOverrides, setCvOverrides] = useState<Record<string, EmailModalCVInfo>>({});
  const [perBesoin, setPerBesoin] = useState<Record<string, BesoinState>>({});
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingCandIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setCvOverrides({});
    const companyIds = [...new Set(selectedNeeds.map((n) => n.companyId))];
    const candidateIds = selectedCandidates.map((c) => c.id);

    loadEmailModalData(companyIds, candidateIds).then((data) => {
      setModalData(data);
      const initial: Record<string, BesoinState> = {};
      for (const need of selectedNeeds) {
        const contacts = data.contactsByCompanyId[need.companyId] ?? [];
        const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
        const firstTemplate = data.templates[0];
        initial[need.id] = {
          recipientContactId: primary?.id ?? "",
          subject: firstTemplate?.subject ?? "",
          body: firstTemplate?.body ?? "",
          result: "idle",
        };
      }
      setPerBesoin(initial);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function applyTemplate(templateId: string) {
    const template = modalData?.templates.find((t) => t.id === templateId);
    if (!template) return;
    setPerBesoin((prev) => {
      const next = { ...prev };
      for (const needId of Object.keys(next)) {
        next[needId] = { ...next[needId], subject: template.subject, body: template.body };
      }
      return next;
    });
  }

  function updateBesoin(needId: string, patch: Partial<BesoinState>) {
    setPerBesoin((prev) => ({ ...prev, [needId]: { ...prev[needId], ...patch } }));
  }

  function handleUploadClick(candidateId: string) {
    pendingCandIdRef.current = candidateId;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    const candidateId = pendingCandIdRef.current;
    if (!files || files.length === 0 || !candidateId) return;
    setUploadingFor(candidateId);
    const fd = new FormData();
    fd.append("file", files[0]);
    const result = await uploadCandidateCV(candidateId, fd);
    setUploadingFor(null);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setCvOverrides((prev) => ({
      ...prev,
      [candidateId]: { documentId: result.documentId, fileName: files[0].name, storagePath: "" },
    }));
    toast.success("CV uploadé");
    pendingCandIdRef.current = null;
  }

  function getEffectiveCV(candidateId: string): EmailModalCVInfo | null {
    return cvOverrides[candidateId] ?? modalData?.cvByCandidate[candidateId] ?? null;
  }

  const allCVDocumentIds = selectedCandidates
    .map((c) => getEffectiveCV(c.id)?.documentId)
    .filter((id): id is string => id !== undefined);

  function handleSendAll() {
    if (!modalData) return;

    const emails = selectedNeeds.flatMap((need) => {
      const state = perBesoin[need.id];
      if (!state?.recipientContactId) return [];
      const contacts = modalData.contactsByCompanyId[need.companyId] ?? [];
      const contact = contacts.find((c) => c.id === state.recipientContactId);
      if (!contact?.email) return [];
      return [{
        needId: need.id,
        recipientEmail: contact.email,
        subject: state.subject,
        body: state.body,
        cvDocumentIds: allCVDocumentIds,
      }];
    });

    if (emails.length === 0) {
      toast.error("Aucun destinataire valide configuré");
      return;
    }

    startSending(async () => {
      const { results } = await sendMatchingEmails({ emails });
      let successCount = 0;
      let failCount = 0;
      for (const r of results) {
        if (r.success) {
          successCount++;
          updateBesoin(r.needId, { result: "success" });
        } else {
          failCount++;
          updateBesoin(r.needId, { result: "error", error: r.error });
        }
      }
      if (successCount > 0) {
        toast.success(
          `${successCount} email${successCount > 1 ? "s" : ""} envoyé${successCount > 1 ? "s" : ""}`
        );
      }
      if (failCount > 0) {
        toast.error(`${failCount} email${failCount > 1 ? "s" : ""} en échec`);
      }
      if (failCount === 0) setTimeout(onClose, 800);
    });
  }

  const allSent = selectedNeeds.length > 0 && selectedNeeds.every((n) => perBesoin[n.id]?.result === "success");

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o && !isSending) onClose(); }}>
      <ModalContent className="max-w-2xl">
        <ModalHeader>
          <ModalTitle>Envoyer les CV</ModalTitle>
          <ModalClose />
        </ModalHeader>

        <ModalBody>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !modalData ? null : (
            <div className="space-y-5">

              {/* Template selector */}
              {modalData.templates.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Modèle</span>
                  <select
                    className="flex-1 h-8 text-sm rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                    defaultValue={modalData.templates[0]?.id ?? ""}
                    onChange={(e) => applyTemplate(e.target.value)}
                  >
                    {modalData.templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* CV attachments (global for all emails) */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Pièces jointes — {allCVDocumentIds.length}/{selectedCandidates.length} CV
                </p>
                <div className="rounded-lg border divide-y">
                  {selectedCandidates.map((cand) => {
                    const cv = getEffectiveCV(cand.id);
                    const isUploading = uploadingFor === cand.id;
                    return (
                      <div key={cand.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                        {cv ? (
                          <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                        <span className={cn("flex-1 truncate", !cv && "text-muted-foreground")}>
                          {cand.firstName} {cand.lastName}
                        </span>
                        {cv ? (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">{cv.fileName}</span>
                        ) : (
                          <button
                            onClick={() => handleUploadClick(cand.id)}
                            disabled={isUploading}
                            className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                          >
                            {isUploading ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Upload className="h-3 w-3" />
                            )}
                            {isUploading ? "Upload…" : "Ajouter CV"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Per-besoin email config */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Emails à envoyer — {selectedNeeds.length} besoin{selectedNeeds.length > 1 ? "s" : ""}
                </p>
                {selectedNeeds.map((need) => {
                  const state = perBesoin[need.id];
                  const contacts = modalData.contactsByCompanyId[need.companyId] ?? [];
                  if (!state) return null;
                  return (
                    <div key={need.id} className="rounded-lg border p-4 space-y-3">
                      {/* Need header + result badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold leading-tight">{need.title}</p>
                          <p className="text-xs text-muted-foreground">{need.companyName}</p>
                        </div>
                        {state.result === "success" && (
                          <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium shrink-0">
                            <Check className="h-3 w-3" /> Envoyé
                          </span>
                        )}
                        {state.result === "error" && (
                          <span
                            className="flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full font-medium shrink-0"
                            title={state.error}
                          >
                            <AlertCircle className="h-3 w-3" /> Échec
                          </span>
                        )}
                      </div>

                      {/* Recipient */}
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-muted-foreground w-14 shrink-0">À</label>
                        {contacts.length > 0 ? (
                          <select
                            className="flex-1 h-7 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                            value={state.recipientContactId}
                            onChange={(e) => updateBesoin(need.id, { recipientContactId: e.target.value })}
                          >
                            <option value="">— Choisir un contact —</option>
                            {contacts.map((c) => (
                              <option key={c.id} value={c.id} disabled={!c.email}>
                                {c.firstName} {c.lastName}
                                {c.isPrimary ? " (principal)" : ""}
                                {c.email ? ` · ${c.email}` : " · sans email"}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs text-amber-600">Aucun contact enregistré</span>
                        )}
                      </div>

                      {/* Subject */}
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-muted-foreground w-14 shrink-0">Objet</label>
                        <input
                          type="text"
                          className="flex-1 h-7 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                          value={state.subject}
                          onChange={(e) => updateBesoin(need.id, { subject: e.target.value })}
                        />
                      </div>

                      {/* Body */}
                      <div className="flex gap-3">
                        <label className="text-xs text-muted-foreground w-14 shrink-0 mt-1.5">Message</label>
                        <textarea
                          className="flex-1 text-xs rounded-md border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[80px]"
                          value={state.body}
                          onChange={(e) => updateBesoin(need.id, { body: e.target.value })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={handleFileChange}
          />
        </ModalBody>

        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={isSending}>
            Annuler
          </Button>
          <Button
            disabled={loading || isSending || allSent || !modalData}
            onClick={handleSendAll}
            className="gap-1.5"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : allSent ? (
              <Check className="h-4 w-4" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            {isSending ? "Envoi en cours…" : allSent ? "Envoyé" : `Envoyer (${selectedNeeds.length})`}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
