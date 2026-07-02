# PRD — Fiche Besoin

Status: ready-for-agent

## Problem Statement

Les recruteurs EDA n'ont pas de vue complète sur un besoin depuis l'ATS. La fiche `/besoins/[id]` existante affiche uniquement le titre, le statut et les candidats proposés. Les informations contractuelles (données CERFA FA13), les cursus cibles, les tâches associées et l'historique d'activité sont absents. Conséquence : les recruteurs saisissent les données contrat hors de l'ATS, la FRE est générée manuellement dans Word, les informations retournées par les entreprises ne sont pas intégrées, et il n'existe aucune traçabilité des actions sur un besoin.

## Solution

Enrichir la fiche besoin en une page de référence complète, structurée en colonne principale + sidebar :

- **Colonne principale** : champs CERFA FA13 éditables via drawer, cursus cibles en sélection multiple, bloc candidats proposés (existant), tâches, historique d'activité
- **Sidebar** : résumé de l'entreprise avec lien vers l'annuaire (avertissement si champs FRE manquants), génération de la FRE en `.docx` pré-rempli, import de la FRE retournée par l'entreprise avec extraction LLM et confirmation avant sauvegarde

## User Stories

1. En tant que recruteur, je veux voir toutes les informations contractuelles d'un besoin sur une seule page, afin de ne pas avoir à chercher dans des fichiers externes.
2. En tant que recruteur, je veux éditer les champs CERFA FA13 d'un besoin via un drawer structuré, afin de saisir les données du contrat de manière guidée.
3. En tant que recruteur, je veux sélectionner plusieurs cursus cibles pour un besoin (multi-choix à plat), afin de cibler des candidats issus de différentes formations.
4. En tant que recruteur, je veux voir la liste des tâches liées à un besoin et en créer de nouvelles, afin de suivre les actions à mener.
5. En tant que recruteur, je veux voir l'historique complet des événements sur un besoin (changements de statut, propositions, tâches, FRE), afin d'avoir une traçabilité complète.
6. En tant que recruteur, je veux générer la FRE en un clic sous forme de `.docx` pré-rempli avec les données disponibles, afin de l'envoyer rapidement à l'entreprise.
7. En tant que recruteur, je veux que la FRE générée soit stockée dans Supabase Storage et visible dans la sidebar, afin de garder un historique des versions envoyées.
8. En tant que recruteur, je veux importer la FRE retournée par l'entreprise, afin que les champs remplis par l'entreprise soient extraits automatiquement.
9. En tant que recruteur, je veux confirmer les données extraites de la FRE importée avant qu'elles soient sauvegardées, afin d'éviter toute erreur de saisie automatique.
10. En tant que recruteur, je veux voir un avertissement si des champs entreprise nécessaires à la FRE sont manquants, avec un lien vers la fiche entreprise, afin de savoir quoi compléter.
11. En tant que recruteur, je veux voir toutes les versions de la FRE (générées et importées) dans la sidebar, la plus récente mise en avant et les anciennes archivées, afin de suivre les allers-retours avec l'entreprise.
12. En tant que recruteur, je veux renseigner le maître d'apprentissage (prénom, nom, date de naissance, fonction, téléphone, email) sur la fiche besoin, afin d'avoir cette information disponible pour la FRE et le CERFA.
13. En tant que recruteur, je veux renseigner la durée hebdomadaire de travail, le type de contrat, la référence de salaire (SMIC/SMC), les avantages en nature et la gestion des heures supplémentaires, afin de pré-remplir ces champs dans la FRE.
14. En tant que recruteur, je veux voir le résumé de l'entreprise (nom, SIRET, adresse, OPCO, convention collective) directement dans la sidebar de la fiche besoin, afin d'avoir le contexte employeur sans naviguer vers l'annuaire.
15. En tant que recruteur, je veux que chaque action sur le besoin (modification de champ, génération FRE, import FRE, ajout/retrait de candidat, changement de statut de proposition, tâche créée/complétée) soit enregistrée dans l'historique avec la date et l'auteur.
16. En tant que direction, je veux consulter la fiche besoin en lecture seule avec le même niveau de détail que les recruteurs, afin d'avoir une vision complète sans risque de modification accidentelle.

## Implementation Decisions

