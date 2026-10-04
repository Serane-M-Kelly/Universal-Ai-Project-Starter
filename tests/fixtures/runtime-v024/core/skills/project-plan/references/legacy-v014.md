---
name: project-plan
description: "Transformer un socle SETUP_READY (ou SETUP_WARNING explicitement accepté) en roadmap de construction par phases : phases, résultats BLG-NNN à un seul résultat observable, tâches TSK-NNN cochables adossées à des preuves, et stratégie d'agents alignée. Détailler la prochaine phase de réalisation sans inventer les tâches des phases lointaines, intégrer sans les modifier les unités WORK-NNN déjà proposées, et obtenir une validation humaine explicite des deux documents avant toute réalisation. Utiliser après project-setup et avant la première unité project-work sur un projet idea ou brief, où il est obligatoire ; disponible mais optionnel sur un projet existing ou maintenance. Ne pas utiliser pour écrire du code, choisir l'architecture, approuver une unité de travail, cocher une tâche sans preuve, ni installer ou activer un agent."
---

# Project Plan

Transformer un socle technique prêt en roadmap de construction lisible au quotidien, sans jamais approuver silencieusement une réalisation. `taches/BACKLOG.md` est le fichier canonique unique : roadmap par phases, backlog priorisé, checklist de construction, carte des unités et état de progression.

## Le modèle à quatre niveaux

```text
Phase       grande étape cohérente de construction        état entièrement CALCULÉ
└── BLG     un seul résultat observable                   stage + disposition + acceptation stockés
    ├── TSK une action concrète et cochable               disposition stockée, état CALCULÉ des preuves
    └── WORK unité approuvée déclarant `realizes: [TSK…]` approbation humaine
```

Deux actes humains, à ne jamais confondre :

- **approuver** une unité `WORK-NNN` autorise à construire (`project-work`) ;
- **accepter le résultat** d'un `BLG` (`outcome_accepted_by` / `outcome_accepted_at`) constate qu'il est atteint.

Une `TSK` n'est jamais soumise à approbation. Elle se coche parce qu'une preuve existe, jamais parce qu'une personne l'a autorisée.

## Ne jamais écrire un état calculé

Ces états sont dérivés par le CLI et le Doctor. Toute tentative de les stocker est une erreur :

| Niveau | Stocké | Calculé |
|---|---|---|
| Phase | `disposition` (`active`/`retired`), `prepared_by`, `prepared_at` | `empty`, `optional`, `not_started`, `in_progress`, `complete` |
| `BLG` | `stage` (`candidate`/`ready`), `disposition`, `outcome_accepted_*` | `candidate`, `ready`, `in_progress`, `built`, `done`, `deferred`, `retired` |
| `TSK` | `disposition` (`active`/`blocked`/`dropped`), `evidence_log` | `todo`, `done`, `blocked`, `dropped` |

Un `BLG` est `built` quand toutes ses tâches obligatoires sont terminées et que le résultat n'est pas encore accepté ; `done` seulement après acceptation humaine. La progression de **construction** ne se confond jamais avec la validation du **résultat**.

## Vérifier les préconditions

- Lire `project.yaml`, `PROJECT_BRIEF.md` (approuvé), `PROJECT_STATE.md`, `docs/decisions.md`, `docs/architecture.md`, `reports/setup-report.md`.
- Exécuter `ai-project doctor` ; traiter tout `BLOCKED` comme bloquant.
- Exiger `SETUP_READY`, ou un `SETUP_WARNING` explicitement accepté et référencé dans `docs/decisions.md`.
- Pour `idea` et `brief` : cette étape est obligatoire avant toute unité `project-work`. Pour `existing` et `maintenance` : optionnelle.
- Recenser sans les modifier tous les `taches/WORK-NNN.md` présents, quel que soit leur statut.
- Si `taches/BACKLOG.md` est encore en `schema_version: 1`, exécuter d'abord `ai-project backlog migrate`, puis reprendre ci-dessous. Ne jamais convertir la structure à la main.

## Construire la roadmap

Créer ou réviser `taches/BACKLOG.md` depuis `assets/backlog-template.md`.

### 1. Définir les phases

Proposer l'arc complet (3 à 7 phases) et recueillir une réaction **avant** d'écrire des dizaines de tâches. C'est un temps d'échange, pas une porte d'approbation supplémentaire.

Chaque phase reçoit un identifiant pris sur `id_allocation.next_phase`, un titre orienté résultat produit, et un `goal` d'une ligne.

### 2. Reconstituer la phase 0 historique

Lire `reports/setup-report.md`, `docs/decisions.md` et `docs/architecture.md`, et créer une phase de socle dont les tâches sont **déjà cochées avec leur preuve historique** (`kind: report` vers le rapport de setup, `kind: decision` vers une décision). Son `BLG` porte l'acceptation de la personne qui a validé le setup. La roadmap commence ainsi par du travail réellement accompli.

