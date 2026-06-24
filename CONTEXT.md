# ATS EDA Groupe

Outil interne de pilotage du recrutement en alternance et apprentissage pour EDA Groupe. Couvre le suivi des candidats, des entreprises partenaires, et leur mise en relation jusqu'au placement et à la création du contrat dans Ypareo.

## Language

### Acteurs

**Candidat** :
Personne qui postule à une formation en alternance ou apprentissage chez EDA Groupe. Suit un pipeline de 12 étapes depuis le premier contact jusqu'au placement ou au refus.
_Avoid_ : Lead (terme générique), apprenant (terme Ypareo réservé au candidat après signature du contrat), étudiant

**Entreprise** :
Structure employeuse partenaire d'EDA Groupe susceptible d'accueillir un candidat en alternance. Identifiée de manière unique par son SIREN.
_Avoid_ : Client (réservé au statut final du pipeline besoin), société, organisme

**Contact** :
Personne physique rattachée à une entreprise, interlocuteur d'EDA Groupe pour le recrutement (RH, tuteur, dirigeant). Une entreprise peut avoir plusieurs contacts.
_Avoid_ : Recruteur (ambigu avec les rôles internes), interlocuteur

**Apprenant** :
Terme propre à Ypareo désignant un candidat après qu'il a signé son contrat et est inscrit dans une classe. Utilisé uniquement dans le contexte de l'intégration Ypareo.
_Avoid_ : Ne pas utiliser dans l'ATS pour désigner un candidat non encore placé

### Recrutement

**Besoin** :
Poste en alternance ouvert par une entreprise partenaire, pour lequel EDA Groupe cherche à proposer un candidat. Suit un pipeline de 7 étapes (Ad chase → Prospect → Besoin en cours → Entretien → Placé attente FRE → Client → Rupture). Son statut est dérivé automatiquement du statut de proposition le plus avancé parmi ses matchings actifs.
_Avoid_ : Offre, opportunité, poste, annonce

**Matching** :
Lien explicite entre un candidat et un besoin, créé à partir du moment où le candidat est jugé admissible. Porte un statut de proposition propre et déclenche la mise à jour automatique du statut principal du candidat et du besoin.
_Avoid_ : Candidature (ambigu), proposition (c'est une action sur le matching, pas le matching lui-même), rattachement

**Statut de proposition** :
Statut porté par chaque matching, représentant l'avancement de la mise en relation côté entreprise : CV envoyé → Entretien → Attente FRE → Placé / Non retenu. Quand un statut de proposition change, le statut principal du candidat (et du besoin) se recalcule automatiquement sur la valeur la plus avancée parmi tous leurs matchings actifs.
_Avoid_ : Statut matching, état de la candidature

**Placement** :
Résultat d'un matching abouti : le statut de proposition atteint "Attente FRE" et le dossier est prêt à être envoyé à Ypareo.
_Avoid_ : Recrutement (trop générique), embauche (terme hors alternance)

**Gagnant** :
Le matching sélectionné via la modale de confirmation lorsque plusieurs matchings d'un même candidat ou besoin atteignent "Attente FRE" simultanément. Les autres matchings deviennent non retenus et sont gelés.
_Avoid_ : Sélectionné, retenu (ambigu avec le statut admissible)

**Non retenu** :
Matching dont le statut de proposition est terminé négativement — soit parce que l'entreprise ou le candidat a refusé, soit parce qu'un autre matching a été désigné gagnant. Un matching non retenu par sélection de gagnant est gelé en écriture et se débloque si le statut FRE est annulé.
_Avoid_ : Refusé (implique une décision définitive), archivé

**NRP** :
No Response / N'a pas répondu. Statut du pipeline candidat indiquant qu'aucune réponse n'a été obtenue malgré les tentatives de contact.
_Avoid_ : Sans réponse, injoignable

**Admissible** :
Statut du pipeline candidat indiquant que le candidat a été validé en entretien EDA Groupe et peut être proposé à des entreprises. C'est à partir de ce statut qu'un candidat peut être rattaché à des besoins.
_Avoid_ : Qualifié, validé, accepté

**PVPP** :
Statut du pipeline candidat désignant un candidat qui avait un entretien de motivation planifié chez EDA Groupe mais ne s'est pas présenté. Se place entre "Entretien" et "Admissible" — le candidat peut être recontacté ou basculer vers un refus.
_Avoid_ : Absent, no-show

**Ad chase** :
Premier statut du pipeline besoin désignant un besoin identifié (via une annonce publiée par l'entreprise) mais pour lequel aucun contact n'a encore été établi avec l'entreprise.
_Avoid_ : Prospection froide, annonce repérée

**Rupture** :
Fin anticipée d'un contrat d'alternance après signature. Statut terminal présent dans les deux pipelines (candidat et besoin).
_Avoid_ : Abandon, résiliation, fin de contrat (terme pour une fin normale)

### Formation

**Cursus** :
Programme de formation proposé par EDA Groupe, correspondant à un produit dans le catalogue Ypareo (ex : Bachelor RH, BTS Commerce). Un cursus contient une ou plusieurs classes.
_Avoid_ : Formation, programme, diplôme, produit (terme Ypareo interne)

**Classe** :
Session concrète d'un cursus pour une année donnée, correspondant à une action de formation dans Ypareo. C'est à une classe que le candidat est inscrit lors du placement.
_Avoid_ : Promotion, groupe, action (terme Ypareo interne), session

### Documents & Administratif

**CERFA** :
Formulaire officiel du contrat d'apprentissage ou de professionnalisation (CERFA FA13). Les données sont saisies dans l'ATS puis envoyées à Ypareo qui génère le document final.
_Avoid_ : Contrat (trop générique), formulaire

**FRE** :
Fiche de Renseignement Employeur. Document PDF pré-rempli par l'ATS à partir des données candidat et entreprise, à compléter avant l'envoi à Ypareo pour finaliser le CERFA.
_Avoid_ : Fiche entreprise, document de placement

**NIR** :
Numéro d'Identification au Répertoire — numéro de sécurité sociale du candidat. Donnée sensible, stockée chiffrée, masquée dans toutes les interfaces et les journaux.
_Avoid_ : Numéro de sécu, NSS, numéro INSEE

**RQTH** :
Reconnaissance de la Qualité de Travailleur Handicapé. Information administrative du candidat, à caractère sensible.

### Intégration Ypareo

**Ypareo** :
ERP de gestion des formations utilisé par EDA Groupe. L'ATS lui envoie les dossiers de placement (identité candidat, entreprise, CERFA) et en importe le catalogue de cursus et classes.

**Catalogue Ypareo** :
Ensemble des cursus et classes actifs importés depuis Ypareo. Sert à mapper chaque candidat et chaque besoin à une formation précise avant l'envoi du dossier.

**Envoi Ypareo** :
Action de pousser les données d'un placement vers Ypareo via l'API. Déclenché manuellement par une modale de confirmation avec choix de la classe. Journalisé dans les échanges Ypareo.

**Échanges Ypareo** :
Journal de toutes les requêtes et réponses entre l'ATS et Ypareo. Chaque échange est tracé avec son statut (succès, erreur, en attente, rejouable).

### Tâches & Communication

**Tâche** :
Action à effectuer rattachée à un candidat ou une entreprise, avec une échéance et un responsable. Peut générer un rappel automatique.

**Trame mail** :
Modèle d'email réutilisable avec objet et corps pré-remplis, catégorisé par audience (candidat, entreprise, besoin). Utilisé pour les envois manuels et les campagnes.

**Mailing** :
Envoi d'un email en lot à une sélection de candidats filtrés, en utilisant une trame mail.
