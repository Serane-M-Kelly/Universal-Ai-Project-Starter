# Audit de l'intégration Claude Code — 0.23.0 → 0.24.0

Sources : code et fichiers réellement générés par `workflow init` (0.23 et 0.24, macOS, Node
24.10.0, 2 octobre 2026) ; documentation officielle Claude Code consultée le même jour
(sous-agents, modèles et effort, skills, permissions, sandbox, mémoire, réglages).

Légende : **configuré** = écrit par le starter dans un fichier natif ; **documenté** = décrit
seulement ; **testé** = vérifié par un test automatisé du dépôt ; **session** = ne peut être
établi que dans une vraie session Claude Code.

## Constat sur la 0.23.0

| Sujet | Codex 0.23 | Claude 0.23 |
|---|---|---|
| Accès au dossier applicatif | configuré (`writable_roots`) et testé | **absent** en v3 : aucun `.claude/settings.json` ; l'adaptateur historique n'était pas appliqué par `workflow init` |
| Modèle/effort du coordinateur | configuré (`config.toml`) | non configurable ; documenté « héritage » |
| Modèle/effort par rôle | configurés et testés | `model: inherit` partout, ou `claude_model` ; **aucun effort** (le champ `effort` existe pourtant) |
| Outils des rôles | sandbox `read-only`/`workspace-write` | outils listés ; reviewer/planner/reader avec `Bash` sans mode de permission |
| Skills | 9 copies, testées | 9 copies, testées |
| Instructions | `AGENTS.md` | `CLAUDE.md` minimal (sans syntaxe `/project-…`) |
| Changement d'assistant | — | **défaillant** : copies Claude absentes, Doctor bloqué (voir RELEASE-0.24.0) |
| Lectures compactes | dans les skills | idem ; non mentionnées aux sous-agents |
| `workflow environment` | `codex --version` | Claude ignoré |

## État 0.24.0

| Élément | Statut | Preuve |
|---|---|---|
| `additionalDirectories` = code applicatif canonique, mis à jour par `relocate` | configuré, testé | release-024 « settings… », « relocate… » |
| Sandbox, mode `default`, bypass désactivé, refus `.env`/secrets | configuré, testé | release-024 |
| Sept lectures du moteur sans confirmation, n'écrivant rien | configuré, testé (instantané avant/après) | release-024 « auto-approved… » |
| Rôles : `model`, `effort`, `tools`, `disallowedTools`, `permissionMode` | configuré, testé | release-024 |
| Aucun identifiant OpenAI dans `.claude/` | testé | release-024 |
| Validation des choix Claude (Haiku sans effort, `xhigh` absent des 4.6, `max` de session) | testé, sans écriture en cas de refus | release-024 « choices… » |
| Modèle/effort du coordinateur → `model`/`effortLevel` | configuré si demandé, testé | release-024 |
| Copies de skills pour chaque assistant installé ; conflit préservé ; upgrade vers les deux | testé | release-024 « both assistants… » |
| Réparation d'un workspace 0.23 (aperçu sans écriture, sauvegarde, idempotence) | testé | release-024 « repair… » ; essai manuel sur un workspace produit par la 0.23 |
| Fichiers Codex identiques à la 0.23 | testé (référence octet par octet) | release-024, `tests/fixtures/codex-native-023` |
| Retour Claude → Codex | testé | release-024 « switch back… » |
| Variables qui remplacent les modèles signalées | testé | release-024 « environment… » |
| Chargement réel des skills `/project-…` et des agents | **session** | — |
| Modèle effectivement exécuté par chaque rôle sur le compte | **session** | — |
| Comportement du mode `plan` pour un sous-agent (Bash, ExitPlanMode) | **session** | — |
| Règles `allow` appliquées sous sandbox et en mode `plan` | **session** | — |
| Écriture du code applicatif par le builder via `additionalDirectories` | **session** | — |
| Refus du sandbox sur `.claude/` lors d'un `models-sync` lancé depuis la session | documenté (doc officielle) | — |

## Capacités Claude et équivalences

| Besoin du starter | Codex | Claude Code | Fonctionnement retenu |
|---|---|---|---|
| Modèle du coordinateur | `model` dans `.codex/config.toml` | `model` dans `settings.json` (priorité : `/model` > `--model` > `ANTHROPIC_MODEL` > réglages) | `null` par défaut : la session choisit ; valeur explicite possible |
| Effort du coordinateur | `model_reasoning_effort` | `effortLevel` (`low`…`xhigh`) ; `max` par session | `null` par défaut pour ne pas écraser `/effort` |
| Modèle par rôle | fichier d'agent | `model` du sous-agent ; ordre : paramètre d'appel > définition > `CLAUDE_CODE_SUBAGENT_MODEL` > session | consigne : déléguer sans paramètre `model` |
| Effort par rôle | fichier d'agent | `effort` du sous-agent, selon le modèle | validé ; Haiku sans effort |
| Lecture seule | sandbox OS `read-only` | mode `plan` + `disallowedTools` | plus faible : confirmation au lieu d'interdiction |
| Replis | `fallbacks` appliqués par le coordinateur | `fallbackModel` (session) ; substitution par politique pour les sous-agents | documenté ; pas de repli par rôle |
| Délégation imbriquée | selon surface | 3 niveaux par défaut | rôles sans outil `Agent` : seul le coordinateur délègue |
| Skills | `$skill` | `/skill` ; `model`/`effort` de skill valables un tour | skills identiques, sans champ de modèle |
| Instructions | `AGENTS.md` | `CLAUDE.md` ; `AGENTS.md` lu seulement en l'absence de `CLAUDE.md` | un fichier par assistant, même renvoi à `.starter/WORKFLOW.md` |

## Lectures compactes

Les deux assistants utilisent les mêmes commandes (`workflow status|next|context --compact`,
`workflow report`, `doctor --compact`, `workflow sources`), déjà prescrites par les skills. La 0.24 :
les autorise sans confirmation dans Claude (lecture seule vérifiée), les rappelle dans `CLAUDE.md`
et dans les agents Claude (partir des extraits fournis, n'ouvrir l'original que si nécessaire) et
signale par `workflow sources` les fichiers d'instructions requis. Les agents Codex ne sont pas
modifiés afin de garder leurs fichiers identiques à la 0.23 ; la même consigne pourrait y être
ajoutée dans une version ultérieure. Aucun gain en tokens facturés n'est revendiqué.
