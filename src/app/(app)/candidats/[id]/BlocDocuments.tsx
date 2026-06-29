"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, Upload, RefreshCw, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadCandidateCV, type CVDocument } from "./actions";

const ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function BlocDocuments({
  candidateId,
  initialCV,
}: {
  candidateId: string;
  initialCV: CVDocument | null;
}) {
  const router = useRouter();
  const [cv, setCV] = useState<CVDocument | null>(initialCV);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const fd = new FormData();
    fd.append("file", file);

    startTransition(async () => {
      const result = await uploadCandidateCV(candidateId, fd);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("CV enregistré");
      router.refresh();
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <section className="rounded-lg border bg-card overflow-hidden">
      <div className="px-5 py-3.5 border-b flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Documents</h2>
      </div>

      <div className="p-5 space-y-4">
        {/* CV section */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Curriculum Vitae</p>

          {cv ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{cv.fileName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uploadé le {formatDate(cv.createdAt)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                disabled={isPending}
                onClick={() => inputRef.current?.click()}
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Remplacer
              </Button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !isPending && inputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-8 rounded-lg border-2 border-dashed",
                "cursor-pointer transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30",
                isPending && "pointer-events-none opacity-60"
              )}
            >
              {isPending ? (
                <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isPending ? "Upload en cours…" : "Déposer le CV ici"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PDF, DOC ou DOCX · max 10 Mo
                </p>
              </div>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>
    </section>
  );
}
