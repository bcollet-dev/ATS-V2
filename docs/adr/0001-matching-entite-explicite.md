# Matching modélisé comme entité explicite, pas comme jointure

Un candidat et un besoin peuvent être liés simultanément à plusieurs contreparties avant qu'un gagnant soit désigné. Ce lien porte son propre cycle de vie (statut, historique des propositions, motif de refus, état gelé/actif). Une simple table de jointure sans état ne suffit pas. Nous modélisons donc le Matching comme une entité à part entière avec son propre identifiant, ses propres colonnes de statut, et ses propres règles métier (gel lors de la sélection du gagnant, dégel si le statut FRE est annulé).

## Considered Options

Une clé étrangère directe entre `candidates` et `needs` aurait été plus simple, mais aurait rendu impossible le suivi de plusieurs propositions simultanées pour un même candidat et la traçabilité des refus.
