---
schema_version: 1
state_version: 1
stage: intake
status: active
current_phase: null
current_task: null
brief_version: null
plan_version: null
last_verified_at: null
updated_at: null
---

# État du projet — [Nom du projet]

## Résumé actuel

[Décrire en deux ou trois phrases où se trouve réellement le projet.]

## Objectif immédiat

[Un seul résultat prioritaire.]

## Avancement

- **Dernier résultat accepté :** [aucun ou référence]
- **Travail en cours :** [aucun ou référence]
- **Prochaine action recommandée :** [action]
- **Responsable de la prochaine action :** [Kelly / assistant / agent / autre]

## Décisions attendues

| Décision | Responsable | Bloquante | Options ou référence |
|---|---|---|---|
| [Décision] | [Personne] | oui / non | [Référence] |

## Blocages et risques immédiats

| Élément | Effet | Action ou condition de reprise |
|---|---|---|
| [Blocage] | [Effet] | [Action] |

## Dernière vérification

- **Date :** [jamais / date]
- **Périmètre :** [à compléter]
- **Résultat :** READY / WARNING / BLOCKED / non vérifié
- **Rapport :** [chemin ou aucun]

## Reprise de session

À la reprise :

1. lire `project.yaml` ;
2. vérifier la version approuvée de `PROJECT_BRIEF.md` ;
3. lire ce fichier ;
4. consulter uniquement les décisions, tâches et preuves référencées ;
5. vérifier que l'état correspond encore au code et à Git avant d'agir.

## Règles

- Ne jamais marquer une tâche terminée sur la base d'un plan.
- Ne jamais copier le brief dans ce fichier.
- Ne jamais effacer un blocage sans preuve de résolution.
- Mettre à jour `updated_at` après une évolution réellement observée.
- Incrémenter `state_version` lorsqu'une mise à jour est enregistrée.
