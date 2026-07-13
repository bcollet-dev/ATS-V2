# Guide — RGPD : rétention & purge des données

## À quoi ça sert

Respecter l'obligation de **ne pas conserver les données personnelles
indéfiniment** : au-delà d'une durée de rétention, les fiches candidats et
entreprises **supprimées** sont **effacées définitivement** (avec leurs documents
sensibles). Réservé aux **administrateurs**.

## Le principe

- Une fiche **supprimée** (soft-delete) reste récupérable un temps, puis devient
  éligible à la **purge définitive** une fois la durée de rétention dépassée
  (comptée depuis la date de suppression).
- Durées par défaut : **candidats 730 jours** (2 ans), **entreprises 1825 jours**
  (5 ans) — modifiables.
- La purge s'exécute **automatiquement chaque nuit** et peut être **déclenchée
  manuellement**.

## Configurer la rétention

**Paramètres → RGPD** → ajustez le nombre de jours pour candidats et entreprises → **Enregistrer**.

L'écran affiche combien de fiches sont **actuellement dues** à la purge selon vos réglages.

## Déclencher une purge manuelle

Bouton **Purger maintenant**.

**Ce que ça entraîne (définitif, irréversible) :**
- Pour chaque **candidat** dû : suppression de la fiche, de ses **documents**
  (CV, CNI, carte vitale — fichiers **et** métadonnées, y compris le NIR chiffré),
  entretiens, matchings, tâches, notifications, historique et logs Ypareo associés.
- Pour chaque **entreprise** due : suppression de la fiche, de ses **besoins**,
  contacts, documents et éléments liés.
- Un compte-rendu indique le nombre d'éléments supprimés, et le cas échéant le
  nombre d'éléments **non purgés** (voir ci-dessous).

## Garanties de sécurité de la purge

- **Effacement complet des fichiers** : si un document sensible ne peut pas être
  supprimé du stockage, la fiche **n'est pas effacée** ce tour-ci et sera
  **reprise au prochain passage** — jamais de fiche « effacée » avec des pièces
  qui traîneraient encore.
- **Résilience** : un échec sur une fiche **n'interrompt pas** la purge des autres ;
  le nombre d'échecs est remonté.
- **Pas de résidu** : les tâches et logs qui mentionnent la personne sont également
  supprimés.

## Points d'attention

- La purge est **définitive** : vérifiez vos durées de rétention avant de lancer.
- Seules les fiches **déjà supprimées** sont concernées — une fiche active n'est
  jamais purgée automatiquement, quelle que soit son ancienneté.
- En cas d'éléments « non purgés » signalés, ils seront automatiquement retentés ;
  si cela persiste, contactez l'administrateur technique (souvent un fichier de
  stockage temporairement indisponible).
