# CLI

Le CLI TypeScript exécute les opérations déterministes du starter.

Il ne demande pas à l'IA de deviner la structure : il crée les dossiers, calcule les chemins et exécute les contrôles lui-même.

## Prérequis de développement

- Node.js 22 ou plus récent ;
- npm.

## Installation locale

```bash
npm install
npm run build
npm link
```

Pour valider le starter lui-même avant une évolution :

```bash
npm run validate
```

## Commandes

### Nouveau projet

```bash
ai-project new "Mon Projet"
```

Options initiales :

```text
--target <chemin>
--entry-mode idea|brief
--profile generic|node-api|nextjs|swiftui|wordpress
--no-git
```

`generic` reste le choix neutre. `node-api` cible un service HTTP TypeScript sans choisir son framework. Les profils disponibles et leur contrat peuvent être consultés avec :

```bash
ai-project profile list
ai-project profile show node-api
```

Le CLI refuse d'écraser un dossier existant non vide.

Résultat créé :

```text
Mon-Projet/
├── app/           # dépôt Git du produit
└── ai-workspace/  # contexte privé, hors Git
```

### Adoption d'un dépôt

```bash
ai-project adopt /chemin/vers/le-depot
```

Le CLI crée un workspace frère et ne modifie aucun fichier du dépôt adopté.

Si le chemin fourni correspond à une application située dans un monorepo, `code_root` pointe vers cette application et `repository_root` vers la racine Git. Le CLI refuse un `--workspace` situé dans ce dépôt.

Options :

```text
--workspace <chemin>
--entry-mode existing|maintenance
--name <nom>
--profile generic|node-api|nextjs|swiftui|wordpress
```

### Diagnostic

```bash
ai-project doctor /chemin/vers/ai-workspace
```

Codes de sortie :

```text
0 = READY
1 = WARNING
2 = BLOCKED ou erreur d'utilisation
```

`WARNING` signale un projet utilisable mais encore incomplet, par exemple un brief brouillon contenant des placeholders. `BLOCKED` signale un risque ou une incohérence qui doit être corrigé avant de continuer.

Pour un rapport exploitable par un outil :

```bash
ai-project doctor /chemin/vers/ai-workspace --json
```

### Importer un dossier Project Architect

Créer d'abord un projet portant le même nom que le package, puis importer le dossier marqué `ready_for_intake` :

```bash
ai-project new "Mon Produit" --entry-mode idea
ai-project intake import /chemin/vers/product-package /chemin/vers/ai-workspace
```

La commande :

- valide `manifest.yaml` avec le contrat v1 ;
- refuse les packages brouillons, les mauvais projets, les liens symboliques et secrets potentiels ;
- conserve une archive immuable sous `intake/product-package/` ;
- crée un registre, des références privées et un rapport d'import ;
- met à jour l'état opérationnel sans modifier `PROJECT_BRIEF.md` ;
- refuse d'importer dans un brief déjà approuvé ou dans un workspace `existing`/`maintenance`.

Une réimportation strictement identique est sans effet. Si le contenu change, Project Architect doit incrémenter `package_version`.

Après l'import :

```bash
ai-project skill add project-discover /chemin/vers/ai-workspace
```

Project Discover audite alors les fichiers importés, remplit le brief en brouillon et conserve les limites de preuve. `project-handoff` reste obligatoire pour demander l'approbation humaine.

### Ajouter un adaptateur d'assistant

```bash
ai-project adapter add codex /chemin/vers/ai-workspace
ai-project adapter add claude-code /chemin/vers/ai-workspace
```

La commande valide d'abord le workspace, refuse tout écrasement, génère la configuration privée de l'assistant et relance `doctor`. Elle est idempotente lorsque l'adaptateur est déjà correctement installé.

L'adaptateur ne lance pas l'assistant et ne confirme jamais la confiance du projet à la place de l'utilisatrice.

### Installer et personnaliser un skill

```bash
ai-project skill list
ai-project skill add project-discover /chemin/vers/ai-workspace
ai-project skill add project-handoff /chemin/vers/ai-workspace
ai-project skill add project-setup /chemin/vers/ai-workspace
ai-project skill add project-work /chemin/vers/ai-workspace
ai-project skill add project-ship /chemin/vers/ai-workspace
```

La commande installe une source unique dans :

```text
ai-workspace/skills/project-discover/
```

Elle génère ensuite les copies attendues par chaque adaptateur déjà configuré. Si un adaptateur est ajouté plus tard, ses copies sont créées automatiquement.

Pour personnaliser le skill, modifier uniquement sa source dans `skills/`, puis lancer :

```bash
ai-project skill sync /chemin/vers/ai-workspace
```

Une copie d'assistant modifiée directement n'est jamais écrasée silencieusement. Après avoir reporté les changements utiles dans la source canonique, son remplacement explicite est possible avec `--force`.

Pour un projet démarré depuis une idée, installer `project-discover` pour construire le brouillon, puis `project-handoff` lorsque ce brouillon doit être contrôlé et soumis à une approbation humaine. Installer les deux n'autorise pas automatiquement la réalisation : seul un brief explicitement approuvé ouvre `project-setup`.

`project-setup` prépare ensuite le socle technique et produit `reports/setup-report.md`. Un verdict `SETUP_READY`, ou un avertissement explicitement accepté, est nécessaire avant `project-work`. Sur un dépôt adopté, le skill peut être installé directement pour fiabiliser l'environnement dans un périmètre borné.

`project-work` crée une unité privée `taches/WORK-NNN.md` et son rapport `reports/work/WORK-NNN.md`. L'implémentation peut devenir `ready_for_acceptance` après vérification et revue ; seule une acceptation humaine explicite permet `accepted`.

`project-ship` crée `livraisons/SHIP-NNN.md` et `reports/ship/SHIP-NNN.md`. Il peut préparer un candidat sans action externe. Une cible et un candidat exacts doivent être autorisés avant remise, publication ou déploiement ; une preuve externe est nécessaire pour l'état `shipped`.

### Sélectionner ou rédiger un agent

```bash
ai-project agent list
ai-project agent add builder /chemin/vers/ai-workspace
ai-project agent add independent-reviewer /chemin/vers/ai-workspace
```

Les agents sont conditionnels : un projet neuf n'en active aucun. `builder` implémente une seule unité approuvée ; `independent-reviewer` contrôle le résultat en lecture seule, sans le corriger ni l'accepter.

Pour rédiger ton propre agent :

```bash
ai-project agent create domain-expert /chemin/vers/ai-workspace
# modifier agents/domain-expert/agent.yaml et instructions.md
# passer enabled: true lorsque le contrat est prêt
ai-project agent sync /chemin/vers/ai-workspace
ai-project doctor /chemin/vers/ai-workspace
```

`agent create` prépare volontairement un brouillon désactivé. `agent sync` traduit la source vers `.codex/agents/*.toml` et `.claude/agents/*.md` selon les adaptateurs présents. Une copie native modifiée directement n'est pas écrasée sans `--force` explicite ; les deux fichiers sources personnels ne sont jamais remplacés par une mise à jour du catalogue.
