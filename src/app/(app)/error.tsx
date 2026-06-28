"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logError } from "./erreurs/actions";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    logError({
      message: error.message || "Unknown error",
      stack: error.stack,
      digest: error.digest,
      page: pathname,
    });
  }, [error, pathname]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h1 className="text-lg font-semibold mb-1">Une erreur est survenue</h1>
      <p className="text-sm text-muted-foreground mb-1 max-w-sm">
        {error.message || "Erreur inattendue. Elle a été automatiquement enregistrée."}
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground/60 font-mono mb-6">
          {error.digest}
        </p>
      )}
      <Button onClick={reset} size="sm">
        Réessayer
      </Button>
    </div>
  );
}
