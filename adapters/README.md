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

## Passer d'un assistant à l'autre

Claude Code et Codex utilisent le **même workspace privé** et les mêmes sources canoniques. Il n'existe pas d'adaptateur « actif » : installer les deux permet d'ouvrir le projet avec l'un ou l'autre sans copier le brief, le backlog, les décisions ou les unités de travail.

Avant un changement d'environnement :

1. terminer ou suspendre proprement l'opération en cours ;
2. mettre à jour `PROJECT_STATE.md` avec le fait observé et la prochaine action ;
3. exécuter `ai-project backlog sync-view` si le backlog v2 a changé ;
4. exécuter `ai-project doctor` ;
5. fermer l'ancien assistant avant d'autoriser le nouveau à écrire.

Le nouvel assistant relit `PROJECT_BRIEF.md`, `PROJECT_STATE.md`, les décisions, le backlog et l'unité active, puis relance `doctor`. L'historique du chat, le contexte en mémoire et le prompt cache ne sont pas transférés. Deux assistants peuvent lire le workspace, mais ne doivent jamais le modifier simultanément.
