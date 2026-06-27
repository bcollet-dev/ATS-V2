# Backlog — fonctionnalités à venir

## ⚠ Note transversale RGPD

**Mailing, Export CSV et Import CV sont tous bloqués par l'absence de cadrage RGPD chez EDA Groupe.** Aucun de ces trois chantiers ne peut démarrer sans qu'un référent ou DPO ait tranché les questions de base légale, de finalité du traitement et d'exclusion des données sensibles. C'est le sujet prioritaire à clarifier avant d'ouvrir ces chantiers.

---

## BLOQUÉ par RGPD

### Import CV — extraction IA

**Statut :** bloqué — en attente de décision RGPD  
**ADR de référence :** [`docs/adr/0005-extraction-ia-documents-rgpd.md`](adr/0005-extraction-ia-documents-rgpd.md)

Permettre aux recruteurs d'uploader un CV pour pré-remplir automatiquement la fiche candidat via l'API Claude (Anthropic). La fonctionnalité est techniquement définie (upload Supabase Storage → appel API → mapping JSON → validation humaine avant persistance) mais **ne peut pas être activée en production** tant que les points suivants ne sont pas tranchés avec le DPO :

1. **Article 28 RGPD** — DPA avec Anthropic + mécanisme de transfert hors UE (SCC ou EU-US DPF)
2. **Base légale candidat** — intérêt légitime (6.1.f) ou consentement explicite (6.1.a) + mention transparence Article 13
3. **Rétention différenciée** — durée de conservation des fichiers bruts (CV, pièces d'identité) vs données structurées

**Signal de déblocage :** variable d'environnement `ANTHROPIC_API_KEY` — vide = fonctionnalité désactivée, valeur = fonctionnalité active.

### Mailing — envoi Gmail SMTP depuis le compte connecté

**Statut :** bloqué — nécessite grilling dédié + cadrage RGPD (envoi de masse)  
**Périmètre pressentí :** envoi depuis le compte Gmail de l'utilisateur connecté (OAuth), trames de mail, liste de destinataires filtrée depuis l'annuaire.  
**Questions RGPD à trancher avant grilling :**
- Base légale pour l'envoi de masse vers des candidats (prospection vs recrutement)
- Opt-out / désinscription obligatoire pour les envois en masse ?
- Traçabilité des envois : qu'est-ce qui doit être journalisé ?

### Export CSV

**Statut :** bloqué — nécessite grilling + cadrage RGPD  
**Questions à trancher :**
- Qui peut exporter quoi (tous les rôles ? seulement admin/direction ?)
- Exclusion des données sensibles par défaut (NIR, RQTH, date de naissance)
- Durée de vie des fichiers exportés, risque de fuite hors système

---

## À CADRER (grilling requis)

### Fiche candidat détaillée

**Statut :** placeholder en place (`/candidats/[id]`)  
Actuellement page vide avec lien de retour. Chantier à cadrer : quels blocs afficher (identité, coordonnées, pipeline, matchings, documents, historique), quels rôles peuvent éditer quoi.

### Import entreprise par SIRET via API data.gouv

**Statut :** prêt à cadrer — pas de blocage RGPD  
Remplissage automatique des champs entreprise (raison sociale, adresse, NAF, forme juridique) à partir du SIRET saisi dans le drawer. API publique data.gouv / INSEE, aucun transfert de données personnelles. À spécifier : comportement si le SIRET n'est pas trouvé, champs écrasables vs verrouillés après import.

### Import cursus depuis Ypareo

**Statut :** prêt à cadrer — chantier intégration API  
Synchronisation du catalogue cursus/classes depuis l'API Ypareo. Les cursus importés auront un `external_id` et un `synced_at`, à distinguer des cursus manuels (actuellement filtrés par `syncedAt IS NULL`). À spécifier : fréquence de sync, gestion des conflits (cursus renommé côté Ypareo), activation/désactivation automatique.

---

## QUICK WIN (pas de blocage)

### Dashboard — "Bonjour," sans prénom

**Statut :** bug mineur  
Le bloc de bienvenue affiche "Bonjour," sans le prénom de l'utilisateur connecté. À corriger : récupérer `profile.first_name` depuis la session et l'injecter dans le message d'accueil.
