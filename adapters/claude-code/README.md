# Adaptateur Claude Code

Cet adaptateur permet d'utiliser Claude Code depuis `ai-workspace` tout en travaillant sur le code situé dans le dossier configuré par `code_root`.

Il génère :

- `CLAUDE.md` pour la mémoire et les instructions durables ;
- `.claude/settings.json` pour déclarer le code comme répertoire additionnel ;
- `.claude/skills/` pour les copies natives des skills installés ;
- `.claude/agents/` pour les copies natives des agents activés ;
- `CLAUDE_SETUP.md` pour la première ouverture.

Les instructions et réglages sont `user-owned` et ne sont jamais écrasés silencieusement. Les copies situées dans `.claude/skills/` et `.claude/agents/` restent `starter-managed`, sont synchronisées depuis leurs sources universelles et bénéficient d'une détection des conflits.

## Sécurité

- mode de permission interactif `default` ;
- contournement dangereux des permissions désactivé ;
- sandbox Bash activé quand il est disponible ;
- commandes sandboxées non auto-approuvées ;
- sortie volontaire du sandbox désactivée ;
- lecture et modification des fichiers `.env`, `secrets` et `credentials` refusées.

Claude Code nécessite une connexion pour son propre fonctionnement. L'adaptateur ne lui accorde toutefois aucune commande réseau en liste blanche et ne configure aucun fournisseur, compte ou secret.

## Conventions officielles suivies

- [Mémoire projet avec CLAUDE.md](https://code.claude.com/docs/en/memory)
- [Répertoires additionnels et permissions](https://code.claude.com/docs/en/permissions)
- [Configuration settings.json](https://code.claude.com/docs/en/settings)
- [Skills Claude Code](https://code.claude.com/docs/en/slash-commands)
- [Subagents Claude Code](https://code.claude.com/docs/en/sub-agents)