### 3. Recenser tous les résultats

Extraire les `BLG` du MVP inclus, des risques et des dépendances (`PROJECT_BRIEF.md` §5 et §12, `docs/decisions.md`). Les recenser **tous**, ordonnés, même ceux qui ne seront pas détaillés maintenant.

Règles de granularité d'un `BLG` :

- **plafond** : si deux résultats peuvent être constatés séparément, ce sont deux `BLG`. Un titre qui joint deux capacités par « et » signale un découpage manquant.
- **plancher** : *« la personne responsable pourrait-elle le constater elle-même sans lire le code ? »* Si non, ce n'est pas un `BLG` : c'est une `TSK`.
- un découpage **prévisible aujourd'hui** s'écrit aujourd'hui, jamais « plus tard, pendant le travail ».

### 4. Détailler progressivement

| Portée | Détail attendu |
|---|---|
| Toutes les phases | définies : identifiant, titre, `goal`, ordre |
| Tous les `BLG` significatifs | recensés, ordonnés, avec phase, ordre, priorité, dépendances et récit |
| Phase 0 historique | entièrement détaillée, cochée avec ses preuves |
| Prochaine phase de réalisation | entièrement détaillée : tous ses `BLG` en `ready` avec leurs `TSK` |
| Phase suivante | facultativement partiellement détaillée |
| Toutes les autres | `stage: candidate`, `tasks: []` — c'est normal et silencieux |

**Ne jamais inventer les tâches d'une phase lointaine.** Un `BLG` `candidate` sans tâche est l'état attendu ; il ne produit aucun avertissement.

Un `BLG` ne passe à `stage: ready` que lorsqu'il possède : un résultat défini, ses dépendances, **au moins une tâche obligatoire**, et un découpage suffisant pour créer une unité.

### 5. Écrire les tâches

Une `TSK` est une action concrète qu'on saurait décrire dans un message de commit. Lui attribuer une `category` parmi `product`, `ux`, `tech`, `architecture`, `data`, `security`, `quality`, `docs`, `delivery`, `human`, et un caractère obligatoire ou optionnel.

La catégorie `human` est réservée aux vérifications physiques et aux jugements qu'aucun agent ne peut produire. Le Doctor refuse de considérer une telle tâche terminée autrement que par une preuve `kind: observation` portant un `observed_by` nommé.

### 6. Ordre et dépendances

- L'ordre des phases est **l'ordre du tableau `phases`**. Aucun rang global.
- `order` est unique **à l'intérieur d'une phase**.
- Une dépendance ne peut pointer que vers un `BLG` d'une phase antérieure, ou d'`order` inférieur dans la même phase. Déplacer une phase ne renumérote donc rien.

### 7. Régénérer la vue

Exécuter `ai-project backlog sync-view`, puis `ai-project doctor`. **Ne jamais rédiger ni corriger le bloc de roadmap à la main** : il est une projection du frontmatter et des unités, régénérée et comparée octet à octet.

`sync-view` valide le document, contrôle la structure des marqueurs **et le rendu produit**, puis n'écrit qu'ensuite — en conservant le frontmatter et le récit octet à octet, commentaires et fins de ligne compris. Rien n'est réécrit lorsque le rendu est déjà identique. Ne jamais recopier un marqueur de bloc dans un titre, un objectif, un motif ou une identité.

Une évolution **substantielle** passe par `ai-project backlog revise` : elle archive l'état courant validé, incrémente la version, efface l'approbation et régénère la vue. Ne jamais incrémenter `backlog_version` à la main.

## Stabilité des identifiants

Dans le workflow géré, un identifiant n'est jamais recyclé ni réattribué à autre chose.

- Tout nouvel identifiant est pris sur `id_allocation` (`next_phase`, `next_item`, `next_task`, `next_evidence`), qui est ensuite incrémenté. Ces compteurs ne reculent jamais.
- **Ne réserver aucun identifiant à l'avance** : le compteur avance au moment de la création, pas en prévision.
- Aucun identifiant ne disparaît du fichier : un résultat sans objet passe `disposition: retired`, une tâche passe `disposition: dropped`. On ne supprime pas, on retire.
- Le Doctor vérifie l'unicité, le format, le compteur et les filiations **dans l'état courant**. Il ne compare pas à un état antérieur : une édition directe et coordonnée du backlog et de ses compteurs n'est pas détectable sans historique externe (`core/contracts/planning.md` §6bis).
- **Découpage** : au plus un successeur conserve l'identifiant d'origine, et seulement s'il porte le résultat dominant — celui que le titre d'origine nomme en premier et qui porte sa source et son risque. Tous les autres reçoivent des identifiants neufs et déclarent `derived_from: [<origine>]`. Le titre conservé peut être **réduit**, jamais remplacé par un résultat sans filiation.

