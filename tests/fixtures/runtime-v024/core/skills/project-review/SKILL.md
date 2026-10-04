---
name: project-review
description: "Faire examiner une phase dans un contexte distinct, organiser les corrections et établir si le résultat est acceptable et prêt pour une préparation de commit."
---

# project-review

Lire `.starter/WORKFLOW.md` et `workflow context NUMERO --compact` (la phase active si non précisée).
Lancer le reviewer configuré dans un contexte distinct avec critères, diff et empreintes retournées
par context. Lui fournir les preuves, puis seulement la justification détaillée du constructeur.
Pour une interface, joindre les références PA/AD épinglées et les rendus inspectables : distinguer
écart visuel, défaut fonctionnel et suggestion facultative. AD peut contribuer à cette inspection ;
sa revue de sa propre direction ne constitue pas une revue indépendante.
Attendre le rapport JSON (code_hash, contract_hash, summary, findings, checks). Il ne doit pas
éditer le code. Ne pas présenter une auto-revue comme indépendante si la délégation est indisponible.
Consigner le rapport réel avec `workflow review NUMERO --report RAPPORT_JSON --verdict
passed|changes_required|blocked --independent --by REVIEWER --request MISSION`. Associer --task
uniquement aux tâches démontrées par l'inspection. Faire corriger les défauts dans le mandat et
réexaminer le résultat modifié ; respecter la règle de sortie des boucles du contrat commun.
Les observations humaines réellement reçues utilisent `workflow observe NUMERO --task ID
--summary OBSERVATION --by PERSONNE --request MOTS_REELS`. Ne pas déduire un essai du seul avis IA.
Si l'acceptation explicite ou conditionnelle applicable a été donnée et ses conditions démontrées,
`workflow accept NUMERO --by PERSONNE --request MOTS_REELS` sans nouvelle demande. Sinon présenter
le résultat concret à accepter. Sur demande, préparer le commit avec project-ship ; pas de mutation Git.
Une phase déjà acceptée à réexaminer doit être rouverte avec la raison réelle, puis reprise.

Pour lire une preuve, utiliser `workflow report ID_PREUVE`. Le regroupement des tests réussis
ne démontre pas leur couverture : lire les noms ou assertions utiles avec --raw ou --stream.
Les erreurs et les revues restent intégrales. Ne pas refaire un contrôle pour retrouver son log.

## Visibilité dans la recherche, selon le périmètre

Pour les critères SEO applicables, lire Phase et Review ainsi que Migration si nécessaire dans `.starter/runtime/core/contracts/search-visibility.md`. Examiner les preuves et URL/environnements réellement couverts ; une maquette, un score Lighthouse ou une syntaxe valide ne prouve pas indexation ou classement. Signaler les vérifications après publication restant à faire, sans les déclarer réussies ni exiger des résultats commerciaux futurs pour accepter le code.
