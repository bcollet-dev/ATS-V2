"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Webhook, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateGlobalSlackWebhook, testGlobalSlackWebhook } from "./actions";

export function NotificationsClient({ initialWebhookUrl }: { initialWebhookUrl: string | null }) {
  const [url, setUrl] = useState(initialWebhookUrl ?? "");
  const [saved, setSaved] = useState(initialWebhookUrl ?? "");
  const [isSaving, startSave] = useTransition();
  const [isTesting, startTest] = useTransition();

  const isDirty = url.trim() !== saved;

  function handleSave() {
    startSave(async () => {
      const result = await updateGlobalSlackWebhook(url);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setSaved(url.trim());
      toast.success("Webhook global enregistré");
    });
  }

  function handleTest() {
    startTest(async () => {
      const result = await testGlobalSlackWebhook();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Message de test envoyé dans Slack");
    });
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Notifications Slack</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Canal global pour les événements entretien, rupture et abandon.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="global-webhook" className="flex items-center gap-1.5">
            <Webhook className="h-3.5 w-3.5" />
            Webhook Slack — canal global
          </Label>
          <p className="text-xs text-muted-foreground">
            Utilisé pour : Entretien entreprise · Rupture · Abandon
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            id="global-webhook"
            type="url"
            placeholder="https://hooks.slack.com/services/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauvegarder"}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || !saved || isDirty}
            title="Envoyer un message de test"
          >
            {isTesting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <><SendHorizonal className="h-4 w-4 mr-1.5" />Tester</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
