# GO / NO-GO production ATS V2 - 2026-07-04

## Verdict

**GO technique pour un deploiement controle.**

L'ouverture a toute l'equipe reste conditionnee aux controles jour J : secrets Vercel renseignes, migrations Supabase appliquees, preview teste, et parcours Ypareo valide sur un dossier test. Si l'un de ces controles echoue, le verdict devient **NO-GO ouverture equipe** jusqu'a correction.

## Consolidation des chantiers

| Chantier | Resultat |
| --- | --- |
| 01 - Garde-fous production | OK : variables, migrations, cron, profils inactifs, rollback et validation locale documentes. |
| 02 - Matching depuis Admissible | OK : rattachement besoin possible uniquement a partir du statut candidat Admissible. |
| 03 - FRE / CERFA complet et modifiable | OK : generation rapide, ouverture nouvel onglet, champs CERFA/FRE visibles et modifiables. |
| 04 - Extraction IA | OK : extraction automatique configurable, validation humaine, champs decochables, NIR protege. |
| 05 - Ypareo robuste | OK : payload editable, erreurs lisibles, anti-doublon, logs, succes Place/Client, erreur retour Attente FRE. |
| 06 - Documents equipe | OK : acces equipe authentifiee, URLs temporaires, Storage prive, pas de `storagePath` expose cote client. |
| 07 - Emails jour 1 | OK : Gmail OAuth chiffre, erreurs reconnexion lisibles, pieces jointes ATS. |
| 08 - Performance volume cible | OK : simulation 1 000 candidats / 300 besoins / 2 000 documents, index ajoutes, build OK. |

## Criteres NO-GO

Le lancement doit etre bloque si un seul de ces points est vrai :

- perte ou suppression de document sans erreur visible ;
- exposition d'un lien permanent ou chemin Storage brut cote navigateur ;
- NIR affiche en clair sans action volontaire ou present en clair dans les logs ;
- matching possible avant Admissible ;
- succes Ypareo qui ne passe pas candidat en Place et besoin en Client ;
- erreur Ypareo qui ne remet pas candidat et besoin en Attente FRE ;
- doublon Ypareo cree alors qu'une ressource existante est detectee et reutilisable ;
- FRE impossible a generer, ouvrir ou corriger avant Ypareo ;
- extraction IA activee sans `AI_EXTRACTION_DPO_APPROVED=true` ;
- variables production manquantes ou migrations Supabase non appliquees ;
- login d'un profil desactive encore possible.

## Risques restants

Bloquant :

- Aucun blocage code identifie apres validations locales.
- Bloquant operationnel si les secrets production, migrations ou tests preview ne sont pas faits.

Important :

- Faire un vrai test Ypareo en production sur dossier controle avant ouverture large.
- Confirmer les sauvegardes Supabase et la restauration avant donnees reelles volumineuses.
- Surveiller les logs pendant la premiere semaine, surtout Ypareo, Gmail et extraction IA.
- Verifier que les mentions RGPD et l'information candidat couvrent l'extraction IA.

Confort :

- Nettoyer les avertissements lint historiques.
- Ajouter plus tard virtualisation/pagination si les pipelines depassent largement le volume cible.
- Ajouter un tableau de bord technique pour temps moyens Ypareo/Gmail/IA.

## Checklist jour J

Login et droits :

- Connexion Google fonctionnelle sur l'URL finale.
- Compte autorise actif peut entrer.
- Profil desactive refuse.
- Acces equipe ouvert aux documents selon decision produit.

Candidats :

- Pipeline charge.
- Creation/modification fiche OK.
- Rattachement besoin indisponible avant Admissible.
- Rattachement besoin disponible depuis Admissible.
- Champs CERFA candidat modifiables.
- NIR masque par defaut.

Besoins :

- Pipeline charge.
- Fiche besoin ouvrable depuis les cartes.
- Champs CERFA besoin modifiables.
- Contact, tuteur/maitre d'apprentissage, remuneration, RNCP, IDCC, NAF et effectif disponibles.

Matching :

- Creation matching candidat admissible -> besoin.
- Passage Entretien / Attente FRE OK.
- Statuts candidat et besoin recalcules depuis les matchings.
- Besoin passe Client et candidat Place apres succes Ypareo.

FRE / CERFA :

- Bouton generation rapide visible en Attente FRE.
- FRE generee avec la trame attendue.
- FRE ouverte dans un nouvel onglet.
- Import FRE propose les champs avant application.
- Champs importables decochables et modifiables.

Extraction IA :

- Upload document eligible declenche l'extraction.
- Les champs proposes sont visibles avant import.
- Les champs decoches ne sont pas appliques.
- CNI / carte vitale : NIR masque et non coche par defaut.
- Echec extraction visible mais non bloquant.

Ypareo :

- Preview modal editable.
- Champs contrat, employeur, candidat, maitre d'apprentissage, cursus et remuneration visibles.
- Envoi dossier test OK.
- Erreur test ou controlee remet candidat et besoin en Attente FRE.
- Log Ypareo cree avec erreur lisible et sans NIR en clair.

Documents :

- Upload candidat OK.
- Ouverture document via URL temporaire OK.
- Suppression document supprime aussi le fichier Storage.
- Document entreprise OK.
- FRE retrouvee depuis la fiche besoin.

Emails :

- Connexion Gmail OK.
- Envoi avec trame et variables OK.
- Piece jointe ATS envoyee.
- Erreur Gmail deconnecte lisible.

Performance :

- `npm run perf:smoke` OK.
- Build production OK.
- Pages candidats, besoins, matching, dashboard et fiches chargees sur preview.

Supabase :

- Toutes les migrations appliquees dans l'ordre.
- Migration `20260704_performance_indexes.sql` appliquee.
- Bucket `documents` prive.
- Auth Google configure.
- Premier groupe d'utilisateurs autorise.
- Sauvegardes activees.

Vercel :

- Variables production renseignees.
- `npm run check:env` OK apres `vercel env pull`.
- Preview deploy teste.
- Domaine final configure.
- Logs consultes pendant les tests.

Cron :

- `CRON_SECRET` defini.
- Route `/api/cron/digest` refuse sans bearer.
- Route accepte avec `Authorization: Bearer <CRON_SECRET>`.

## Controles premiere semaine

- Jour 1 : verifier logs Vercel/Supabase toutes les 2 heures.
- Jour 1 : suivre chaque erreur Ypareo et confirmer le retour Attente FRE.
- Jour 1 : confirmer que les documents ouverts viennent d'URLs temporaires.
- Jour 2 : controler 5 fiches candidats creees/importees par IA.
- Jour 2 : controler 3 besoins avec remuneration multi-plages.
- Jour 3 : verifier les emails envoyes avec pieces jointes.
- Jour 5 : relancer `npm run perf:smoke` apres les premiers imports.
- Fin semaine : revue rapide des incidents, erreurs Ypareo, extraction IA, documents et demandes utilisateurs.

## Rollback

La procedure de rollback est referencee dans `docs/mise-en-production.md`.

En cas de probleme applicatif : rollback Vercel.

En cas de probleme donnees : pas de correction manuelle sans export, appliquer une migration corrective explicite, puis documenter l'incident.
