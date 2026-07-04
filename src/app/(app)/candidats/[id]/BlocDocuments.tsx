"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Paperclip, FileText, Loader2, Trash2, Plus, CheckCircle,
  RotateCcw, ExternalLink, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExtractionReviewSheet } from "./ExtractionReviewSheet";
import {
  uploadCandidateDocument,
  deleteCandidateDocument,
  retryDocumentExtraction,
  getDocumentExtraction,
  getSignedCandidateDocumentUrl,
  type DocType,
  type CandidateDoc,
  type CandidateDocs,
} from "./document-actions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const ACCEPT: Record<DocType, string> = {
  cv: ".pdf,.doc,.docx",
  cni: ".pdf,.jpg,.jpeg,.png",
  carte_vitale: ".pdf,.jpg,.jpeg,.png",
  diplome: ".pdf,.doc,.docx",
  other: ".pdf,.doc,.docx,.jpg,.jpeg,.png",
};

type ReviewState = {
  documentId: string;
  documentType: string;
  extractedData: Record<string, unknown>;
};

// ─── Extraction badge ──────────────────────────────────────────────────────────

function ExtractionBadge({
  doc,
  onView,
  onRetry,
  isRetrying,
}: {
  doc: CandidateDoc;
  onView: () => void;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  if (doc.documentType === "other" || !doc.extractionStatus) return null;

  if (doc.extractionStatus === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Extraction…
      </span>
    );
  }
  if (doc.extractionStatus === "done") {
    return (
      <button
        type="button"
        onClick={onView}
        className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:text-emerald-700 font-medium"
      >
        <CheckCircle className="h-2.5 w-2.5" />
        Voir données
      </button>
    );
  }
  if (doc.extractionStatus === "failed") {
    return (
      <button
        type="button"
        onClick={onRetry}
        disabled={isRetrying}
        className="inline-flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 font-medium disabled:opacity-50"
      >
        {isRetrying ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RotateCcw className="h-2.5 w-2.5" />}
        Réessayer
      </button>
    );
  }
  return null;
}

// ─── File row (compact) ────────────────────────────────────────────────────────

function DocRow({
  doc,
  isUpsert,
  onReplace,
  onDelete,
  onView,
  onRetry,
  isRetrying,
  isReplacing,
}: {
  doc: CandidateDoc;
  isUpsert: boolean;
  onReplace?: () => void;
  onDelete?: () => void;
  onView: () => void;
  onRetry: () => void;
  isRetrying: boolean;
  isReplacing: boolean;
}) {
  async function handleOpen() {
    const url = await getSignedCandidateDocumentUrl(doc.id);
    if (url) window.open(url, "_blank");
    else toast.error("Impossible d'ouvrir le document");
  }

  return (
    <div className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-muted/40 group">
      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate leading-tight">{doc.fileName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground">{formatSize(doc.fileSize)}</span>
          <ExtractionBadge doc={doc} onView={onView} onRetry={onRetry} isRetrying={isRetrying} />
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          type="button"
          onClick={handleOpen}
          className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
          title="Ouvrir"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
        {isUpsert ? (
          <button
            type="button"
            onClick={onReplace}
            disabled={isReplacing}
            className="px-1.5 py-0.5 rounded text-[11px] font-medium hover:bg-background text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {isReplacing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Remplacer"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded hover:bg-background text-muted-foreground hover:text-destructive transition-colors"
            title="Supprimer"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Mini drop zone ────────────────────────────────────────────────────────────

function MiniDrop({
  isPending,
  onClick,
  onDrop,
}: {
  isPending: boolean;
  onClick: () => void;
  onDrop: (files: FileList) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length) onDrop(e.dataTransfer.files); }}
      onClick={() => !isPending && onClick()}
      className={cn(
        "flex items-center justify-center gap-1.5 py-2 rounded-md border border-dashed cursor-pointer transition-colors text-xs text-muted-foreground",
        isDragging ? "border-primary bg-primary/5 text-primary" : "border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/30",
        isPending && "pointer-events-none opacity-60"
      )}
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Upload className="h-3 w-3" />
      )}
      {isPending ? "Upload en cours…" : "Déposer ou cliquer"}
    </div>
  );
}

// ─── Section config ────────────────────────────────────────────────────────────

type SectionType = { type: DocType; title: string; isUpsert: boolean };

const SECTIONS: SectionType[] = [
  { type: "cv",          title: "CV",          isUpsert: true  },
  { type: "cni",         title: "CNI",         isUpsert: true  },
  { type: "carte_vitale",title: "Carte Vitale",isUpsert: true  },
  { type: "diplome",     title: "Diplômes",    isUpsert: false },
  { type: "other",       title: "Autres",      isUpsert: false },
];

