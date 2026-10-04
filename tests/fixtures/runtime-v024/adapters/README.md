# Adapters

Un adaptateur traduit les contrats universels vers le format d'un assistant donné.

## Responsabilité

Un adaptateur peut déclarer :

- les fichiers d'instructions reconnus par l'assistant ;
- son emplacement de configuration locale ;
- les dossiers de skills et d'agents ;
- le dossier depuis lequel lancer l'assistant ;
- les fichiers déterministes à produire.

Il ne possède ni le workflow produit, ni le profil technique, ni le contenu métier des agents et skills.

## Manifeste

Chaque adaptateur possède un `adapter.yaml` versionné et validé. Le manifeste indique :

- son identité et son fournisseur ;
- les versions du schéma projet compatibles ;
- les profils acceptés ;
- la commande et le dossier de lancement ;
- les dossiers attendus ;
- les destinations et formats natifs des skills et agents ;
- les sorties, leurs modèles et leur régime de propriété.

`project.yaml` conserve une référence `{ id, version }` pour chaque adaptateur installé. `doctor` bloque une version manquante, incompatible ou incomplète.

## Propriété des sorties

- `user-owned` : le starter crée le fichier une seule fois, puis ne l'écrase jamais ;
- `starter-managed` : copie générée depuis une source canonique et régénérable par une commande explicite.

`adapter add` refuse d'écraser les instructions et réglages existants. Les copies natives de skills et d'agents sont ensuite synchronisées avec détection des conflits. Tous les chemins et liens symboliques restent confinés au workspace privé.

`adapter upgrade` compare chaque sortie au modèle historique exact de la version installée. Une sortie inchangée peut être remplacée ; une sortie personnalisée bloque la mise à niveau, sauf remplacement explicitement autorisé avec `--force`. Les modèles historiques ne sont jamais installés dans le workspace : ils servent uniquement de référence locale au CLI.

## Installation

```bash
ai-project adapter add <id> /chemin/vers/ai-workspace
ai-project adapter upgrade <id> /chemin/vers/ai-workspace
```

L'installation :

1. diagnostique le workspace ;
2. charge et valide le manifeste ;
3. vérifie les compatibilités et tous les conflits ;
4. génère les sorties ;
5. inscrit l'adaptateur dans `project.yaml` ;
6. produit les copies des skills et agents déjà sélectionnés ;
7. relance le diagnostic.

Les adaptateurs disponibles sont :

- [`codex`](codex/README.md) ;
- [`claude-code`](claude-code/README.md).

Leur coexistence sur un même workspace valide que le moteur commun ne dépend pas du format d'un assistant particulier.

## Workspaces par phases (v3)

Dans un workspace créé par `workflow init`, les adaptateurs historiques ne sont pas utilisés :
`.starter/models.json` est le registre unique. Son champ `adapters` liste les assistants installés
et `workflow models-sync` génère leurs réglages et agents ; `skill add|sync|upgrade` alimente une
copie par assistant. `ai-project adapter add` y est redirigé vers `workflow adapter-add` et
`adapter upgrade` y est refusé. Détails Claude : [claude-code/README.md](claude-code/README.md).

## Passer d'un assistant à l'autre

Codex et Claude Code utilisent le **même workspace privé**, le même suivi (`.starter/workflow.json`,
`BACKLOG.md`), les mêmes preuves et les mêmes sources de skills (`skills/`). Il n'y a pas
d'assistant « actif » : une fois les deux installés, on ouvre l'un ou l'autre.

Installation de l'assistant manquant (une fois, dans un Terminal, aucun assistant ouvert) :

```bash
cd /chemin/vers/ai-workspace
node .starter/run.mjs workflow adapter-add claude-code --dry-run
node .starter/run.mjs workflow adapter-add claude-code
```

(`codex` à la place de `claude-code` pour le sens inverse.) L'aperçu indique les fichiers créés,
les copies de skills à installer, le sort du fichier d'instructions et tout conflit. Une copie ou un
réglage modifié séparément bloque l'opération sans rien écrire.

À chaque changement :

1. demander à l'assistant en cours de terminer ou suspendre l'opération (le mandat est conservé) ;
2. fermer la session ; vérifier qu'aucun `.starter/write.lock` ne subsiste ;
3. `node .starter/run.mjs doctor . --compact` doit être OK ou WARNING ;
4. ouvrir l'autre assistant dans `ai-workspace` (`codex` ou `claude`) puis appeler project-start
   (`$project-start` dans Codex, `/project-start` dans Claude Code).

project-start relit le workflow, `workflow sources` et les vues compactes : il retrouve la phase
active, son mandat et ses preuves. L'historique de conversation, le contexte en mémoire et le cache
ne sont pas transférés. Deux assistants ne doivent jamais écrire simultanément dans le workspace.
