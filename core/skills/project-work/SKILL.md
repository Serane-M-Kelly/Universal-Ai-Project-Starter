---
name: project-work
description: "Cadrer, faire approuver, réaliser, vérifier et présenter à l'acceptation une unité de travail logicielle bornée : fonctionnalité, correction, maintenance, documentation ou amélioration technique. Déclare les tâches TSK-NNN du backlog qu'elle réalise, coche ces tâches contre des preuves, et enregistre l'acceptation humaine du résultat. Utiliser après un setup prêt pour implémenter une tâche reliée au brief, sur un dépôt adopté avec une demande explicite, ou pour convertir les liens historiques d'un backlog migré. Ne pas utiliser pour un projet entier, une demande encore ambiguë, une simple exploration, l'approbation du brief, le setup, le déploiement ou la publication."
---

# Project Work

Produire un changement minimal, traçable et vérifié. Séparer le cadrage, l'autorisation, l'implémentation, la revue et l'acceptation afin qu'aucun état ne soit déduit d'une intention.

## Vérifier les préconditions

- Lire `project.yaml`, `PROJECT_BRIEF.md`, `PROJECT_STATE.md`, l'architecture, le dernier rapport de setup, `taches/BACKLOG.md` s'il existe, et les décisions pertinentes.
- Exécuter `ai-project doctor` et traiter tout verdict `BLOCKED` comme bloquant.
- Pour les modes `idea` et `brief`, exiger le brief approuvé correspondant à l'état, un setup `SETUP_READY` ou un avertissement explicitement accepté, **et** `PLAN_READY` (`taches/BACKLOG.md` et `docs/agent-strategy.md` tous deux `status: approved`, `PROJECT_STATE.md.plan_version` renseigné) — sauf procédure de travail urgent non planifié ci-dessous.
- Pour les modes `existing` et `maintenance`, exiger une demande actuelle explicite et une base de travail suffisamment vérifiée. `PLAN_READY` n'est pas requis dans ces modes.
- Une unité créée en mode `idea` ou `brief` avec un plan `PLAN_READY` déclare dans `realizes` les `TSK-NNN` d'un `BLG` `ready` de `taches/BACKLOG.md`. Ce lien vit **uniquement** dans l'unité : le backlog ne le duplique jamais.
- Ne jamais écrire l'état d'un `BLG`, d'une phase ou d'une tâche : ces états sont **calculés**. L'approbation de l'unité fait basculer le résultat en `in_progress` toute seule.
- Inspecter l'état Git avant toute modification et distinguer les changements préexistants de ceux de l'unité.
- Ne jamais utiliser ce skill pour « construire tout le projet » en une seule tâche.

### Convertir les liens historiques d'un backlog migré (`legacy-link-conversion`)

Route **strictement bornée**, disponible **avant `PLAN_READY`**, uniquement pour dénouer la migration v1 → v2 : `PLAN_READY` exige des `legacy_work_items` convertis, et les convertir exige d'écrire `realizes` sur une unité existante.

Conditions d'entrée, toutes obligatoires :

1. `taches/BACKLOG.md` est en `schema_version: 2` et contient au moins un `legacy_work_items` non converti ;
2. les `TSK` du `BLG` concerné ont **déjà** été créées par `project-plan` — sinon s'arrêter et le demander ;
3. présenter à la personne humaine la correspondance proposée `WORK-NNN → TSK-NNN`, résultat par résultat ;
4. obtenir sa confirmation explicite.

Ce que la conversion modifie, et rien d'autre :

- `title` de l'unité, **seulement s'il est absent** ;
- `realizes` ;
- `cross_cutting` et sa section de justification, si les tâches traversent plusieurs résultats ;
- `legacy_work_items` du résultat, **retiré uniquement une fois `realizes` réellement écrit**.

Ce que la conversion ne fait jamais : modifier `status`, `approved_by`, `approved_at`, le résultat attendu, le périmètre, les critères d'acceptation ou toute autre clause contractuelle de l'unité ; cocher une tâche ; commencer une implémentation ; approuver quoi que ce soit.

Terminer par `ai-project backlog sync-view` puis `ai-project doctor`. Tant qu'un `legacy_work_items` reste présent, le Doctor refuse `PLAN_READY`. La route officielle ne retire ce lien qu'après avoir réellement écrit le `realizes` correspondant.

**Portée exacte de cette limite.** Le CLI et le Doctor vérifient l'**état courant** : liens historiques encore présents, documents `WORK` lisibles et valides, tâches référencées existantes et vue générée cohérente. Sans historique externe, une suppression coordonnée de `legacy_work_items` et de son lien `realizes` n'est pas détectable après coup. L'interdiction de commencer une implémentation pendant cette route est portée par **ce skill**, c'est-à-dire par la gouvernance de l'assistant — ce n'est pas un verrou d'exécution système. Ne jamais la présenter comme une impossibilité mécanique.

