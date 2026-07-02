# 08 — Import FRE + extraction LLM

Status: done

## What to build

Permettre l'import d'une FRE retournée par l'entreprise, avec extraction automatique des champs via Claude et confirmation avant sauvegarde.

**Bouton d'import :** Dans `BlocFre` (sidebar, tranche 04), ajouter un bouton "Importer une FRE signée" qui ouvre un file picker acceptant `.docx` et `.pdf`.

**Server action `importFre(needId, file: File)` :**
1. Upload du fichier vers Supabase Storage : `fre/{needId}/{timestamp}-imported.{ext}`
2. Crée une entrée `documents` avec `documentType = "fre"`, `needId`, `storagePath`, `extractionStatus = "pending"`
3. Extrait le texte brut du fichier : `.docx` via `mammoth` (déjà installé), `.pdf` via `pdf-parse` (déjà installé)
4. Envoie le texte à `claude-haiku-4-5` avec un prompt structuré listant exactement les champs à extraire et leur format attendu (champs besoin : `masterFirstName`, `masterLastName`, `masterBirthDate`, `masterJobTitle`, `masterPhone`, `masterEmail`, `weeklyHours`, `contractType`, `salaryReference`, `smcAmount`, `overtimeHandling`, `benefitFood`, `benefitHousing`, `benefitOther` ; champs entreprise : `opco`, `idcc`, `collectiveAgreement`, `retirementFund`, `providentFund`, `legalRepFirstName`, `legalRepLastName`)
5. Met à jour `documents.extractedData` avec le JSON retourné et `extractionStatus = "done"`
6. Retourne les champs extraits au client
7. Logue `fre_imported` dans `activityEvents`

**FreImportConfirmModal :** Composant client affiché après extraction. Présente les champs extraits dans un formulaire éditable (groupés par section : Maître d'apprentissage, Contrat, Avantages, Entreprise). Chaque champ pré-rempli avec la valeur extraite et modifiable. Bouton "Appliquer" déclenche `applyFreExtraction`.

**Server action `applyFreExtraction(documentId, confirmedFields)` :**
- Met à jour `needs` avec les champs besoin confirmés
- Met à jour `companies` avec les champs entreprise confirmés
- Logue `fre_fields_applied` dans `activityEvents` avec un summary listant les champs modifiés

## Acceptance criteria

- [ ] Le bouton "Importer une FRE signée" s'affiche dans `BlocFre`
- [ ] L'upload d'un `.docx` ou `.pdf` crée une entrée `documents` en base avec `extractionStatus = "pending"` puis `"done"`
- [ ] Le fichier est bien uploadé dans Supabase Storage sous `fre/{needId}/`
- [ ] La modale de confirmation affiche les champs extraits pré-remplis et éditables
- [ ] Cliquer "Appliquer" met à jour les champs `needs` et `companies` en base
- [ ] Les événements `fre_imported` et `fre_fields_applied` sont loggés dans `activity_events`
- [ ] La FRE importée apparaît dans la liste des versions dans `BlocFre`
- [ ] `npx tsc --noEmit` passe sans nouvelles erreurs

## Blocked by

- `.scratch/fiche-besoin/issues/04-sidebar-entreprise-fre.md`
