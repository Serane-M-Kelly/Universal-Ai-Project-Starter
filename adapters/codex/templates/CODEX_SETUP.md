# Utiliser ce projet avec Codex

## Dossier à ouvrir

Ouvrir Codex depuis ce workspace privé, et non directement depuis le dépôt applicatif.

```bash
cd "{{WORKSPACE_ROOT_SHELL}}"
codex
```

Dans l'application Codex, ouvrir ce même dossier comme projet.

## Première ouverture

1. Vérifier que le chemin affiché correspond bien au workspace privé.
2. Examiner puis accepter la confiance du projet si Codex la demande.
3. Demander à Codex d'exécuter le diagnostic du starter avant le premier travail.
4. Conserver l'accès réseau désactivé, sauf besoin explicite et autorisé.

## Emplacements Codex

- `AGENTS.md` : instructions durables de ce projet ;
- `.codex/config.toml` : permissions locales et configuration du sandbox ;
- `skills/` : sources modifiables des skills du projet ;
- `.agents/skills/` : copies natives synchronisées pour Codex ;
- `agents/` : sources modifiables des agents sélectionnés ou personnels ;
- `.codex/agents/` : copies natives des agents activés depuis `agents/`.

Ces fichiers appartiennent au workspace privé. Le starter ne doit pas les déplacer vers `{{CODE_ROOT_RELATIVE}}`.
