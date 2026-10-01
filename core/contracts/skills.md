# Contrat des skills universels

## Objectif

Un skill décrit une procédure réutilisable et bornée. Il ne représente ni une personnalité, ni une équipe fictive, ni une permission supplémentaire.

Chaque procédure possède une seule source modifiable dans un projet équipé :

```text
ai-workspace/
├── skills/<skill-id>/              # source canonique du projet
├── .agents/skills/<skill-id>/      # copie générée pour Codex
└── .claude/skills/<skill-id>/      # copie générée pour Claude Code
```

Les copies propres aux assistants ne doivent pas être modifiées directement. `ai-project skill sync` les régénère depuis `skills/<skill-id>/`, et `ai-project doctor` détecte toute divergence.

## Structure minimale

Un skill universel contient :

- `SKILL.md`, avec uniquement `name` et `description` dans son frontmatter ;
- `agents/openai.yaml`, pour son affichage et son invocation dans Codex ;
- uniquement les `references/`, `scripts/` ou `assets/` réellement nécessaires.

La description indique à la fois ce que fait le skill, quand l'utiliser et, si le risque de confusion existe, quand ne pas l'utiliser.

## Responsabilités

Le skill peut :

- définir une procédure, des portes de contrôle et un format de restitution ;
- lire les sources de vérité nécessaires ;
- modifier les fichiers autorisés par sa procédure et par la demande ;
- demander une décision humaine lorsque l'autorité manque.

Le skill ne peut pas :

- étendre les permissions de l'assistant ;
- contourner `project.yaml` ou les instructions du projet ;
- s'attribuer une approbation humaine ;
- effectuer une action externe simplement parce que la procédure la mentionne ;
- déclarer une vérification réussie sans preuve reproductible.

## Catalogue et versions

`core/skills/catalog.yaml` est le catalogue livré par le starter. Il associe chaque identifiant à une version, une source et ses modes d'entrée compatibles sans recopier les instructions de `SKILL.md`.

Dans un workspace, `project.yaml` enregistre :

- l'identifiant installé ;
- la version du contrat ;
- l'empreinte de la source canonique au dernier déploiement vers les adaptateurs.

Une modification locale du skill est permise dans `skills/<skill-id>/`. Elle devient active pour les assistants seulement après `ai-project skill sync`.

### `starter_version` versus version d'un skill

Ce sont deux niveaux distincts, jamais interchangeables :

- **`project.yaml.starter_version`** est le niveau de compatibilité de l'ensemble du workspace avec le starter. Il ne progresse que lorsque `ai-project skill upgrade --all` a mis à niveau, sans aucun échec, tous les skills installés vers la version que fournit le starter actuel — y compris quand ils étaient déjà tous à jour mais que `starter_version` restait en retard. Une mise à niveau partiellement échouée laisse `starter_version` inchangé.
- **La version d'un skill** (`project.yaml.skills[].version`) est locale à ce seul skill. `ai-project skill upgrade <id>` la fait progresser indépendamment et ne doit jamais être utilisée pour annoncer que le workspace entier est à niveau : elle ne touche jamais `starter_version`.

En pratique, `starter_version` répond à « ce workspace peut-il être considéré à jour vis-à-vis du starter ? » ; la version d'un skill répond à « cette procédure précise est-elle à jour ? ». Le Doctor peut bloquer sur la seconde (`SKILL_VERSION`) sans que la première ait besoin d'être vérifiée séparément — elle reste déclarative, à l'usage de l'utilisatrice et des outils de migration.

## Sélection

Un skill est installé lorsque sa procédure est utile au parcours réel, pas par anticipation.

- `idea` ou `brief` incomplet : `project-discover` ;
- brief prêt à faire approuver : `project-handoff` ;
- environnement à préparer : `project-setup` ;
- socle prêt, backlog et stratégie d'agents nécessaires : `project-plan` ;
- unité de travail approuvée : `project-work` ;
- vérification et livraison : `project-ship`.

`project-plan` est obligatoire après le setup pour les modes `idea` et `brief` avant la première unité `project-work` ; il reste optionnel, mais disponible, pour les modes `existing` et `maintenance`. Voir `core/contracts/planning.md`.

L'invocation explicite reste possible. L'activation implicite dépend exclusivement de la description du skill et des capacités de l'assistant.

## Mise à jour sûre

La source du projet appartient à l'utilisatrice. Le CLI refuse de l'écraser lors d'une réinstallation.

La synchronisation remplace une copie d'adaptateur seulement si :

1. elle correspond encore à la dernière empreinte connue ; ou
2. l'utilisatrice demande explicitement une synchronisation forcée.

Si la source et une copie ont été modifiées séparément, le conflit est signalé avant tout remplacement.

## Mise à niveau après une évolution du starter

Quand le starter fait évoluer le contrat d'un skill (nouvelle version dans `core/skills/catalog.yaml`), un workspace existant reste bloqué (`SKILL_VERSION`) tant qu'il n'a pas été mis à niveau explicitement :

- `ai-project skill upgrade <id> [workspace]` met à niveau un seul skill ;
- `ai-project skill upgrade --all [workspace]` met à niveau tous les skills installés et, seulement si aucune mise à niveau n'a échoué, aligne `starter_version` sur la version courante du starter.

Comme pour `skill sync`, une source ou une copie modifiée séparément par l'utilisatrice n'est jamais écrasée sans `--force` explicite. La mise à niveau compare les empreintes avant tout remplacement, met à jour la source privée, les copies d'adaptateurs et `project.yaml` de manière séquentielle et vérifiable, et préserve l'état déjà mis à niveau si une étape ultérieure échoue.
