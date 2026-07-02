# 03 — Filtres, recherche et tri par colonne

Status: ready-for-agent

## Parent

`.scratch/matching/PRD.md`

## What to build

Ajouter des contrôles de filtre, de recherche textuelle et de tri indépendants à chaque colonne de la page `/matching`. Tout le filtrage est côté client (React state) — aucune requête serveur supplémentaire.

### Colonne candidats — contrôles disponibles

- **Recherche** : texte libre sur prénom + nom (insensible à la casse)
- **Filtre statut** : sélecteur parmi tous les `candidateStatus` (option "Tous")
- **Filtre cursus envisagé** : sélecteur sur les valeurs distinctes présentes dans les données chargées (option "Tous")
- **Filtre ville** : sélecteur ou texte libre sur `city` (option "Tous")
- **Filtre recruteur** : sélecteur parmi les recruteurs présents dans les données (option "Tous")
- **Filtre CV** : toggle "Avec CV uniquement" (filtre sur `hasCV = true`)
- **Tri** : par nom (A→Z / Z→A), date de mise à jour (récent en premier / plus ancien en premier), statut

### Colonne besoins — contrôles disponibles

- **Recherche** : texte libre sur titre du besoin + nom de l'entreprise (insensible à la casse)
- **Filtre statut** : sélecteur parmi tous les `needStatus` (option "Tous")
- **Filtre cursus cible** : sélecteur sur les valeurs distinctes présentes dans les données (option "Tous")
- **Filtre ville** : sélecteur ou texte libre sur `city` (option "Tous")
- **Filtre recruteur** : sélecteur parmi les recruteurs présents (option "Tous")
- **Filtre entreprise** : sélecteur parmi les entreprises présentes (option "Toutes")
- **Tri** : par titre (A→Z / Z→A), date de mise à jour, statut, nombre de candidats actifs (décroissant)

### Comportement

- Les filtres des deux colonnes sont strictement indépendants : modifier un filtre côté candidats n'affecte pas la colonne besoins, et vice versa.
- La sélection multi (issue #04) doit persister quand les filtres changent — une carte sélectionnée qui disparaît des résultats filtrés reste dans l'état de sélection (elle réapparaît sélectionnée si le filtre est levé).
- Un bouton "Réinitialiser les filtres" par colonne remet tous les contrôles à leur valeur par défaut.
- Afficher le nombre de résultats visibles : "X candidats" / "Y besoins" sous la barre de filtres.

## Acceptance criteria

- [ ] Chaque colonne possède une barre de recherche fonctionnelle (filtre en temps réel sur nom/titre)
- [ ] Tous les sélecteurs de filtre listés sont présents et fonctionnels dans chaque colonne
- [ ] Modifier un filtre colonne gauche n'affecte pas la colonne droite, et vice versa
- [ ] Le compteur de résultats est correct après filtrage
- [ ] "Réinitialiser les filtres" remet tous les contrôles à leur valeur initiale
- [ ] Une carte sélectionnée dans une sélection en cours reste sélectionnée même si elle est masquée par un filtre actif

## Blocked by

- Issue #02 (page skeleton + loaders requis)
