# Architecture cible

## 1. Séparation générale

```text
ai-project-starter/
├── core/
├── profiles/
├── adapters/
├── cli/
├── tests/
└── docs/
```

Le dépôt du starter contient les sources permettant de générer ou d'équiper un workspace. Il ne doit pas être copié intégralement avec son historique Git.

## 2. Core

`core/` contiendra les éléments indépendants de la stack et de l'assistant :

- schémas ;
- modèles des sources de vérité ;
- règles de gouvernance ;
- contrats des skills ;
- contrats des agents ;
- politiques de sécurité ;
- formats de rapports.

## 3. Profiles

`profiles/` décrit les différences techniques :

- structure attendue ;
- commandes ;
- fichiers publics ;
- variables d'environnement documentées ;
- contrôles ;
- critères de recette ;
- capacités recommandées.

Chaque profil possède un manifeste versionné et validé par le cœur. Le CLI le charge lors de la création ou de l'adoption, puis `doctor` vérifie sa disponibilité, sa version et ses exigences.

Le profil `generic` ne choisit aucune stack, n'impose aucune commande et détecte seulement les capacités déjà démontrées par un projet existant. Le profil `node-api` spécialise ce contrat pour un service HTTP TypeScript : cible souple pendant la création, exigences bloquantes et commandes réellement détectées pendant l'adoption. Le profil `nextjs` applique la même discipline tout en acceptant plusieurs structures légitimes : App Router ou Pages Router, avec ou sans dossier `src/`.

Le profil `swiftui` accepte un projet Xcode au nom variable ou un package Swift et vérifie une preuve de SwiftUI dans les sources. Le profil `wordpress` reconnaît séparément un site complet, une extension et un thème, tout en combinant les contrôles Composer et Node réellement déclarés.

Le schéma de profil v5 exprime des alternatives de chemins, de champs JSON et de motifs bornés, des preuves textuelles et des commandes obligatoires selon le mode d'entrée. La recherche ignore les sorties de build et les dépendances générées, ne suit pas les liens symboliques et respecte l'ordre de priorité des preuves déclaré par le profil.

## 4. Adapters

`adapters/` traduit le cœur vers les conventions de chaque assistant :

- emplacement des instructions ;
- format des skills ;
- format des agents ;
- configuration des permissions ;
- mécanismes d'invocation disponibles.

Chaque adaptateur possède un manifeste validé et des modèles de sorties. Le CLI contient seulement le moteur générique de chargement, de rendu, de protection et de diagnostic ; les chemins et conventions propres à l'assistant restent dans son dossier d'adaptateur.

Les adaptateurs Codex v3 et Claude Code v3 sont disponibles. Tous deux utilisent le workspace privé comme dossier de lancement, donnent un accès explicite au `code_root` et déclarent leurs destinations natives de skills et d'agents.

Leur installation simultanée est testée. Le cœur, le profil, les sources de vérité et le CLI restent identiques : seuls les manifestes et modèles de l'adaptateur changent.

## 5. Skills

Un skill est écrit une seule fois dans le cœur, puis installé comme source modifiable dans `ai-workspace/skills/`. Les adaptateurs reçoivent des copies générées dans leur emplacement natif.

```text
core/skills/project-discover/       # version livrée par le starter
            │ installation
            ▼
ai-workspace/skills/project-discover/  # source du projet
            ├── .agents/skills/project-discover/  # Codex
            └── .claude/skills/project-discover/  # Claude Code
```

Une empreinte enregistrée dans `project.yaml` permet à `skill sync` de distinguer une personnalisation légitime de la source d'une modification concurrente d'une copie. `doctor` bloque une copie manquante ou divergente.

Les skills disponibles sont :

- `project-discover` : transformer une idée ou un product-package importé en brief brouillon vérifiable ;
- `project-handoff` : contrôler ce brief et enregistrer une décision humaine traçable ;
- `project-setup` : préparer et vérifier un socle technique sans fonctionnalité produit ;
- `project-work` : réaliser une unité bornée jusqu'à son acceptation humaine ;
- `project-ship` : qualifier, autoriser et observer une livraison réelle.

Le handoff repose sur deux couches : le skill examine la cohérence et la qualité décisionnelle, tandis que `doctor` contrôle mécaniquement l'intégrité des métadonnées d'approbation.

Le setup utilise des modèles universels d'architecture et de rapport. Les choix propres à une stack restent dans les profils ou dans les décisions du projet ; le skill n'impose aucun framework.

