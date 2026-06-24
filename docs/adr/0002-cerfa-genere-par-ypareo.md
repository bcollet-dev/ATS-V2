# Le CERFA est généré par Ypareo, pas par l'ATS

L'ATS collecte et stocke toutes les données nécessaires au contrat (identité candidat, données entreprise, cursus, grilles de rémunération CERFA), puis les pousse vers Ypareo via API. C'est Ypareo qui génère le document CERFA officiel. L'ATS ne produit pas de CERFA lui-même.

Cette séparation évite d'avoir deux sources de vérité pour le contrat officiel. Si l'ATS générait aussi le CERFA, toute divergence entre les deux versions créerait un risque légal et une charge de maintenance. Ypareo est le système de référence pour les documents contractuels ; l'ATS est le système de référence pour le suivi du recrutement.

## Consequences

La FRE (Fiche de Renseignement Employeur) générée par l'ATS est un document de travail intermédiaire — elle pré-remplit les données pour faciliter la vérification avant envoi, mais n'a pas de valeur contractuelle.