Cette route reste une exception de migration : elle n'autorise en aucun cas à utiliser `project-work` avant `PLAN_READY` pour construire.

### Travail urgent non planifié

Sans `PLAN_READY`, une personne humaine peut malgré tout autoriser explicitement une unité urgente en mode `idea` ou `brief`. Déclarer `unplanned_urgent: true` sur l'unité — c'est cette métadonnée structurée, et jamais une phrase, qui atteste la voie d'urgence — documenter dans `source_request` l'autorité qui contourne l'exigence de plan, signaler dans `PROJECT_STATE.md` que le backlog reste à réconcilier, puis **réconcilier le backlog avant l'approbation de la prochaine unité non urgente** (voir `core/skills/project-plan/references/plan-gates.md`). Cette procédure ne remplace jamais l'approbation propre de l'unité elle-même.

## Créer une unité bornée

Attribuer le prochain identifiant libre au format `WORK-001` et créer `taches/WORK-001.md` depuis `assets/work-item-template.md`.

Renseigner `title` (libellé court affiché dans la roadmap) et `realizes` : le sous-ensemble des `TSK` d'un seul `BLG` que cette unité entreprend. Les tâches doivent appartenir au **même** résultat ; si elles en traversent plusieurs, découper l'unité, ou déclarer `cross_cutting: true` avec une section `## Justification du lot transversal` réellement rédigée — un titre seul ou le texte à remplacer du modèle est refusé. Un `realizes` vide n'est acceptable qu'en mode `existing`/`maintenance` ou par la voie d'urgence documentée.

Définir un seul résultat observable avec :

- origine et version du brief ou de la demande ;
- contexte et comportement actuel ;
- résultat attendu ;
- inclusions et exclusions ;
- critères d'acceptation vérifiables ;
- cas limites et risques ;
- stratégie de vérification ;
- retour arrière applicable ;
- dépendances ou décisions bloquantes.

Découper l'unité si elle combine plusieurs résultats indépendants, traverse trop de responsabilités ou ne peut pas être vérifiée isolément. **Découper l'unité, jamais élargir le `BLG`** : un résultat plus large que prévu est un changement substantiel du plan, pas un ajustement d'unité.

Créer l'unité avec `status: proposed`. Une demande humaine actuelle compte comme approbation seulement si elle désigne clairement le résultat, le périmètre et l'autorisation de modifier. Sinon, présenter le contrat et attendre une approbation explicite avant de coder.

Après approbation, renseigner `approved_by`, `approved_at` et `status: approved`, puis mettre à jour `PROJECT_STATE.md`, exécuter `ai-project backlog sync-view` et relancer `ai-project doctor`. Une approbation conditionnelle conserve l'état `proposed` jusqu'à intégration des conditions.

Si cette unité est la première d'une phase encore non préparée, la même approbation humaine peut aussi renseigner `phases[].prepared_by` / `prepared_at` : un seul échange suffit pour la préparation de phase et l'approbation de l'unité.

## Construire le plan d'exécution

Inspecter uniquement les zones pertinentes du code, les conventions locales et les tests voisins. Établir :

1. le comportement de référence ;
2. la plus petite modification cohérente ;
3. les fichiers susceptibles d'être touchés ;
4. les tests à ajouter ou adapter ;
5. les contrôles à exécuter ;
6. les conditions d'arrêt.

Passer à `in_progress` uniquement au début d'une mutation réelle. Un plan ou une analyse ne constitue pas un travail commencé.

## Réaliser le changement

- Préserver les modifications préexistantes et les conventions du dépôt.
- Implémenter le chemin le plus simple qui satisfait les critères acceptés.
- Éviter les refactorings, dépendances, abstractions et nettoyages non requis.
- Ajouter les tests au niveau le plus proche du comportement modifié.
- Gérer les états vides, erreurs et cas limites annoncés par l'unité.
- Mettre à jour la documentation uniquement lorsqu'elle est affectée.
- Ne jamais placer de secret dans le code, les fixtures, les rapports ou les logs.

### Cocher les tâches contre des preuves

Cocher une `TSK` uniquement quand sa preuve existe réellement : ajouter une entrée `state: valid` dans son `evidence_log`, avec `kind`, `ref`, `recorded_at`, et un `observed_by` nommé pour toute `observation`. Une tâche `category: human` ne peut être validée **que** par une observation humaine nommée : ne jamais la cocher au nom de la personne.

Le journal est **append-only** et ses états sont **monotones**. Une réouverture passe l'entrée courante à `superseded` (preuve remplacée) ou `invalidated` (preuve fausse), avec motif et date ; elle n'efface jamais rien, et l'état de la tâche revient seul à `todo`.

Ces deux états sont **terminaux** : ne jamais repasser une preuve écartée à `valid`, ni modifier son `kind`, sa `ref` ou son `recorded_at`. Une preuve nouvelle reçoit un **nouvel identifiant** `EV-NNN` pris sur `id_allocation.next_evidence`. Le Doctor vérifie la cohérence de l’état courant ; il ne détecte pas une réécriture coordonnée de l’historique.

