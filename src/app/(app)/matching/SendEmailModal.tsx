"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Loader2, Upload, FileText, Check, AlertCircle, Mail, Save, Bell } from "lucide-react";
import {
  Modal, ModalContent, ModalHeader, ModalTitle,
  ModalClose, ModalBody, ModalFooter,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  loadEmailModalData, sendMatchingEmails, saveMailTemplate,
  type EmailModalData, type EmailModalCVInfo, type EmailModalTemplate,
} from "./actions";
import { uploadCandidateCV } from "@/app/(app)/candidats/[id]/actions";
import type { MatchingCandidateRow, MatchingNeedRow } from "./actions";

type BesoinState = {
  recipientContactId: string;
  cc: string;
  bcc: string;
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
  const [excludedCandidateIds, setExcludedCandidateIds] = useState<Set<string>>(new Set());
  const [notifyCandidates, setNotifyCandidates] = useState(true);

  // Template selection
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const newTemplateNameRef = useRef<HTMLInputElement>(null);

  const [isSending, startSending] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingCandIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setCvOverrides({});
    setExcludedCandidateIds(new Set());
    setNotifyCandidates(true);
    setSavingTemplate(false);
    setNewTemplateName("");
    const companyIds = [...new Set(selectedNeeds.map((n) => n.companyId))];
    const candidateIds = selectedCandidates.map((c) => c.id);

    loadEmailModalData(companyIds, candidateIds).then((data) => {
      setModalData(data);
      const firstTemplateId = data.templates[0]?.id ?? "";
      setSelectedTemplateId(firstTemplateId);
      const initial: Record<string, BesoinState> = {};
      for (const need of selectedNeeds) {
        const contacts = data.contactsByCompanyId[need.companyId] ?? [];
        const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
        const firstTemplate = data.templates[0];
        initial[need.id] = {
          recipientContactId: primary?.id ?? "",
          cc: "",
          bcc: "",
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
    setSelectedTemplateId(templateId);
    if (!templateId) return; // saisie libre — conserver le contenu actuel
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

  async function handleSaveTemplate() {
    const firstNeedId = selectedNeeds[0]?.id;
    const firstState = firstNeedId ? perBesoin[firstNeedId] : null;
    if (!firstState || !newTemplateName.trim()) return;
    setIsSavingTemplate(true);
    const result = await saveMailTemplate(newTemplateName.trim(), firstState.subject, firstState.body);
    setIsSavingTemplate(false);
    if (result.success) {
      const newTemplate: EmailModalTemplate = {
        id: result.id,
        name: newTemplateName.trim(),
        subject: firstState.subject,
        body: firstState.body,
      };
      setModalData((prev) =>
        prev ? { ...prev, templates: [...prev.templates, newTemplate] } : prev
      );
      setSelectedTemplateId(result.id);
      setSavingTemplate(false);
      setNewTemplateName("");
      toast.success("Trame enregistrée");
    } else {
      toast.error(result.error);
    }
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
      [candidateId]: { documentId: result.documentId, fileName: files[0].name },
    }));
    toast.success("CV uploadé");
    pendingCandIdRef.current = null;
  }

  function getEffectiveCV(candidateId: string): EmailModalCVInfo | null {
    return cvOverrides[candidateId] ?? modalData?.cvByCandidate[candidateId] ?? null;
  }

  function toggleCandidateExclusion(candidateId: string) {
    setExcludedCandidateIds((prev) => {
      const next = new Set(prev);
      next.has(candidateId) ? next.delete(candidateId) : next.add(candidateId);
      return next;
    });
  }

  const includedCandidates = selectedCandidates.filter((c) => !excludedCandidateIds.has(c.id));
  const allCVDocumentIds = includedCandidates
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
        cc: state.cc.trim() || undefined,
        bcc: state.bcc.trim() || undefined,
        subject: state.subject,
        body: state.body,
        cvDocumentIds: allCVDocumentIds,
        candidateIds: includedCandidates.map((c) => c.id),
      }];
    });

    if (emails.length === 0) {
      toast.error("Aucun destinataire valide configuré");
      return;
    }

    startSending(async () => {
      const { results } = await sendMatchingEmails({ notifyCandidates, emails });
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
        const firstError = results.find((r) => !r.success)?.error;
        toast.error(
          firstError
            ? `${failCount} email${failCount > 1 ? "s" : ""} en échec : ${firstError}`
            : `${failCount} email${failCount > 1 ? "s" : ""} en échec`
        );
      }
      if (failCount === 0) setTimeout(onClose, 800);
    });
  }

  const allSent = selectedNeeds.length > 0 && selectedNeeds.every((n) => perBesoin[n.id]?.result === "success");
  const sendDisabled = loading || isSending || allSent || !modalData || !modalData.hasGmailConnected;

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
              {!modalData.hasGmailConnected && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-amber-900">Gmail n'est pas connecté</p>
                      <p className="text-xs text-amber-800 mt-0.5">
                        Connectez votre compte Gmail avant d'envoyer les CV.
                      </p>
                    </div>
                  </div>
                  <a
                    href="/auth/gmail/connect?next=/matching"
                    className="inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md bg-amber-900 px-2.5 text-xs font-medium text-white transition-colors hover:bg-amber-800"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Connecter
                  </a>
                </div>
              )}

              {/* Template selector */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap w-14 shrink-0">Trame</span>
                  <select
                    className="flex-1 h-8 text-sm rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                    value={selectedTemplateId}
                    onChange={(e) => applyTemplate(e.target.value)}
                  >
                    <option value="">— Saisie libre —</option>
                    {modalData.templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 shrink-0"
                    onClick={() => {
                      setSavingTemplate(true);
                      setNewTemplateName("");
                      setTimeout(() => newTemplateNameRef.current?.focus(), 50);
                    }}
                  >
                    <Save className="h-3 w-3" />
                    Enregistrer
                  </Button>
                </div>

                {savingTemplate && (
                  <div className="flex items-center gap-2 pl-[4.25rem]">
                    <input
                      ref={newTemplateNameRef}
                      type="text"
                      placeholder="Nom de la trame…"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveTemplate();
                        if (e.key === "Escape") setSavingTemplate(false);
                      }}
                      className="flex-1 h-7 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      disabled={!newTemplateName.trim() || isSavingTemplate}
                      onClick={handleSaveTemplate}
                    >
                      {isSavingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sauvegarder"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setSavingTemplate(false)}
                    >
                      Annuler
                    </Button>
                  </div>
                )}
              </div>

              {/* CV attachments (global for all emails) */}
              {selectedCandidates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Pièces jointes — {allCVDocumentIds.length} CV · {includedCandidates.length}/{selectedCandidates.length} candidat{selectedCandidates.length > 1 ? "s" : ""}
                  </p>
                  <div className="rounded-lg border divide-y">
                    {selectedCandidates.map((cand) => {
                      const cv = getEffectiveCV(cand.id);
                      const isUploading = uploadingFor === cand.id;
                      const excluded = excludedCandidateIds.has(cand.id);
                      return (
                        <div key={cand.id} className={cn("flex items-center gap-2.5 px-3 py-2 text-sm", excluded && "opacity-50")}>
                          <input
                            type="checkbox"
                            checked={!excluded}
                            onChange={() => toggleCandidateExclusion(cand.id)}
                            className="h-3.5 w-3.5 rounded border-input accent-primary shrink-0"
                          />
                          {cv ? (
                            <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          )}
                          <span className={cn("flex-1 truncate", !cv && "text-muted-foreground", excluded && "line-through")}>
                            {cand.firstName} {cand.lastName}
                          </span>
                          {cv ? (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{cv.fileName}</span>
                          ) : !excluded ? (
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
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Candidate notification toggle */}
              {selectedCandidates.length > 0 && (() => {
                const withoutEmail = includedCandidates.filter((c) => !c.email);
                return (
                  <div className="rounded-lg border px-3 py-2.5 space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={notifyCandidates}
                        onChange={(e) => setNotifyCandidates(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-input accent-primary shrink-0"
                      />
                      <Bell className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="text-xs font-medium">
                        Notifier les candidats par email
                      </span>
                    </label>
                    {notifyCandidates && withoutEmail.length > 0 && (
                      <p className="text-xs text-amber-600 pl-6">
                        {withoutEmail.length} candidat{withoutEmail.length > 1 ? "s" : ""} sans email ne seront pas notifié{withoutEmail.length > 1 ? "s" : ""} :{" "}
                        {withoutEmail.map((c) => `${c.firstName} ${c.lastName}`).join(", ")}
                      </p>
                    )}
                  </div>
                );
              })()}

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
                      {state.result === "error" && state.error && (
                        <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-md px-2 py-1">
                          {state.error}
                        </p>
                      )}

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

                      {/* CC */}
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-muted-foreground w-14 shrink-0">CC</label>
                        <input
                          type="text"
                          placeholder="adresse@exemple.fr, autre@exemple.fr"
                          className="flex-1 h-7 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                          value={state.cc}
                          onChange={(e) => updateBesoin(need.id, { cc: e.target.value })}
                        />
                      </div>

                      {/* BCC */}
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-muted-foreground w-14 shrink-0">CCI</label>
                        <input
                          type="text"
                          placeholder="adresse@exemple.fr, autre@exemple.fr"
                          className="flex-1 h-7 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                          value={state.bcc}
                          onChange={(e) => updateBesoin(need.id, { bcc: e.target.value })}
                        />
                      </div>

                      {/* Subject */}
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-muted-foreground w-14 shrink-0">Objet</label>
                        <input
                          type="text"
                          className="flex-1 h-7 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                          value={state.subject}
                          onChange={(e) => {
                            updateBesoin(need.id, { subject: e.target.value });
                            setSelectedTemplateId(""); // passe en saisie libre si on édite
                          }}
                        />
                      </div>

                      {/* Body */}
                      <div className="flex gap-3">
                        <label className="text-xs text-muted-foreground w-14 shrink-0 mt-1.5">Message</label>
                        <textarea
                          className="flex-1 text-xs rounded-md border border-input bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[80px]"
                          value={state.body}
                          onChange={(e) => {
                            updateBesoin(need.id, { body: e.target.value });
                            setSelectedTemplateId(""); // passe en saisie libre si on édite
                          }}
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
            disabled={sendDisabled}
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
