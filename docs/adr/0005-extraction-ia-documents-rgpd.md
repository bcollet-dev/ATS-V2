# Extraction IA des documents candidats — cadre RGPD et décisions en suspens

L'ATS propose d'envoyer des fichiers uploadés par les recruteurs (CV, CNI, carte vitale, diplômes, FRE) à l'API Claude (Anthropic) pour en extraire les données structurées et pré-remplir automatiquement les fiches candidats et entreprises. Cette fonctionnalité soulève trois questions RGPD distinctes qui doivent être tranchées avant toute mise en production.

## Décisions actées

**Minimisation des données.** Seul le contenu du fichier est envoyé à l'API. Aucun identifiant interne (UUID candidat, UUID entreprise) n'est inclus dans le prompt. L'extraction est stateless côté Anthropic : la réponse est un objet JSON structuré, immédiatement mappé sur la fiche, et aucune référence au fichier n'est conservée côté applicatif après l'opération.

**Pas d'envoi automatique.** L'extraction IA est toujours déclenchée manuellement par un recruteur, jamais automatiquement à l'upload. Le recruteur voit le résultat de l'extraction et valide (ou corrige) avant que les données ne soient écrites en base. Aucune donnée extraite n'est persistée sans validation humaine.

**Les fichiers bruts restent dans Supabase Storage**, soumis aux mêmes politiques RLS que les autres documents. Ils ne sont jamais renvoyés à un tiers après extraction.

## Décisions en suspens — à trancher avec le DPO

**① Base légale du transfert vers Anthropic (Article 28 RGPD)**
Envoyer un CV ou une CNI à l'API Anthropic constitue un transfert de données personnelles à un sous-traitant américain. Il faut :
- Vérifier qu'Anthropic propose un Data Processing Agreement (DPA) conforme Article 28
- Vérifier le mécanisme de transfert hors UE applicable (Standard Contractual Clauses ou EU-US Data Privacy Framework)
- Décider si Anthropic doit figurer dans le registre des sous-traitants d'EDA Groupe

**② Information et base légale côté candidat**
Le RGPD exige une base légale pour tout traitement automatisé. Deux options :
- *Intérêt légitime* (Article 6.1.f) : traitement interne d'un dossier de recrutement, le candidat a transmis ses documents dans ce but. Nécessite un test de mise en balance documenté.
- *Consentement explicite* (Article 6.1.a) : une case à cocher dans le formulaire de dépôt ou un écran dédié. Plus lourd mais incontestable.

Le candidat doit de toute façon être informé que ses documents sont traités par un outil d'IA (principe de transparence, Article 13). La mention doit figurer dans la politique de confidentialité ou dans le formulaire de recueil des documents.

**③ Durée de rétention différenciée**
Les fichiers bruts (CV, CNI, carte vitale) contiennent des données plus sensibles que les données structurées extraites. La durée de rétention des fichiers peut différer de celle des fiches candidats :
- Durée standard d'un dossier de recrutement en France : 2 ans après le dernier contact
- La CNI et la carte vitale (données d'identité et de santé) peuvent être soumises à des règles spécifiques
- À valider avec le DPO avant d'implémenter la purge automatique

## Conséquence sur le développement

La fonctionnalité peut être développée techniquement (upload, appel API, mapping, validation humaine) mais **ne doit pas être activée en production** avant que les points ① et ② soient tranchés. Un flag d'activation par variable d'environnement (`ANTHROPIC_API_KEY` vide = fonctionnalité désactivée) permet de déployer sans exposer.