## Construire la stratégie d'agents

Créer ou réviser `docs/agent-strategy.md` depuis `assets/agent-strategy-template.md`.

`covers` désigne des **phases** (`PH-N`) ou des **résultats** (`BLG-NNN`). Couvrir par phase est le choix par défaut ; descendre au résultat seulement quand un résultat précis mérite un mode différent. Le schéma n'admet pas `TSK-` : il est structurellement impossible de recommander un agent par micro-tâche.

Choisir le mode le plus proportionné : conversation principale, skill ou profil existant, agent du noyau (`builder`, `independent-reviewer` — vérifier leur disponibilité via `ai-project agent list`, jamais une liste mémorisée), ou agent personnalisé. Le Builder intervient sur un `WORK` approuvé ; l'Independent Reviewer seulement lorsque le risque, la sécurité ou l'importance du résultat le justifient.

La section « Responsabilités volontairement sans agent » doit couvrir explicitement toutes les tâches `category: human` et l'acceptation des résultats.

Une recommandation `custom_agent` peut précéder l'existence de `agents/<id>/`. Ne jamais appeler `agent add`, `agent create` ou `agent sync` depuis ce skill.

## Ne jamais franchir ces limites

- Aucun code applicatif, aucune modification de `code_root` au-delà de la lecture.
- Aucun commit, push, déploiement ou publication.
- Aucune installation, création ou activation d'agent.
- **Aucune tâche cochée sans preuve réellement enregistrée**, et aucune preuve `observation` sans personne nommée.
- Aucune preuve `superseded` ou `invalidated` remise à `valid`, ni aucun contenu de preuve enregistrée modifié : une preuve nouvelle prend un nouvel identifiant. Cette discipline relève du skill, que le Doctor ne peut pas vérifier rétrospectivement.
- Aucune date factice : toute date est une date calendaire réelle.
- Aucun changement substantiel (résultat, titre, phase, ordre, priorité, dépendances, caractère obligatoire) sans passer par `ai-project backlog revise`.
- **Aucune acceptation de résultat écrite sans décision humaine explicite.**
- Aucune suppression, réécriture ou approbation implicite d'un `WORK-NNN` existant, ni écriture de son `realizes` — cela appartient à `project-work`.
- Aucun état calculé écrit dans le frontmatter.

## Vérifier et faire approuver

Consulter `references/plan-gates.md` pour les portes complètes, les quatre catégories de changement et la procédure de travail urgent.

Verdicts : `PLAN_DRAFT`, `READY_FOR_PLAN_APPROVAL`, `CHANGES_REQUIRED`, `PLAN_READY`, `BLOCKED`.

Présenter comme synthèse **le bloc de roadmap généré lui-même** : il ne peut pas mentir sur le contenu. Demander une décision explicite portant sur la version examinée des deux documents. Une approbation partielle ne produit pas `PLAN_READY`.

`PLAN_READY` est en outre refusé tant qu'un `legacy_work_items` n'est pas converti : utiliser la route `legacy-link-conversion` de `project-work`.

Après approbation des deux documents : renseigner `plan_version` dans `PROJECT_STATE.md` avec le `backlog_version` approuvé, définir `project-work` comme prochaine étape, relancer `ai-project doctor`.

## Préparer une phase ultérieure

Faire passer les `BLG` d'une phase de `candidate` à `ready` en écrivant leurs `TSK`, sans toucher au résultat, à la phase, aux dépendances, à la priorité, au caractère obligatoire ni aux critères généraux.

Cette **préparation de phase** n'incrémente pas `backlog_version` et n'efface pas l'approbation du plan. Elle demande une confirmation humaine légère, enregistrée dans `phases[].prepared_by` / `prepared_at`. Cette confirmation peut être **fusionnée avec l'approbation du premier `WORK` de la phase** : un seul échange humain suffit à renseigner la préparation et à approuver l'unité.

## Restituer le plan

Terminer par :

1. les phases définies et celles réellement détaillées ;
2. les résultats créés, découpés (avec leur filiation) ou intégrés depuis un `WORK-NNN` existant ;
3. les deux progressions : construction et résultats ;
4. la stratégie d'agents et les responsabilités volontairement sans agent ;
5. le verdict ;
6. la décision humaine enregistrée, ou l'autorité encore attendue ;
7. les fichiers modifiés ;
8. la prochaine étape autorisée.

Ne jamais annoncer `project-work` comme autorisé pour les modes `idea` et `brief` si le plan n'est pas `PLAN_READY`.