`project-work` applique le contrat [work-items.md](../core/contracts/work-items.md). Le fichier de tâche porte le périmètre et l'état ; son rapport porte les preuves. Builder et Independent Reviewer peuvent intervenir sans devenir obligatoires ni recevoir plus d'autorité que l'unité approuvée.

`project-ship` applique le contrat [shipments.md](../core/contracts/shipments.md). Son manifeste privé identifie le candidat et la cible ; son rapport distingue qualification, autorisation, action externe et preuve post-livraison. La préparation locale reste possible lorsque toute action externe est interdite.

## 6. Agents

Un agent est une responsabilité isolée, pas un workflow complet. Sa source de projet contient un manifeste mécanique et des instructions rédigées librement :

```text
core/agents/builder/                    # version livrée par le starter
            │ installation explicite
            ▼
ai-workspace/
├── agents/builder/                     # source canonique du projet
│   ├── agent.yaml
│   └── instructions.md
├── .codex/agents/builder.toml           # copie Codex
└── .claude/agents/builder.md            # copie Claude Code
```

Le catalogue initial contient :

- `builder`, qui réalise une seule unité `WORK-NNN` approuvée et s'arrête avant la revue ;
- `independent-reviewer`, qui relit en contexte séparé et en lecture seule, sans corriger ni accepter.

`project.yaml` commence avec `agents: []`. `agent add` installe explicitement un rôle du catalogue ; `agent create` produit un brouillon personnel désactivé. L'utilisatrice reste propriétaire de `agents/<id>/`, tandis que les copies propres aux assistants sont générées. Une empreinte permet à `agent sync` et `doctor` de détecter toute divergence ou modification directe.

Le manifeste interdit aux agents d'approuver le brief, d'accepter une unité ou d'autoriser une livraison. Les permissions natives complètent ce contrat sans élargir celles du processus parent.

## 7. CLI

Le CLI est développé en TypeScript pour Node.js 22 ou plus récent. Il assure les opérations déterministes.

Commandes disponibles :

- `new` : créer une structure sûre ;
- `adopt` : équiper un dépôt existant ;
- `doctor` : vérifier la structure et la configuration ;
- `intake import` : valider et archiver un product-package versionné ;
- `profile list|show` : découvrir les familles techniques et leurs exigences ;
- `adapter add` : ajouter la traduction propre à un assistant ;
- `skill list|add|sync` : sélectionner, installer et synchroniser les procédures ;
- `agent list|add|create|sync` : sélectionner ou rédiger des rôles puis produire leurs copies natives ;
- `version` : afficher la version du starter.

Commandes prévues pour une phase ultérieure :

- `validate` : valider les schémas et contenus générés ;
- `update` : appliquer des migrations compatibles ;

Le CLI ne copie jamais le dépôt du starter. Pour une adoption, il conserve le code existant intact et refuse de placer le workspace privé dans le dépôt Git.

### Product-package

Le contrat `project-architect-product-package` v1 forme la frontière entre la recherche conversationnelle et la réalisation. Le CLI valide le manifeste, refuse les chemins dangereux et archive chaque version sans la modifier. Un registre et une empreinte rendent la copie idempotente et détectent toute altération ultérieure avec `doctor`.

Les fichiers placés dans `intake/research/`, `prototype/` et `docs/internal/` sont des références vers l'archive, pas des copies concurrentes. Project Discover produit ensuite le brouillon du brief ; Project Handoff conserve l'autorité d'approbation humaine.

## 8. Tests

`tests/` vérifie le starter lui-même avec des workspaces temporaires et des fixtures versionnées :

- projet générique vide ;
- projet web ;
- projet mobile ;
- dépôt existant ;
- configurations invalides ;
- tentatives de fuite entre workspace et application.

La porte `npm run validate` ajoute la compilation stricte et l'inspection du paquet distribuable. GitHub Actions la rejoue sur Node 22, 24 et 26, ainsi que sur Linux, macOS et Windows.

## 9. Workspace généré

```text
MonProjet/
├── app/
└── ai-workspace/
    ├── project.yaml
    ├── PROJECT_BRIEF.md
    ├── PROJECT_STATE.md
    ├── intake/
    │   └── product-package/
    ├── prototype/
    ├── docs/
    ├── taches/
    ├── skills/
    ├── agents/
    └── configuration de l'assistant
```

## 10. Règle de dépendance

```text
core <- profiles
core <- adapters
core <- cli
core <- tests
```

Les profils et adaptateurs dépendent du cœur. Le cœur ne dépend ni d'un profil ni d'un assistant.