Si l'invalidation retire la démonstration d'un résultat déjà accepté, effacer aussi son acceptation (`outcome_accepted_by`/`_at`) : le résultat n'est plus démontré.

### Déclarer une tâche découverte

Une action technique nécessaire mais non prévue s'ajoute au **même** `BLG` avec `origin: discovered`, `source_work`, `origin_reason`, `added_at`, et une mention de son identifiant dans `reports/work/WORK-NNN.md`. Cette **élaboration opérationnelle** n'incrémente pas `backlog_version` et n'invalide pas l'approbation du plan.

Elle est interdite si elle change le résultat, la sécurité, les critères ou le périmètre autorisé, si elle vise un autre `BLG` que celui de l'unité, ou si le résultat est déjà `built` ou `done` — ce sont alors des changements substantiels relevant de `project-plan`.

Appliquer `external_actions`, `destructive_actions` et `commits` avant les actions concernées. Le déploiement et la publication restent réservés à `project-ship`.

Si un Builder est disponible, lui transmettre seulement l'unité approuvée, les chemins nécessaires et les contrôles attendus. Son utilisation ne modifie ni le périmètre ni l'autorité. Le skill doit aussi fonctionner sans agent spécialisé.

## Vérifier avec des preuves

Charger `references/work-gates.md` et choisir une profondeur proportionnée au risque.

Exécuter :

1. les tests directement liés ;
2. les contrôles statiques applicables ;
3. les tests plus larges nécessaires pour détecter une régression ;
4. le build ou contrôle d'intégration applicable ;
5. `ai-project doctor` ;
6. l'inspection finale du diff et de l'état Git.

Enregistrer dans `reports/work/WORK-001.md`, créé depuis `assets/work-report-template.md`, la commande exacte, le résultat, le statut et toute vérification non exécutée.

Ne pas déclarer un succès sur la base d'un code plausible, d'un test prévu ou d'une sortie résumée sans preuve. Un échec préexistant doit être démontré par une base de comparaison et reste visible.

## Effectuer une revue séparée

Relire l'unité approuvée et le diff sans s'appuyer sur l'intention d'implémentation. Chercher d'abord :

- comportement incorrect ou critère non satisfait ;
- régression, perte de données ou vulnérabilité ;
- cas limite oublié ;
- test trompeur ou insuffisant ;
- changement hors périmètre ;
- documentation ou contrat devenu faux.

Si un Independent Reviewer est disponible, l'utiliser pour une passe indépendante lorsque le risque ou l'ampleur le justifie. Sinon effectuer une auto-revue clairement nommée comme telle ; ne jamais la présenter comme indépendante.

Corriger les constats bloquants ou majeurs, puis réexécuter les contrôles affectés. Conserver les constats non résolus avec leur impact et leur autorité d'acceptation.

## Séparer les états de fin

Appliquer la machine d'état décrite dans `references/work-gates.md` :

- `ready_for_review` : implémentation terminée, vérification encore en cours ;
- `ready_for_acceptance` : critères satisfaits, preuves disponibles, revue terminée ;
- `accepted` : personne humaine identifiée ayant accepté le résultat ;
- `blocked` : obstacle explicite avec condition de reprise.

Ne jamais passer directement de `in_progress` à `accepted`. Un test réussi n'est pas une acceptation humaine. Une acceptation assortie d'une correction conserve `ready_for_acceptance` ou revient à `in_progress`.

Après acceptation explicite, renseigner `accepted_by` et `accepted_at`, mettre à jour `PROJECT_STATE.md`, exécuter `ai-project backlog sync-view` et relancer `ai-project doctor`, puis identifier l'unité suivante ou `project-ship`. Ne créer un commit que sur demande explicite et selon la politique.

### Acceptation du résultat du `BLG`

Distincte de l'acceptation de l'unité. Quand toutes les tâches obligatoires du résultat sont terminées, celui-ci devient `built` **tout seul** — ne rien écrire. Il ne devient `done` que lorsqu'une personne constate le résultat observable et que `outcome_accepted_by` / `outcome_accepted_at` sont renseignés.

Quand le résultat n'a qu'une unité et que son acceptation démontre déjà le résultat, le même échange humain produit les deux enregistrements. Ne jamais écrire l'acceptation du résultat tant qu'une unité réalisant ses tâches est encore active : le Doctor bloque ce cas.

## Restituer l'unité

Terminer par :

1. l'identifiant et le résultat réalisé ;
2. les fichiers modifiés ;
3. les contrôles exécutés et leurs résultats ;
4. le type de revue effectué et ses constats ;
5. l'état exact de l'unité, les tâches cochées avec leur preuve, et l'état calculé du résultat (`in_progress`, `built` ou `done`) ;
6. les limites ou risques restants ;
7. l'acceptation ou la décision humaine encore attendue.

Ne pas annoncer la tâche comme terminée si elle est seulement prête pour acceptation.
