# Guide — FRE / CERFA (contrat)

## À quoi ça sert

Générer le **FRE** (le CERFA du contrat d'apprentissage) prérempli à partir des
informations du besoin, de l'entreprise et du candidat retenu, puis le récupérer
en PDF. Le document contient des données sensibles (dont le **NIR**).

## Qui peut y accéder

Réservé aux rôles **Admin, Direction, Recruteur (admissions) et Relation
entreprise**. Les autres rôles ne voient pas et ne génèrent pas les FRE — parce
que le PDF contient le **NIR en clair** et l'état civil complet.

## Générer un FRE

Fiche besoin → bloc **FRE** → **Générer**.

**Ce que ça entraîne :**
- Le CERFA est prérempli (entreprise, contrat, apprenti, NIR, représentant…),
  enregistré comme document du besoin, et un lien de téléchargement (valable 1 h)
  est fourni.
- La génération est **possible même si des informations manquent** : le bloc FRE
  liste les **champs manquants** (IDCC, convention collective, OPCO, caisse de
  retraite, représentant légal…). Vous pouvez générer un **brouillon** pour
  avancer, mais…

## ⚠️ Complétude obligatoire à l'envoi Ypareo

Les champs manquants ne bloquent **pas** la génération, **mais bloquent l'envoi
vers Ypareo** : tant que les informations obligatoires du contrat ne sont pas
renseignées (IDCC, convention collective, OPCO, caisse de retraite, représentant
de l'employeur, NIR, etc.), le placement **ne peut pas être transmis à Ypareo**
et la liste des champs manquants est affichée.

→ Complétez la fiche entreprise / besoin avant l'envoi Ypareo.

## Importer un FRE signé

Bloc FRE → **Importer** : déposez le CERFA signé (PDF). L'IA peut en extraire des
informations à reporter sur la fiche (après votre validation).

## Points d'attention

- Le PDF est une **photo à l'instant T** : si le salaire, les dates ou le
  représentant changent après génération, **régénérez** le FRE — l'ancien PDF
  n'est pas mis à jour automatiquement.
- Chaque génération crée une **nouvelle version** ; identifiez bien la dernière.
- Si le NIR n'a pas pu être lu, le FRE est généré **sans NIR** — vérifiez avant
  usage (et de toute façon l'envoi Ypareo exigera le NIR).
