# Contrat des sources de vérité

## Objectif

Éviter que le brief, la configuration, le backlog et les réponses des assistants se contredisent silencieusement.

Le workspace possède trois sources de vérité principales :

1. `PROJECT_BRIEF.md` pour le produit accepté ;
2. `project.yaml` pour la configuration mécanique ;
3. `PROJECT_STATE.md` pour l'état opérationnel courant.

## 1. `PROJECT_BRIEF.md`

### Contient

- le problème et la cible ;
- la valeur attendue ;
- les résultats et critères de succès ;
- le MVP inclus ;
- les exclusions ;
- les parcours critiques ;
- les règles métier ;
- les exigences non fonctionnelles ;
- les contraintes imposées ;
- les risques et inconnues acceptés.

### Ne contient pas

- les chemins locaux ;
- les commandes de build ou de test ;
- la phase active ;
- la prochaine tâche ;
- les préférences d'un assistant ;
- les détails d'implémentation non imposés par le produit.

### Autorité

Le brief ne devient contraignant que lorsque son frontmatter porte `status: approved` avec une personne et une date d'approbation.

Un assistant peut préparer ou corriger un brouillon. Il ne peut jamais s'attribuer l'approbation humaine.

Toute modification de fond après approbation doit :

1. repasser le brief en `draft` ou créer une nouvelle version ;
2. expliquer le changement dans `docs/decisions.md` ;
3. être approuvée humainement ;
4. déclencher la réévaluation du backlog, des critères et de l'état.

## 2. `project.yaml`

### Contient

- l'identité technique ;
- les chemins ;
- le mode d'entrée ;
- le profil ;
- les adaptateurs et leurs versions ;
- les skills installés, leurs versions et l'empreinte de leur source ;
- les commandes réellement disponibles ;
- les politiques d'autorité et de confidentialité ;
- les versions nécessaires aux migrations.

### Ne contient pas

- la proposition de valeur ;
- les fonctionnalités du MVP ;
- les règles métier ;
- la tâche active ;
- les résultats de tests ;
- des secrets ou valeurs de production.

### Autorité

Le CLI peut modifier les champs mécaniques lorsqu'une commande explicite le demande. Un assistant peut proposer un changement, mais ne doit pas inventer une commande, un profil ou un chemin.

Tout secret est interdit dans ce fichier.

## 3. `PROJECT_STATE.md`

### Contient

- le stade ;
- la phase et la tâche courantes ;
- l'objectif immédiat ;
- la version du backlog approuvé (`plan_version`), si `project-plan` a atteint `PLAN_READY` ;
- les décisions attendues ;
- les blocages ;
- la dernière vérification ;
- la prochaine action recommandée.

### Ne contient pas

- une copie du brief ;
- une documentation technique complète ;
- l'historique détaillé des décisions ;
- des résultats de recherche exhaustifs ;
- des secrets.

### Autorité

Le fichier peut être mis à jour après une action réellement observée. Une tâche ne peut pas être déclarée terminée sur la base d'une intention, d'un plan ou d'une réponse non vérifiée.

`PROJECT_STATE.md` est un résumé de reprise, pas une preuve. Les preuves restent dans les rapports, les tests, Git et les documents spécialisés.

## 4. Documents spécialisés

Les documents suivants complètent les sources principales :

- `docs/decisions.md` : historique des décisions ;
- `docs/architecture.md` : architecture technique acceptée ;
- `docs/workflow.md` : détails des parcours et règles ;
- `docs/recette.md` : critères et résultats de vérification ;
- `docs/agent-strategy.md` : mode d'exécution recommandé par responsabilité, voir `core/contracts/planning.md` ;
- `taches/BACKLOG.md` : fichier canonique unique de la roadmap par phases, des résultats `BLG-NNN`, des tâches `TSK-NNN` et de la progression, voir `core/contracts/planning.md`. Son frontmatter fait autorité ; le bloc `backlog:roadmap` de son corps est une **projection générée**, jamais une source — il est régénéré par `ai-project backlog sync-view` et le Doctor bloque s'il diverge ;
- `taches/WORK-NNN.md` : contrat et état de chaque unité de travail, et **unique propriétaire** du lien `realizes` vers les tâches du backlog ;
- `docs/internal/backlog-history/BACKLOG-v<N>.md` : historique de workflow du backlog, écrit en création exclusive par `ai-project backlog revise` avant chaque évolution substantielle. Ce n'est pas une preuve infalsifiable : il enregistre ce que le workflow officiel a fait ;
- `taches/lecons.md` : règles apprises et réutilisables ;
- `reports/work/WORK-NNN.md` : preuves de réalisation et de revue ;
- `livraisons/SHIP-NNN.md` : contrat, cible, autorité et état d'une livraison ;
- `reports/ship/SHIP-NNN.md` : portes, exécution et preuves d'une livraison ;
- `intake/` : matières premières et preuves de découverte ;
- `prototype/` : artefacts de conception.

Ils doivent référencer le brief ou la décision concernée au lieu d'en recopier les sections.

## 5. Ordre de résolution des conflits

En cas de contradiction :

1. obligations légales, sécurité et politiques gérées ;
2. décision humaine acceptée et journalisée ;
3. dernière version approuvée de `PROJECT_BRIEF.md` ;
4. `project.yaml` pour les faits mécaniques ;
5. résultats observables dans le code, Git et les contrôles ;
6. documents spécialisés ;
7. `PROJECT_STATE.md` ;
8. suggestion ou mémoire d'un assistant.

Le conflit doit être signalé. Aucun fichier ne doit être réécrit silencieusement pour donner l'illusion d'une cohérence.

## 6. Règle de mise à jour

Chaque modification doit préciser :

- la source observée ;
- le fichier propriétaire de l'information ;
- la raison du changement ;
- l'autorité nécessaire ;
- les documents dérivés à réévaluer ;
- la vérification effectuée.
