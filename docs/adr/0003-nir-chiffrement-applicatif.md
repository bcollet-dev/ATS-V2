# NIR chiffré au niveau applicatif avec clé distincte

Le NIR (numéro de sécurité sociale) est chiffré en base de données avec une clé applicatif distincte de la clé de chiffrement Supabase. Le NIR n'apparaît jamais en clair dans les interfaces, les journaux d'échange Ypareo, ou les logs d'erreur.

Le chiffrement au niveau base (Supabase) seul ne protège pas contre une fuite des données exportées ou une compromission d'un compte admin ayant accès direct à la base. Le NIR est la donnée personnelle la plus sensible stockée dans l'ATS — une fuite exposerait les candidats à des risques d'usurpation d'identité. Le chiffrement applicatif garantit qu'une fuite de la base sans la clé applicative ne suffit pas à exposer les numéros de sécurité sociale.

## Consequences

La clé de chiffrement du NIR doit être gérée comme un secret critique (variable d'environnement Vercel, rotation périodique). La perte de cette clé rend les NIR stockés irrécupérables.
