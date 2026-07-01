"use client";

import { useState, useRef, useTransition } from "react";
import { Loader2, Save, Upload, X, Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { renderSignatureHtml } from "@/lib/signature";
import { saveSignatureData, type SignatureData } from "./actions";

type Props = {
  userId: string;
  userName: string;
  initialSigData: SignatureData;
  hasGmailConnected: boolean;
};

function buildPreviewDoc(html: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
  <style>body{margin:20px;background:#fff;font-family:Arial,sans-serif;}img{max-width:100%;}</style>
</head>
<body>${html}</body>
</html>`;
}

export function ParametrageTab({ userId, userName, initialSigData, hasGmailConnected }: Props) {
  const [photoUrl,     setPhotoUrl]     = useState(initialSigData.photoUrl     ?? "");
  const [jobTitle,     setJobTitle]     = useState(initialSigData.jobTitle     ?? "");
  const [entity,       setEntity]       = useState(initialSigData.entity       ?? "");
  const [phone,        setPhone]        = useState(initialSigData.phone        ?? "");
  const [linkedinUrl,  setLinkedinUrl]  = useState(initialSigData.linkedinUrl  ?? "");
  const [instagramUrl, setInstagramUrl] = useState(initialSigData.instagramUrl ?? "");

  const [uploading, setUploading]    = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef                 = useRef<HTMLInputElement>(null);

  const previewHtml = renderSignatureHtml({
    fullName:     userName,
    photoUrl:     photoUrl     || null,
    jobTitle:     jobTitle     || null,
    entity:       entity       || null,
    phone:        phone        || null,
    linkedinUrl:  linkedinUrl  || null,
    instagramUrl: instagramUrl || null,
  });

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 2 Mo");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/photo.${ext}`;
    setUploading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("signature-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("signature-photos").getPublicUrl(path);
      setPhotoUrl(`${publicUrl}?t=${Date.now()}`);
      toast.success("Photo uploadée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveSignatureData({
        photoUrl:     photoUrl     || null,
        jobTitle:     jobTitle     || null,
        entity:       entity       || null,
        phone:        phone        || null,
        linkedinUrl:  linkedinUrl  || null,
        instagramUrl: instagramUrl || null,
      });
      if (!result.success) {
        toast.error(result.error ?? "Erreur lors de l'enregistrement");
        return;
      }
      toast.success("Signature enregistrée");
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* ── Connexion Gmail ─────────────────────────────────────── */}
      <div className="rounded-lg border p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">Compte Gmail pour l'envoi</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasGmailConnected
                ? "Votre compte Gmail est connecté — les emails sont envoyés en votre nom."
                : "Connectez votre Gmail pour activer l'envoi de CVs et les notifications candidats."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {hasGmailConnected ? (
            <>
              <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Connecté
              </span>
              <a
                href="/auth/gmail/connect"
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Reconnecter
              </a>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Non connecté
              </span>
              <a
                href="/auth/gmail/connect"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Connecter Gmail
              </a>
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold">Signature email</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Remplissez vos informations — la signature est générée automatiquement et ajoutée à vos emails.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* ── Formulaire ────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Photo */}
          <div className="space-y-1.5">
            <Label>Photo</Label>
            <div className="flex items-center gap-3">
              {photoUrl ? (
                <div className="relative shrink-0">
                  <img
                    src={photoUrl}
                    alt="Photo de profil"
                    className="w-14 h-14 rounded-full object-cover border"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotoUrl("")}
                    className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground p-0.5"
                    aria-label="Supprimer la photo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  <Upload className="h-5 w-5" />
                </div>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={handlePhotoUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-1.5"
                >
                  {uploading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Upload className="h-3.5 w-3.5" />
                  }
                  {photoUrl ? "Changer la photo" : "Ajouter une photo"}
                </Button>
                <p className="text-[11px] text-muted-foreground mt-1">JPG, PNG ou WebP · max 2 Mo</p>
              </div>
            </div>
          </div>

          {/* Nom complet (readonly) */}
          <div className="space-y-1.5">
            <Label>Nom complet</Label>
            <input
              type="text"
              value={userName}
              readOnly
              className="w-full h-8 rounded-md border border-input bg-muted px-2.5 text-sm text-muted-foreground cursor-default"
            />
            <p className="text-[11px] text-muted-foreground">Modifiable dans les paramètres de profil</p>
          </div>

          {/* Poste */}
          <div className="space-y-1.5">
            <Label htmlFor="sig-job">Poste / Titre</Label>
            <input
              id="sig-job"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Ex : Chargée de recrutement"
              className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Entité */}
          <div className="space-y-1.5">
            <Label htmlFor="sig-entity">Entité / Campus</Label>
            <input
              id="sig-entity"
              type="text"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              placeholder="Ex : EDA Groupe — Campus Lyon"
              className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Téléphone */}
          <div className="space-y-1.5">
            <Label htmlFor="sig-phone">Téléphone</Label>
            <input
              id="sig-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex : 06 12 34 56 78"
              className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* LinkedIn */}
          <div className="space-y-1.5">
            <Label htmlFor="sig-linkedin">LinkedIn (URL complète)</Label>
            <input
              id="sig-linkedin"
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/votre-profil"
              className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          {/* Instagram */}
          <div className="space-y-1.5">
            <Label htmlFor="sig-instagram">Instagram (URL complète)</Label>
            <input
              id="sig-instagram"
              type="url"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/votre-compte"
              className="w-full h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          <Button onClick={handleSave} disabled={isPending} className="gap-1.5">
            {isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />
            }
            Enregistrer la signature
          </Button>
        </div>

        {/* ── Aperçu ────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label>Aperçu en temps réel</Label>
          <div className="rounded-md border bg-white" style={{ minHeight: 220, overflowX: "auto" }}>
            <iframe
              srcDoc={buildPreviewDoc(previewHtml)}
              title="Aperçu de la signature"
              className="w-full border-0"
              style={{ minHeight: 220, height: 340 }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Photo ronde dans Gmail/Apple Mail · carrée dans Outlook (comportement normal)
          </p>
        </div>
      </div>
    </div>
  );
}
