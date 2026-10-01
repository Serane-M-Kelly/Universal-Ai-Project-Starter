---
name: project-phase
description: "Réaliser une phase choisie du backlog avec les spécialistes utiles, vérifier et corriger dans son mandat persistant, puis présenter le résultat pour la revue."
---

# project-phase

Lire `.starter/WORKFLOW.md` et `workflow context NUMERO --compact`. Examiner critères, exclusions, Git et sources
pertinentes. `workflow begin NUMERO --by PERSONNE --request MOTS_REELS` consigne le lancement.
Lire les références épinglées utiles ; pour une interface, reprendre les valeurs et états AD,
puis vérifier le comportement demandé par PA. Une divergence de référence se réconcilie dans Plan.
Si la phase est déjà autorisée, reprendre sans approbation supplémentaire. Répartir les sous-tâches
internes et solliciter le builder/spécialiste configuré si nécessaire. Le coordinateur reste seul
auteur du suivi. Exécuter, diagnostiquer et corriger jusqu'au résultat ou à l'intervention réelle.
Ajouter les actions techniques nécessaires via `workflow task-add NUMERO --summary DESCRIPTION
--reason JUSTIFICATION --by PERSONNE --request DEMANDE_INITIALE`, sans élargir le contrat.
Exécuter les vérifications avec `workflow check NUMERO --task ID --by AGENT --request MISSION
-- PROGRAMME ARGUMENTS`. --task est répétable ; attribuer seulement les tâches démontrées.
Un échec de commande ne clôt pas le travail : le traiter dans le mandat. Préparer les essais humains
avec gestes et résultat attendu, puis consigner les retours réels avec workflow observe.
Terminer par résultat, contrôles, limites et project-review. Si la demande a inclus la revue,
l'enchaîner. Ne pas passer seul à la phase suivante ni effectuer Git ou une publication.

Pour lire une preuve, utiliser `workflow report ID_PREUVE`. Le regroupement des tests réussis
ne démontre pas leur couverture : lire les noms ou assertions utiles avec --raw ou --stream.
Les erreurs et les revues restent intégrales. Ne pas refaire un contrôle pour retrouver son log.

## Visibilité dans la recherche, selon le périmètre

Si la phase affecte des pages publiques ou une migration concernées par la recherche, appliquer les contrôles pertinents de `.starter/runtime/core/contracts/search-visibility.md`. Préserver contenus et critères PA/AD ; distinguer vérification locale, cible publiée et indexation observée. Les étapes externes attendent leurs accès et autorisations réels.
