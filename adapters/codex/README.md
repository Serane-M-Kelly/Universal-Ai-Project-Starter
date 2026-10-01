# Adaptateur Codex

Cet adaptateur permet d'utiliser Codex depuis `ai-workspace` tout en travaillant sur le code situé dans le dossier frère configuré par `code_root`.

Il génère :

- `AGENTS.md` pour les instructions durables ;
- `.codex/config.toml` pour l'accès local au code avec réseau désactivé ;
- `.agents/skills/` pour les copies natives des skills installés ;
- `.codex/agents/` pour les copies natives des agents activés ;
- `CODEX_SETUP.md` pour les instructions de première ouverture.

Les fichiers d'instructions et de configuration générés deviennent `user-owned` : une mise à jour du starter ne les écrasera jamais silencieusement. Les copies situées dans `.agents/skills/` et `.codex/agents/` restent `starter-managed`, sont synchronisées depuis leurs sources universelles et bénéficient d'une détection des conflits.

## Modèle de sécurité

Codex est lancé depuis `ai-workspace`. Sa configuration locale utilise le sandbox `workspace-write`, ajoute uniquement le `code_root` comme racine inscriptible, conserve les validations interactives et désactive le réseau par défaut.

La confiance du projet reste une décision humaine lors de la première ouverture. L'adaptateur ne lance pas Codex, n'active pas le réseau et ne modifie aucune configuration personnelle dans `~/.codex`.

## Conventions officielles suivies

- [Instructions avec AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Configuration de projet .codex/config.toml](https://learn.chatgpt.com/docs/config-file/config-advanced#project-config-files-codexconfigtoml)
- [Skills Codex](https://learn.chatgpt.com/docs/build-skills)
- [Agents personnalisés Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents)
