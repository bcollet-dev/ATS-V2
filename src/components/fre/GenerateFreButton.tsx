"use client";

import { useTransition, type ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { generateFre } from "@/app/(app)/besoins/[id]/fre-actions";

type GeneratedFreDocument = {
  id: string;
  fileName: string;
  extractionStatus: string | null;
  createdAt: string;
  kind: "generated";
};

type GenerateFreButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "onClick" | "disabled"
> & {
  needId: string;
  candidateId?: string;
  label?: string;
  disabled?: boolean;
  onGenerated?: (document: GeneratedFreDocument) => void;
};

export function GenerateFreButton({
  needId,
  candidateId,
  label = "Générer FRE",
  disabled,
  onGenerated,
  onPointerDown,
  ...buttonProps
}: GenerateFreButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleGenerate(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const targetTab = window.open("", "_blank", "noopener,noreferrer");
    startTransition(async () => {
      const result = await generateFre(needId, candidateId ? { candidateId } : {});
      if (!result.success) {
        targetTab?.close();
        toast.error(result.error);
        return;
      }

      if (targetTab) {
        targetTab.location.href = result.signedUrl;
      } else {
        window.open(result.signedUrl, "_blank", "noopener,noreferrer");
      }
      onGenerated?.({
        id: result.documentId,
        fileName: result.fileName,
        extractionStatus: null,
        createdAt: result.createdAt,
        kind: "generated",
      });
      toast.success("FRE générée et ouverte");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      onClick={handleGenerate}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown?.(event);
      }}
      disabled={disabled || isPending}
      {...buttonProps}
    >
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