function docKey(type: DocType): keyof CandidateDocs {
  if (type === "carte_vitale") return "carteVitale";
  if (type === "diplome") return "diplomes";
  if (type === "other") return "other";
  return type as keyof CandidateDocs;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export function BlocDocuments({
  candidateId,
  initialDocuments,
}: {
  candidateId: string;
  initialDocuments: CandidateDocs;
}) {
  const router = useRouter();
  const [docs, setDocs] = useState<CandidateDocs>(initialDocuments);
  const [uploadingType, setUploadingType] = useState<DocType | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [, startTransition] = useTransition();
  const fileInputRefs = useRef<Partial<Record<DocType, HTMLInputElement | null>>>({});

  function updateDocs(type: DocType, doc: CandidateDoc | null, action: "upsert" | "add" | "remove") {
    setDocs((prev) => {
      if (type === "cv" || type === "cni" || type === "carte_vitale") {
        return { ...prev, [docKey(type)]: doc };
      }
      const list = prev[docKey(type)] as CandidateDoc[];
      if (action === "add" && doc) return { ...prev, [docKey(type)]: [doc, ...list] };
      if (action === "remove" && doc) return { ...prev, [docKey(type)]: list.filter((d) => d.id !== doc.id) };
      return prev;
    });
  }

  function handleUpload(type: DocType, files: FileList | null) {
    if (!files?.length) return;
    setUploadingType(type);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", files[0]);
      const result = await uploadCandidateDocument(candidateId, type, fd);
      setUploadingType(null);
      if (!result.success) { toast.error(result.error); return; }
      updateDocs(type, result.doc, ["cv", "cni", "carte_vitale"].includes(type) ? "upsert" : "add");
      if (result.extractedData) {
        setReview({ documentId: result.documentId, documentType: type, extractedData: result.extractedData });
      } else if (type === "other") {
        toast.success("Document enregistré");
      } else {
        toast.error("Extraction échouée — réessayez depuis la fiche");
      }
    });
  }

  function handleDelete(doc: CandidateDoc) {
    startTransition(async () => {
      const result = await deleteCandidateDocument(doc.id, candidateId);
      if (!result.success) { toast.error(result.error); return; }
      updateDocs(doc.documentType as DocType, doc, "remove");
      toast.success("Document supprimé");
    });
  }

  function handleRetry(doc: CandidateDoc) {
    setRetryingId(doc.id);
    startTransition(async () => {
      const result = await retryDocumentExtraction(doc.id, candidateId);
      setRetryingId(null);
      if (!result.success || !result.extractedData) { toast.error("Extraction échouée"); return; }
      setReview({ documentId: doc.id, documentType: doc.documentType, extractedData: result.extractedData });
    });
  }

  async function handleView(doc: CandidateDoc) {
    const data = await getDocumentExtraction(doc.id);
    if (!data) { toast.error("Données non disponibles"); return; }
    setReview({ documentId: doc.id, documentType: doc.documentType, extractedData: data });
  }

  return (
    <>
      <section className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Documents</h2>
        </div>

        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
          {SECTIONS.map((section, idx) => {
            const isUploading = uploadingType === section.type;
            const isLastOdd = idx === SECTIONS.length - 1 && SECTIONS.length % 2 !== 0;

            if (section.isUpsert) {
              const doc = docs[docKey(section.type)] as CandidateDoc | null;
              return (
                <div key={section.type} className={cn("bg-card px-4 py-2.5 space-y-1.5", isLastOdd && "col-span-2")}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">{section.title}</span>
                    {doc && (
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[section.type]?.click()}
                        disabled={isUploading}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                      >
                        Remplacer
                      </button>
                    )}
                  </div>
                  {doc ? (
                    <DocRow
                      doc={doc}
                      isUpsert
                      onReplace={() => fileInputRefs.current[section.type]?.click()}
                      onView={() => handleView(doc)}
                      onRetry={() => handleRetry(doc)}
                      isRetrying={retryingId === doc.id}
                      isReplacing={isUploading}
                    />
                  ) : (
                    <MiniDrop
                      isPending={isUploading}
                      onClick={() => fileInputRefs.current[section.type]?.click()}
                      onDrop={(files) => handleUpload(section.type, files)}
                    />
                  )}
                  <input
                    ref={(el) => { fileInputRefs.current[section.type] = el; }}
                    type="file"
                    accept={ACCEPT[section.type]}
                    className="hidden"
                    onChange={(e) => handleUpload(section.type, e.target.files)}
                    onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
                  />
                </div>
              );
            } else {
              const docList = docs[docKey(section.type)] as CandidateDoc[];
              return (
                <div key={section.type} className={cn("bg-card px-4 py-2.5 space-y-1.5", isLastOdd && "col-span-2")}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      {section.title}
                      {docList.length > 0 && (
                        <span className="ml-1 font-normal text-muted-foreground/70">({docList.length})</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRefs.current[section.type]?.click()}
                      disabled={isUploading}
                      className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      {isUploading ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : (
                        <Plus className="h-2.5 w-2.5" />
                      )}
                      Ajouter
                    </button>
                  </div>
                  <div className="space-y-1">
                    {docList.map((doc) => (
                      <DocRow
                        key={doc.id}
                        doc={doc}
                        isUpsert={false}
                        onDelete={() => handleDelete(doc)}
                        onView={() => handleView(doc)}
                        onRetry={() => handleRetry(doc)}
                        isRetrying={retryingId === doc.id}
                        isReplacing={false}
                      />
                    ))}
                  </div>
                  {docList.length === 0 && !isUploading && (
                    <MiniDrop
                      isPending={false}
                      onClick={() => fileInputRefs.current[section.type]?.click()}
                      onDrop={(files) => handleUpload(section.type, files)}
                    />
                  )}
                  {isUploading && (
                    <div className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />Upload en cours…
                    </div>
                  )}
                  <input
                    ref={(el) => { fileInputRefs.current[section.type] = el; }}
                    type="file"
                    accept={ACCEPT[section.type]}
                    className="hidden"
                    onChange={(e) => handleUpload(section.type, e.target.files)}
                    onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
                  />
                </div>
              );
            }
          })}
        </div>
      </section>

      {review && (
        <ExtractionReviewSheet
          documentId={review.documentId}
          documentType={review.documentType}
          extractedData={review.extractedData}
          candidateId={candidateId}
          open={true}
          onOpenChange={(open) => { if (!open) setReview(null); }}
          onApplied={() => { setReview(null); router.refresh(); }}
        />
      )}
    </>
  );
}
