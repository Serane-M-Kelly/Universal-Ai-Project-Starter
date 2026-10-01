# Utiliser ce projet avec Claude Code

## Dossier à ouvrir

Lancer Claude Code depuis ce workspace privé, et non depuis le dépôt applicatif.

```bash
cd "{{WORKSPACE_ROOT_SHELL}}"
claude
```

## Première ouverture

1. Examiner le chemin additionnel présenté par Claude Code.
2. Confirmer la confiance du workspace seulement si ce chemin correspond au `code_root` attendu.
3. Exécuter `/status` pour vérifier que `.claude/settings.json` et `CLAUDE.md` sont chargés.
4. Exécuter `/permissions` pour contrôler les autorisations effectives.
5. Demander le diagnostic du starter avant le premier travail.

Si le répertoire additionnel n'est pas chargé, quitter sans travailler sur le code, vérifier `.claude/settings.json`, puis relancer Claude Code.

## Emplacements Claude Code

- `CLAUDE.md` : instructions durables de ce projet ;
- `.claude/settings.json` : permissions, répertoire applicatif et sandbox ;
- `skills/` : sources modifiables des skills du projet ;
- `.claude/skills/` : copies natives synchronisées pour Claude Code ;
- `agents/` : sources modifiables des agents sélectionnés ou personnels ;
- `.claude/agents/` : copies natives des agents activés depuis `agents/`.

Ces fichiers appartiennent au workspace privé. Ils ne doivent pas être déplacés vers `{{CODE_ROOT_RELATIVE}}`.
