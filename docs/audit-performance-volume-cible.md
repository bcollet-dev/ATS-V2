# Audit performance volume cible - 2026-07-04

## Objectif

Valider l'ATS avant mise en production pour le volume d'usage annonce :

- 1 000 candidats
- 300 besoins
- 300 entreprises
- 2 000 documents
- 5 a 10 utilisateurs internes

Objectifs d'usage :

- pages principales utilisables et visees sous 2 s a chaud ;
- actions simples visees sous 1 s hors dependances externes ;
- operations longues avec etat visible, sans impression de blocage.

## Mesures locales

Commande :

```bash
npm run perf:smoke
```

Resultat du 2026-07-04 :

| Zone | Median | P95 | Budget |
| --- | ---: | ---: | ---: |
| Pipeline candidats | 0.96 ms | 2.97 ms | 100 ms |
| Pipeline besoins | 0.29 ms | 1.07 ms | 100 ms |
| Page matching | 0.62 ms | 2.49 ms | 100 ms |
| Dashboard | 0.35 ms | 1.31 ms | 60 ms |
| Fiches candidat/besoin/entreprise | 0.18 ms | 1.03 ms | 30 ms |

Ces mesures couvrent le cout de regroupement et de preparation cote application. Elles ne remplacent pas les mesures reelles Vercel/Supabase, qui dependront de la latence reseau, de la region et du plan retenu.

## Corrections appliquees

- Page besoins : suppression de trois requetes de comptage redondantes. Les compteurs actifs, Attente FRE et Entretien sont maintenant calcules depuis la liste de matchings deja chargee.
- Page candidats : suppression d'un controle d'authentification redondant au rendu initial.
- Page matching : suppression d'un controle d'authentification redondant au rendu initial.
- Base de donnees : ajout d'index composes pour les filtres reels des pipelines, matching, documents, relances et annuaire.
- Projet : ajout de la commande `npm run perf:smoke` pour relancer la verification de volume avant mise en production ou apres gros import.

## Index ajoutes

Migration : `supabase/migrations/20260704_performance_indexes.sql`

- `candidates_pipeline_idx`
- `candidates_created_at_idx`
- `needs_pipeline_idx`
- `needs_created_at_idx`
- `needs_target_cursus_idx`
- `companies_directory_idx`
- `company_contacts_company_active_idx`
- `matchings_candidate_status_idx`
- `matchings_need_status_idx`
- `matchings_candidate_frozen_status_idx`
- `matchings_need_frozen_status_idx`
- `matchings_winner_class_idx`
- `documents_candidate_type_idx`
- `documents_company_type_idx`
- `documents_need_type_idx`
- `documents_extraction_status_idx`
- `tasks_open_due_idx`

## Points audites

- Pipeline candidats : charge les candidats actifs, les prochaines taches et les matchings actifs sans charger les fichiers.
- Pipeline besoins : charge les besoins actifs, les prochaines taches entreprise et les matchings actifs sans recompter plusieurs fois.
- Page matching : charge les candidats admissibles, besoins eligibles, CV presents et matchings actifs.
- Dashboard : les widgets limitent deja les listes longues et utilisent des agregations SQL.
- Fiches candidat, besoin, entreprise : chargement par identifiant, donc cout stable au volume cible.
- FRE, Ypareo, Gmail et extraction IA : operations longues avec bouton bloque, libelle d'attente ou retour d'erreur visible.

## Charges excessives ou requetes a surveiller

- Dashboard "candidats inactifs" : sous-requete groupee sur `activity_events`. Acceptable au volume cible, a surveiller si l'historique depasse plusieurs dizaines de milliers d'evenements.
- Matching : les listes utilisent des filtres `IN` sur les identifiants charges. Acceptable a 1 000 candidats / 300 besoins, a repenser si le volume depasse fortement ce cadre.
- Envoi Gmail avec pieces jointes : depend de Supabase Storage et Gmail. Le temps peut depasser 1 s, mais l'action est longue par nature et l'interface affiche l'etat d'envoi.
- Envoi Ypareo : depend de l'API externe. Les erreurs remettent candidat et besoin en Attente FRE pour eviter un faux statut Place/Client.
- Extraction IA automatique : dependra du modele choisi et de la taille des documents. A surveiller avec journalisation et file d'attente si l'equipe importe de gros lots.

## Risques restants

Bloquant :

- Aucun risque bloquant identifie pour le volume cible, a condition d'appliquer les migrations avant ouverture.

Important :

- Mesurer en production les temps reels Vercel/Supabase apres import initial.
- Verifier la region des services pour eviter une latence inutile.
- Ajouter une file d'attente si l'extraction IA est lancee en lot massif.

Confort :

- Ajouter de la pagination ou de la virtualisation si les pipelines depassent plusieurs milliers de cartes.
- Ajouter un widget d'administration avec les temps moyens Ypareo/Gmail/extraction.
- Mettre en place une alerte si une page depasse 2 s a chaud plusieurs fois de suite.
