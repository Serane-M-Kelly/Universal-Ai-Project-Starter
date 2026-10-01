# Contrat des unités de travail

## Objectif

Empêcher qu'une demande vague, un plan ou une implémentation non vérifiée soit présenté comme un résultat terminé.

Chaque changement réalisé par `project-work` possède un fichier `taches/WORK-NNN.md`. Ce fichier est le contrat de l'unité ; le rapport correspondant dans `reports/work/` contient les preuves d'exécution.

## Propriété des informations

Le fichier d'unité contient le résultat, le périmètre, les critères, l'autorité et l'état. Il ne contient ni logs exhaustifs, ni documentation d'architecture, ni copie du brief.

Le rapport contient les fichiers modifiés, commandes exécutées, résultats, constats de revue et risques résiduels. Il ne remplace ni les sorties de test, ni Git, ni l'acceptation humaine.

`PROJECT_STATE.md` référence seulement l'unité active, son état observable et la prochaine décision.

## États

```text
proposed
  → approved
  → in_progress
  → ready_for_review
  → ready_for_acceptance
  → accepted
```

`blocked` peut être atteint depuis tout état actif. Une reprise revient à l'état réellement justifié par les preuves disponibles.

## Autorité

- L'assistant peut proposer et réaliser une unité autorisée.
- Une personne humaine approuve son périmètre et ses critères.
- L'exécutant peut déclarer le résultat prêt pour revue ou acceptation avec preuves.
- Seule une personne humaine peut marquer le résultat `accepted`.
- Un agent ne reçoit jamais plus d'autorité que l'unité transmise.

Une demande actuelle, claire et bornée peut constituer l'approbation initiale. Une unité dérivée, élargie ou ambiguë exige une confirmation explicite.

## Lien avec le backlog

Une unité déclare dans son frontmatter `realizes: [TSK-NNN, …]` les tâches de `taches/BACKLOG.md` qu'elle entreprend (`core/contracts/planning.md`). **Ce lien vit uniquement ici** : le backlog ne le duplique jamais.

- Les tâches déclarées appartiennent normalement à un **seul** résultat `BLG-NNN`. Un lot transversal exige `cross_cutting: true` et une section `## Justification du lot transversal`.
- Une même tâche peut être reliée à plusieurs unités (correction, nouvelle tentative) : c'est prévu, pas une anomalie.
- `title` fournit le libellé court affiché dans la roadmap générée.
- Ces trois champs sont **optionnels** : une unité rédigée avant `project-work` v3 reste valide sans modification.

Ce lien ne transfère aucune autorité : l'approbation, la réalisation et l'acceptation de l'unité suivent uniquement les règles de ce contrat. Une tâche de backlog n'approuve, ne réalise ni n'accepte jamais une unité à sa place, et n'est elle-même jamais soumise à approbation.

Une unité ne modifie jamais le résultat d'un `BLG` : si son périmètre s'avère plus large que prévu, **découper l'unité**, jamais élargir le résultat. Élargir un résultat est un changement substantiel du plan.

Pour les modes `idea` et `brief`, une unité créée après `project-plan` référence normalement les tâches d'un résultat `ready` du backlog en vigueur. Une unité urgente et non planifiée reste possible sur demande humaine explicite ; la procédure et son obligation de réconciliation ultérieure sont définies dans `project-work/SKILL.md` et `core/contracts/planning.md`.

La route `legacy-link-conversion` de `project-work` est la seule exception autorisée avant `PLAN_READY` : elle renseigne `title`, `realizes` et `cross_cutting` d'unités héritées d'un backlog v1, sans toucher au statut, à l'approbation ni au contenu contractuel de l'unité.

**Portée exacte de cette limite.** Le CLI et le Doctor vérifient l'**état courant** : liens historiques encore présents, documents `WORK` lisibles et valides, tâches référencées existantes et vue générée cohérente. Sans historique externe, une suppression coordonnée de `legacy_work_items` et de son lien `realizes` n'est pas détectable après coup. L'interdiction de commencer une implémentation pendant cette route est portée par `core/skills/project-work/SKILL.md`, c'est-à-dire par la gouvernance de l'assistant : ce n'est pas un verrou d'exécution système, et elle ne doit jamais être présentée comme tel.
