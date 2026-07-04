"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Paperclip, Upload, Trash2, FileText, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  uploadCompanyDocument, deleteCompanyDocument, getSignedDocumentUrl,
  type CompanyDocument,
} from "./document-actions";

const ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function BlocDocuments({
  companyId,
  initialDocuments,
  canEdit,
}: {
  companyId: string;
  initialDocuments: CompanyDocument[];
  canEdit: boolean;
}) {
  const [docs, setDocs] = useState<CompanyDocument[]>(initialDocuments);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, startUpload] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const fd = new FormData();
    fd.append("file", files[0]);
    startUpload(async () => {
      const result = await uploadCompanyDocument(companyId, fd);
      if (!result.success) { toast.error(result.error); return; }
      setDocs((prev) => [...prev, result.document]);
      toast.success("Document ajouté");
    });
  }

  async function handleDownload(doc: CompanyDocument) {
    const url = await getSignedDocumentUrl(doc.id);
    if (!url) { toast.error("Impossible de générer le lien de téléchargement"); return; }
    const a = document.createElement("a");
    a.href = url;
    a.download = doc.fileName;
    a.target = "_blank";
    a.click();
  }

  async function handleDelete(doc: CompanyDocument) {
    setDeletingId(doc.id);
    const result = await deleteCompanyDocument(doc.id, companyId);
    setDeletingId(null);
    if (!result.success) { toast.error(result.error); return; }
    setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    toast.success("Document supprimé");
  }

  return (
    <section className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Documents</h2>
        {docs.length > 0 && (
          <span className="ml-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {docs.length}
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Liste */}
        {docs.length > 0 && (
          <ul className="space-y-2">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20">
                <FileText className="h-7 w-7 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{doc.fileName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatSize(doc.fileSize)} · {formatDate(doc.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                    title="Télécharger"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={deletingId === doc.id}
                      className="p-1 text-muted-foreground hover:text-red-600 rounded transition-colors"
                      title="Supprimer"
                    >
                      {deletingId === doc.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />
                      }
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Zone d'upload */}
        {canEdit && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => !isUploading && inputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 p-5 rounded-lg border-2 border-dashed",
                "cursor-pointer transition-colors text-center",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30",
                isUploading && "pointer-events-none opacity-60"
              )}
            >
              {isUploading
                ? <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                : <Upload className="h-5 w-5 text-muted-foreground" />
              }
              <p className="text-xs text-muted-foreground">
                {isUploading ? "Upload en cours…" : "Déposer un fichier"}
              </p>
              <p className="text-[11px] text-muted-foreground/70">PDF, DOC, DOCX, JPG, PNG · max 20 Mo</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </>
        )}

        {!canEdit && docs.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Aucun document</p>
        )}
      </div>
    </section>
  );
}