### Layout
Page en deux colonnes : colonne principale (≈2/3) + sidebar (≈1/3). En-tête existant conservé (titre, entreprise, statut badge, méta). Toutes les sections sont des Server Components sauf les blocs interactifs (drawer édition, upload FRE, BlocPropositions, BlocTaches).

### Schema — `needs` : nouveaux champs
Champs CERFA FA13 propres au poste (invariants quel que soit le candidat retenu) :

```
-- Maître d'apprentissage
masterFirstName      text
masterLastName       text
masterBirthDate      date
masterJobTitle       text
masterPhone          text
masterEmail          text

-- Contrat
weeklyHours          text         -- ex. "35" (en heures)
contractType         text         -- "apprentissage" | "professionnalisation" | "cdi" | "cdd"
salaryReference      text         -- "SMIC" | "SMC"
smcAmount            text         -- montant brut mensuel si SMC
overtimeHandling     text         -- "payées" | "récupérées"
endDate              date         -- date de fin du contrat

-- Avantages en nature
benefitFood          text         -- €/repas
benefitHousing       text         -- €/mois
benefitOther         text
```

Migration Drizzle + migration SQL Supabase associée.

### Schema — `need_cursus` : nouvelle table de jointure
Remplace la relation `needs.targetCursusId` (one-to-one) par une relation many-to-many sans ordre :

```
need_cursus (
  needId   uuid FK → needs     NOT NULL
  cursusId uuid FK → cursus    NOT NULL
  PRIMARY KEY (needId, cursusId)
)
```

`needs.targetCursusId` conservé en base pour compatibilité ascendante le temps de la migration des données existantes, puis supprimé dans une migration ultérieure.

### Schema — `companies` : nouveaux champs (UI dans chantier fiche entreprise séparé)
```
idcc                 text   -- Code IDCC convention collective
collectiveAgreement  text   -- Libellé convention collective
opco                 text   -- Nom OPCO/OPCA
retirementFund       text   -- Caisse de retraite complémentaire
providentFund        text   -- Organisme de prévoyance
legalRepFirstName    text   -- Représentant légal
legalRepLastName     text
```
Ces champs sont ajoutés au schéma dans ce chantier. L'interface d'édition est hors scope (chantier fiche entreprise).

### Drawer d'édition CERFA
Composant client `NeedContractDrawer` avec sections : Informations du poste (durée, type contrat, salaire), Maître d'apprentissage (6 champs), Avantages en nature, Dates. Server action `updateNeedContractFields(needId, fields)`. À la sauvegarde, un événement `need_fields_updated` est loggé dans `activityEvents`.

