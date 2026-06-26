# Backlog — fonctionnalités en attente

## EN ATTENTE — bloquées

### Création candidat par import CV

**Statut :** bloquée — en attente de décision RGPD  
**ADR de référence :** [`docs/adr/0005-extraction-ia-documents-rgpd.md`](adr/0005-extraction-ia-documents-rgpd.md)

Permettre aux recruteurs d'uploader un CV pour pré-remplir automatiquement la fiche candidat via l'API Claude (Anthropic). La fonctionnalité est techniquement définie (upload Supabase Storage → appel API → mapping JSON → validation humaine avant persistance) mais **ne peut pas être activée en production** tant que les points suivants ne sont pas tranchés avec le DPO :

1. **Article 28 RGPD** — DPA avec Anthropic + mécanisme de transfert hors UE (SCC ou EU-US DPF)
2. **Base légale candidat** — intérêt légitime (6.1.f) ou consentement explicite (6.1.a) + mention transparence Article 13
3. **Rétention différenciée** — durée de conservation des fichiers bruts (CV, pièces d'identité) vs données structurées

**Signal de déblocage :** variable d'environnement `ANTHROPIC_API_KEY` — vide = fonctionnalité désactivée, valeur = fonctionnalité active.

**À reprendre une fois le RGPD tranché.**
