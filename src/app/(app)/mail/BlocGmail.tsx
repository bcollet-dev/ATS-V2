"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, FileText, Loader2, Lock, Mail, Paperclip, Send, Upload } from "lucide-react";
import {
  Modal,
  ModalBody,
  ModalClose,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  loadEntityMailData,
  sendEntityMail,
  uploadEntityMailAttachment,
  type EntityMailData,
  type EntityMailDocument,
  type EntityMailKind,
} from "./actions";

type Props = {
  kind: EntityMailKind;
  entityId: string;
  nextPath: string;
  className?: string;
};

const ACCEPTED_ATTACHMENTS =
  ".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function documentLabel(document: EntityMailDocument): string {
  const labels: Record<string, string> = {
    cv: "CV",
    cni: "CNI",
    carte_vitale: "Carte vitale",
    fre: "FRE",
    diplome: "Diplome",
    other: "Document",
  };
  return labels[document.documentType] ?? "Document";
}

export function BlocGmail({ kind, entityId, nextPath, className }: Props) {
  const datalistId = useId();
  const [data, setData] = useState<EntityMailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [isSending, startSending] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadEntityMailData(kind, entityId)
      .then((loaded) => {
        if (cancelled) return;
        setData(loaded);
        const firstTemplate = loaded?.templates[0];
        setSelectedTemplateId(firstTemplate?.id ?? "");
        setTo(loaded?.recipients[0]?.email ?? "");
        setSubject(firstTemplate?.subject ?? loaded?.defaultSubject ?? "");
        setBody(firstTemplate?.body ?? loaded?.defaultBody ?? "");
        setSelectedAttachmentIds(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kind, entityId]);

  const connectHref = `/auth/gmail/connect?next=${encodeURIComponent(nextPath)}`;
  const hasRecipients = (data?.recipients.length ?? 0) > 0;
  const canSend = Boolean(data?.hasGmailConnected && to.trim() && subject.trim() && body.trim() && !isSending);
  const selectedAttachmentCount = selectedAttachmentIds.size;

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = data?.templates.find((item) => item.id === templateId);
    if (!template) return;
    setSubject(template.subject);
    setBody(template.body);
  }

  function handleSend() {
    if (!data) return;
    startSending(async () => {
      const result = await sendEntityMail({
        kind,
        entityId,
        to,
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        subject,
        body,
        attachmentDocumentIds: [...selectedAttachmentIds],
      });

      if (result.success) {
        toast.success("Email envoyé");
        setOpen(false);
        return;
      }

      toast.error(result.error);
    });
  }

  function toggleAttachment(documentId: string) {
    setSelectedAttachmentIds((previous) => {
      const next = new Set(previous);
      if (next.has(documentId)) next.delete(documentId);
      else next.add(documentId);
      return next;
    });
  }

  async function handleAttachmentImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    const result = await uploadEntityMailAttachment(kind, entityId, formData);
    setUploading(false);
    event.target.value = "";

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    setData((previous) => previous
      ? { ...previous, documents: [result.document, ...previous.documents] }
      : previous
    );
    setSelectedAttachmentIds((previous) => new Set(previous).add(result.document.id));
    toast.success("Document importé");
  }

  return (
    <section className={cn("rounded-lg border bg-card h-fit", className)}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b">
        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Messagerie Gmail</h2>
      </div>

      {loading ? (
        <div className="px-5 py-8 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data ? (
        <div className="px-5 py-6 text-center">
          <AlertCircle className="mx-auto h-5 w-5 text-amber-600" />
          <p className="mt-2 text-sm font-medium">Fiche introuvable</p>
        </div>
      ) : !data.hasGmailConnected ? (
        <div className="px-5 py-6 flex flex-col items-center text-center gap-4">
          <div className="rounded-full bg-amber-50 p-3">
            <Lock className="h-5 w-5 text-amber-700" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Gmail à connecter</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Activez Gmail pour envoyer des emails depuis cette fiche.
            </p>
          </div>
          <a href={connectHref} className="w-full">
            <Button variant="outline" size="sm" className="gap-2 w-full">
              <Mail className="h-4 w-4" />
              Connecter Gmail
            </Button>
          </a>
        </div>
      ) : (
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-start gap-2 rounded-md border bg-emerald-50 px-3 py-2 text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium">Gmail connecté</p>
              <p className="text-xs text-emerald-700">
                {hasRecipients
                  ? `${data.recipients.length} destinataire${data.recipients.length > 1 ? "s" : ""} disponible${data.recipients.length > 1 ? "s" : ""}`
                  : "Aucun email enregistré, saisie manuelle possible"}
              </p>
            </div>
          </div>

          <Button size="sm" className="w-full gap-2" onClick={() => setOpen(true)}>
            <Mail className="h-4 w-4" />
            Nouveau mail
          </Button>
        </div>
      )}

      <Modal open={open} onOpenChange={(next) => { if (!isSending) setOpen(next); }}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle>Envoyer un email</ModalTitle>
            <ModalClose />
          </ModalHeader>

          <ModalBody>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor={`${datalistId}-to`}>À</Label>
                <Input
                  id={`${datalistId}-to`}
                  list={`${datalistId}-recipients`}
                  type="email"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="adresse@exemple.fr"
                />
                <datalist id={`${datalistId}-recipients`}>
                  {data?.recipients.map((recipient) => (
                    <option key={recipient.email} value={recipient.email}>
                      {recipient.label}
                    </option>
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${datalistId}-cc`}>CC</Label>
                  <Input
                    id={`${datalistId}-cc`}
                    value={cc}
                    onChange={(event) => setCc(event.target.value)}
                    placeholder="adresse@exemple.fr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${datalistId}-bcc`}>CCI</Label>
                  <Input
                    id={`${datalistId}-bcc`}
                    value={bcc}
                    onChange={(event) => setBcc(event.target.value)}
                    placeholder="adresse@exemple.fr"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${datalistId}-template`}>Trame</Label>
                <select
                  id={`${datalistId}-template`}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={selectedTemplateId}
                  onChange={(event) => applyTemplate(event.target.value)}
                >
                  <option value="">Saisie libre</option>
                  {data?.templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${datalistId}-subject`}>Objet</Label>
                <Input
                  id={`${datalistId}-subject`}
                  value={subject}
                  onChange={(event) => {
                    setSubject(event.target.value);
                    setSelectedTemplateId("");
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${datalistId}-body`}>Message</Label>
                <Textarea
                  id={`${datalistId}-body`}
                  className="min-h-44 resize-y"
                  value={body}
                  onChange={(event) => {
                    setBody(event.target.value);
                    setSelectedTemplateId("");
                  }}
                />
              </div>

              <div className="space-y-2 rounded-lg border px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Pièces jointes</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedAttachmentCount} document{selectedAttachmentCount > 1 ? "s" : ""} sélectionné{selectedAttachmentCount > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 shrink-0"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Importer
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_ATTACHMENTS}
                    className="hidden"
                    onChange={handleAttachmentImport}
                  />
                </div>

                {data?.documents.length ? (
                  <div className="max-h-36 overflow-y-auto rounded-md border divide-y">
                    {data.documents.map((document) => {
                      const checked = selectedAttachmentIds.has(document.id);
                      return (
                        <label
                          key={document.id}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAttachment(document.id)}
                            className="h-3.5 w-3.5 rounded border-input accent-primary shrink-0"
                          />
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1 min-w-0 truncate">{document.fileName}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {documentLabel(document)} · {formatFileSize(document.fileSize)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
                    Aucun document sur cette fiche. Importez un fichier pour le joindre au mail.
                  </p>
                )}
              </div>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSending}>
              Annuler
            </Button>
            <Button disabled={!canSend} onClick={handleSend} className="gap-2">
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isSending ? "Envoi..." : "Envoyer"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </section>
  );
}