### Cursus cibles
Composant `BlocCursus` (Server Component + client pour l'édition) affichant les cursus sélectionnés avec badges. Édition via un popover multi-select sur la liste complète des cursus Ypareo. Server action `syncNeedCursus(needId, cursusIds[])` remplace la sélection courante. Événement `need_cursus_updated` loggé.

### Bloc Tâches
Réutilise le pattern existant des tâches ailleurs dans l'ATS. Composant `BlocTaches` avec liste des tâches filtrées par `needId` et formulaire de création rapide (titre, catégorie, assigné, date, notes). Événements `task_created` et `task_completed` loggés dans `activityEvents`.

### Historique d'activité
Composant `BlocHistorique` (Server Component) requêtant `activityEvents WHERE needId = :id ORDER BY createdAt DESC`. Affichage chronologique inversé avec icône par `actionType`, auteur, date relative, et `summary`. Les événements loggés couvrent : `need_status_changed`, `need_fields_updated`, `need_cursus_updated`, `matching_added`, `matching_removed`, `matching_status_changed`, `task_created`, `task_completed`, `fre_generated`, `fre_imported`, `fre_fields_applied`.

### Génération FRE
- Lib : `docxtemplater` + `pizzip` (à installer)
- Template `.docx` : `public/templates/fre-template.docx` avec balises `{{field}}` correspondant aux champs de la FRE EDA
- Server action `generateFre(needId)` :
  1. Charge les données besoin + entreprise + cursus
  2. Injecte dans le template via docxtemplater
  3. Upload vers Supabase Storage : `fre/{needId}/{timestamp}-generated.docx`
  4. Crée une entrée `documents` (`documentType = "fre"`, `needId`)
  5. Retourne l'URL signée pour téléchargement
  6. Logue `fre_generated` dans `activityEvents`
- Si des champs entreprise sont manquants (OPCO, IDCC, etc.), la génération procède quand même avec les champs disponibles et affiche un avertissement dans la sidebar listant les champs manquants avec lien vers l'annuaire

### Import FRE + extraction LLM
- Server action `importFre(needId, file: File)` :
  1. Upload du fichier vers Supabase Storage : `fre/{needId}/{timestamp}-imported.{ext}`
  2. Crée entrée `documents` avec `extractionStatus = "pending"`
  3. Extrait le texte du fichier (`.docx` via `mammoth` déjà installé, `.pdf` via `pdf-parse` déjà installé)
  4. Envoie le texte à Claude (`claude-haiku-4-5`) avec un prompt structuré listant les champs à extraire et leur format attendu
  5. Met à jour `documents.extractedData` avec le JSON retourné, `extractionStatus = "done"`
  6. Retourne les champs extraits au client pour confirmation
- Composant client `FreImportConfirmModal` : affiche les champs extraits éditables, bouton "Appliquer"
- Server action `applyFreExtraction(documentId, confirmedFields)` : met à jour `needs` + `companies` avec les champs confirmés, logue `fre_fields_applied`

### Versioning FRE dans la sidebar
`BlocFre` (client) charge tous les `documents WHERE needId = :id AND documentType = "fre" ORDER BY createdAt DESC`. Le plus récent est affiché avec bouton "Télécharger". Les versions antérieures sont dans une section "Versions précédentes" repliable avec date et type (générée/importée).

### Logging des événements
Fonction utilitaire `logActivityEvent({ needId, actorId, actionType, summary, metadata })` appelée depuis chaque server action concernée. S'appuie sur la table `activityEvents` existante.

## Testing Decisions

Les tests doivent vérifier le comportement observable externe, pas les détails d'implémentation internes.

**Ce qui fait un bon test ici** : appeler une server action avec des inputs connus et vérifier l'état résultant en base (champs sauvegardés, événement loggé, document créé). Pas de mock de Drizzle — tests sur une base de test réelle (pattern déjà établi dans le projet selon les retours du grilling).

**Modules à tester en priorité** :
- `updateNeedContractFields` : vérifie que les champs CERFA sont correctement persistés et qu'un `activityEvent` est créé
- `syncNeedCursus` : vérifie que la junction table est mise à jour (ajouts + suppressions) et événement loggé
- `generateFre` : vérifie qu'un document `fre` est créé en base et que le Storage reçoit un fichier
- `importFre` + `applyFreExtraction` : vérifie le flux complet extraction → confirmation → persistance ; le call LLM peut être mocké au niveau de la fonction d'extraction

## Out of Scope

- **Fiche entreprise** (édition des champs OPCO, IDCC, convention collective, représentant légal) — chantier séparé
- **Modale de placement Ypareo** (données contrat spécifiques au matching : dates définitives, rémunération par année, classe choisie) — chantier séparé
- **Suppression / archivage d'un besoin** depuis la fiche
- **Envoi de la FRE par email** directement depuis la fiche (action manuelle pour l'instant)
- **Signature électronique** de la FRE
- **Génération du CERFA FA13 complet** (hors périmètre FRE)

## Further Notes

- `mammoth` et `pdf-parse` sont déjà dans `node_modules` — utilisables sans installation supplémentaire pour l'extraction de texte lors de l'import FRE
- La table `documents` a déjà les colonnes `extractionStatus`, `extractedData`, `extractedAt` — le flux d'extraction LLM s'y branche naturellement
- Le template `.docx` source (`fre-template.pdf` fourni dans le repo) doit être converti en `.docx` avec balises `{{field}}` et stocké dans `public/templates/fre-template.docx` avant l'implémentation de la génération
- `needs.targetCursusId` restera en base le temps que les données existantes soient migrées vers `need_cursus` ; la migration de données doit faire partie du premier issue de ce chantier
- Les champs entreprise manquants (OPCO, etc.) sont ajoutés au schéma `companies` dans ce chantier mais sans UI — ils seront exposés via des server actions vides prêtes à brancher quand la fiche entreprise sera construite
- Le modèle LLM recommandé pour l'extraction FRE est `claude-haiku-4-5` (rapide, économique pour de l'extraction structurée)
