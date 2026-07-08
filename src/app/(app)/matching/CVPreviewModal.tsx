"use client";

import { useState, useEffect } from "react";
import { Loader2, Download } from "lucide-react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalClose } from "@/components/ui/modal";
import { getCVPreviewUrl } from "./actions";

export function CVPreviewModal({
  open,
  candidateId,
  candidateName,
  onClose,
}: {
  open: boolean;
  candidateId: string;
  candidateName: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setUrl(null); return; }
    setLoading(true);
    getCVPreviewUrl(candidateId)
      .then((res) => {
        if (res) { setUrl(res.url); setFileName(res.fileName); }
        else setUrl(null);
      })
      .finally(() => setLoading(false));
  }, [open, candidateId]);

  return (
    <Modal open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <ModalContent className="max-w-3xl h-[85vh]">
        <ModalHeader>
          <div className="min-w-0">
            <ModalTitle>{candidateName}</ModalTitle>
            {fileName && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{fileName}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {url && (
              <a
                href={url}
                download={fileName || "cv.pdf"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-accent"
              >
                <Download className="h-3.5 w-3.5" />
                Télécharger
              </a>
            )}
            <ModalClose />
          </div>
        </ModalHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : url ? (
            <iframe
              src={url}
              className="h-full w-full border-0"
              title={`CV — ${candidateName}`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Impossible de charger le CV
            </div>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}
