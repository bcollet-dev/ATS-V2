-- Politique INSERT manquante sur le bucket signature-photos
-- Sans elle, l'upload de photo de signature échoue avec une erreur RLS
CREATE POLICY "signature-photos owner insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'signature-photos'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
