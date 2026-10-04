# Version 0.24.0 — Claude Code au niveau de Codex

## Changements

- **Registre unique des assistants.** `.starter/models.json` accepte `adapters` (`codex`,
  `claude-code` ou les deux). Réglages, agents et copies de skills sont générés pour chacun ;
  `adapter` reste l'assistant initial pour la compatibilité 0.22/0.23.
- **Surface Claude complète en v3.** `workflow init --adapter claude-code` (ou `codex,claude-code`)
  génère `.claude/settings.json` (accès au code applicatif, sandbox, refus des secrets, lectures
  du moteur sans confirmation), cinq agents de rôle avec modèle, effort, outils et mode de
  permission, `CLAUDE.md` et les neuf copies de skills. Avant la 0.24, un workspace Claude v3
  n'avait ni `settings.json` ni accès déclaré au dossier applicatif.
- **Configuration Claude par rôle** (`claude_model`, `claude_effort`), validée selon la
  documentation officielle, sans transposition des modèles ou efforts OpenAI. Défauts argumentés
  dans [l'adaptateur Claude](../adapters/claude-code/README.md).
- **`workflow adapter-add codex|claude-code [--dry-run]`** ajoute ou répare un assistant.
  Aperçu sans écriture, refus global en cas de personnalisation, idempotent.
  `ai-project adapter add` y est redirigé dans un workspace par phases ; `adapter upgrade` y est refusé.
- **Diagnostic explicite.** Une copie de skill absente, un fichier natif manquant ou un assistant
  inscrit par l'ancienne commande produisent un blocage qui nomme la commande de réparation
  (au lieu d'un `ENOENT` brut ou d'un message de copie absente sans issue).
- `workflow environment` indique la version de `claude`, les assistants installés et les variables
  d'environnement qui remplacent les modèles Claude. `workflow sources` marque les fichiers
  d'instructions requis selon les assistants installés.

Les fichiers Codex générés sont identiques octet par octet à ceux de la 0.23 (test de référence).
Les skills, leurs versions et le moteur de phases ne changent pas.

## Cause des copies Claude manquantes

Un workspace v3 avait trois registres incohérents : `project.yaml#adapters` (rempli par
`ai-project adapter add`), `models.json#adapter` (une seule valeur, utilisée pour les copies de
skills) et le registre d'empreintes. Sur un workspace Codex, `adapter add claude-code` inscrivait
Claude dans `project.yaml`, écrivait les modèles historiques (`CLAUDE.md` de l'ancien backlog), puis
synchronisait les skills… vers `.agents/skills` seulement, en annonçant « Skills synchronisés : 9 ».
Le Doctor contrôlait `.claude/skills` et bloquait ; `skill sync` ne pouvait pas réparer. En modifiant
`models.json`, `models-sync` créait les agents Claude mais ni les skills ni `settings.json`.

Correction : un seul registre (`models.json#adapters`) lu par la génération native, les skills et le
diagnostic ; la commande historique est redirigée ; la réparation passe par `adapter-add`.

## Réparer un workspace 0.23 existant

Le runtime copié dans un workspace 0.23 ne connaît pas `adapter-add`. Utiliser le CLI de cette
distribution sur le workspace, dans un Terminal, assistants fermés :

```bash
node "/chemin/Universal-AI-Project-Starter-v0.24.0/dist/index.js" doctor "/chemin/ai-workspace" --compact
node "/chemin/Universal-AI-Project-Starter-v0.24.0/dist/index.js" workflow adapter-add claude-code --workspace "/chemin/ai-workspace" --dry-run
node "/chemin/Universal-AI-Project-Starter-v0.24.0/dist/index.js" workflow adapter-add claude-code --workspace "/chemin/ai-workspace"
```

L'aperçu ne modifie rien. Les fichiers historiques inchangés (`CLAUDE.md`, `.claude/settings.json`)
sont remplacés après copie dans `.starter/history/` ; un fichier modifié est conservé (instructions)
ou bloque l'opération (réglages, copies de skills) avec la liste des conflits. Ensuite, utiliser ce même
CLI (`--workspace`) pour `models-sync` et `skill sync` : le runtime 0.23 du workspace ne régénère
qu'un seul assistant. Le runtime embarqué n'est pas mis à jour sur place.

## Limites

- Aucune session Claude Code ou Codex n'a été lancée par les tests : chargement réel des skills,
  agents, permissions et modèles à vérifier (voir [VALIDATION.md](VALIDATION.md)).
- Une configuration n'est pas une disponibilité : compte, politique d'organisation et variables
  d'environnement peuvent remplacer un modèle.
- Les rôles en lecture seule de Claude reposent sur le mode `plan` et l'absence d'outils
  d'écriture, pas sur un sandbox en lecture seule comme Codex.
- `models-sync`, `adapter-add` et `skill sync` écrivent dans `.claude/` : à lancer hors session.
