# 04 — Sidebar entreprise + Génération FRE

Status: done

## What to build

Remplir la sidebar de la fiche besoin avec deux blocs : un résumé de l'entreprise (avec avertissement FRE) et la génération/gestion des FRE.

---

### Bloc résumé entreprise

Carte en haut de la sidebar affichant : nom de l'entreprise, SIRET, adresse, OPCO (`companies.opco`), convention collective (`companies.collectiveAgreement`). Un lien "Voir la fiche entreprise" pointe vers l'annuaire.

**Avertissement champs manquants :** Si des champs nécessaires à la FRE sont absents (`opco`, `idcc`, `collectiveAgreement`, `retirementFund`, `providentFund`, `legalRepFirstName`, `legalRepLastName`), un banner listant les champs manquants s'affiche avec le lien vers la fiche entreprise. La génération FRE n'est pas bloquée par ces champs manquants — elle procède avec les données disponibles.

---

### Bloc FRE (génération et versioning)

**Installation :** `docxtemplater` + `pizzip` ajoutés aux dépendances.

**Template :** Un fichier `public/templates/fre-template.docx` avec des balises `{{field}}` correspondant aux champs de la FRE EDA (coordonnées alternant, employeur, contrat, formation, maître d'apprentissage, rémunération, avantages). Le template est créé/converti à partir du modèle FRE existant dans le repo.

**Server action `generateFre(needId)` :**
1. Charge les données besoin + entreprise + cursus depuis la base
2. Construit le dictionnaire de substitution (champs disponibles, vides pour les manquants)
3. Génère le `.docx` via `docxtemplater`
4. Upload vers Supabase Storage : `fre/{needId}/{timestamp}-generated.docx`
5. Crée une entrée `documents` (`documentType = "fre"`, `needId`, `storagePath`)
6. Retourne l'URL signée pour téléchargement immédiat
7. Logue `fre_generated` dans `activityEvents`

**BlocFre :** Composant client dans la sidebar. Si aucune FRE n'existe, affiche un bouton "Générer la FRE". Si une FRE existe, affiche la version la plus récente (date, type "générée") avec un bouton "Télécharger" et un bouton "Nouvelle version". Une section "Versions précédentes" repliable liste les FRE plus anciennes avec date et type (générée/importée). L'import sera ajouté dans la tranche 08.

## Acceptance criteria

- [ ] La sidebar affiche le résumé entreprise (nom, SIRET, adresse, OPCO, convention)
- [ ] Le banner d'avertissement liste les champs FRE manquants si applicable, avec lien vers l'annuaire
- [ ] Le bouton "Générer la FRE" déclenche la génération et propose le téléchargement du `.docx`
- [ ] Le `.docx` généré est bien uploadé dans Supabase Storage sous `fre/{needId}/`
- [ ] Une entrée `documents` avec `documentType = "fre"` est créée en base
- [ ] Un événement `fre_generated` est loggé dans `activity_events`
- [ ] Les versions précédentes s'affichent dans la section repliable
- [ ] La génération fonctionne même si certains champs entreprise sont manquants (champs vides dans le docx)
- [ ] `npx tsc --noEmit` passe sans nouvelles erreurs

## Blocked by

- `.scratch/fiche-besoin/issues/01-migrations-schema.md`
- `.scratch/fiche-besoin/issues/02-layout-cerfa-drawer.md`
