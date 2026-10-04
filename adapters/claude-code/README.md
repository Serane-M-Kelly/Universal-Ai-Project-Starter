# Adaptateur Claude Code

Claude Code s'ouvre depuis `ai-workspace` et travaille sur le code déclaré par `code_root`.
Deux régimes coexistent :

- **workspace par phases (v3, nouveaux projets)** : tout est généré depuis `.starter/models.json`
  par `workflow init --adapter claude-code`, `workflow adapter-add claude-code` et `workflow models-sync` ;
- **workspace historique** (`ai-project new/adopt`) : les modèles de ce dossier (`templates/`)
  restent utilisés par `ai-project adapter add claude-code`.

Dans un workspace v3, `ai-project adapter add claude-code` est redirigé vers `workflow adapter-add`
et `adapter upgrade` est refusé : les modèles historiques décrivent l'ancien backlog.

## Fichiers générés dans un workspace v3

| Fichier | Régime | Contenu |
|---|---|---|
| `CLAUDE.md` | créé une fois, jamais écrasé | Renvoi à `.starter/WORKFLOW.md`, invocation `/project-…`, règles de délégation et de lecture compacte. |
| `.claude/settings.json` | généré, empreinte suivie | `additionalDirectories` = code applicatif, sandbox, refus `.env`/secrets, commandes de lecture du moteur autorisées, modèle/effort du coordinateur s'ils sont choisis. |
| `.claude/agents/<rôle>.md` | généré, empreinte suivie | `model`, `effort`, outils et mode de permission de chaque rôle. |
| `.claude/skills/<skill>/` | copie de `skills/<skill>/` | Les neuf skills ; une copie retouchée bloque la synchronisation. |

Les réglages personnels vont dans `.claude/settings.local.json`, que Claude Code écrit lui-même
lorsque l'on choisit « Yes, and don't ask again ». Le starter ne le génère ni ne le contrôle.
Une modification directe d'un fichier généré est détectée : reporter le choix dans `models.json`.

## Configuration des rôles

Codex lit `model` et `effort`. Claude lit uniquement `claude_model` et `claude_effort` :
les identifiants et niveaux OpenAI ne sont jamais transposés.

| Rôle | `claude_model` | `claude_effort` | Outils | Justification |
|---|---|---|---|---|
| coordinateur | `null` (choix de la session) | `null` | session | La session principale porte la conversation : le modèle choisi avec `/model` et l'effort de `/effort` sont respectés. Le défaut documenté pour Pro/Max/Team/Enterprise est Opus 5.5 en `medium`. Fixer ici un modèle écraserait ce choix et pourrait viser un modèle absent du compte. |
| planner | `opus` | `high` | lecture, Bash en mode plan | Découpage Product Owner : peu de texte produit, raisonnement dense ; une erreur de découpage coûte plus cher que l'appel. |
| builder | `inherit` | hérité | lecture, écriture, Bash | Réalise l'essentiel de la phase : il suit le modèle choisi pour la session, ce qui garde le coût et la qualité sous le contrôle de la propriétaire. `sonnet` est l'alternative économique. |
| reviewer | `opus` | `high` | lecture, Bash en mode plan | Revue distincte : contexte séparé, lecture du code avant la justification. `high` vise la vérification plutôt qu'un `xhigh` systématique. |
| implementer | `sonnet` | `medium` | lecture, écriture, Bash | Mission technique bornée : Sonnet 5.5 suffit et coûte moins ; `medium` est son défaut documenté. |
| reader | `haiku` | aucun | lecture, Bash en mode plan | Lecture et extraction avec sources : rapide et économique. La documentation ne liste pas Haiku parmi les modèles à effort réglable ; un `claude_effort` y est refusé. |

Valeurs acceptées par rôle : `inherit`, `sonnet`, `opus`, `haiku`, `fable` ou un identifiant `claude-…` ;
efforts `low`, `medium`, `high`, `xhigh`, `max`. Pour le coordinateur : `null`, un alias de session
(`default`, `best`, `opusplan`, `opus[1m]`…) ou un identifiant, avec `effortLevel` limité à
`low`…`xhigh` (`max` se choisit par session : `/effort max` ou `claude --effort max`). `xhigh` est
refusé pour `claude-opus-4-6` et `claude-sonnet-4-6`, qui ne le proposent pas.

`fable` n'est pas un défaut : son accès dépend du compte et de la plateforme. Il reste possible
pour un rôle précis si la session le propose.

## Ce que la configuration ne garantit pas

- **Disponibilité** : un fichier ne prouve pas l'accès au modèle. Une politique d'organisation
  (`availableModels`) peut substituer la version la plus récente autorisée de la famille, ou le
  modèle hérité, sans erreur. Vérifier avec `/model`, `/agents` et une délégation réelle.
- **Remplacements** : un paramètre `model` passé lors d'une délégation l'emporte sur la définition
  de l'agent ; `CLAUDE_CODE_SUBAGENT_MODEL` + `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` imposent un
  modèle à tous les sous-agents. `workflow environment` signale ces variables.
- **Effort hérité** : un rôle sans `claude_effort` suit l'effort de la session ; avec `inherit`,
  le niveau effectif dépend du modèle choisi.
- **Skills** : un champ `model`/`effort` de skill ne vaut que pour un tour ; les skills du starter
  n'en déclarent pas et ne changent donc jamais le modèle de la session.
- **Replis** : les `fallbacks` Codex n'ont pas d'équivalent par rôle. Claude propose `fallbackModel`
  pour la session ; pour les sous-agents, seule la substitution par politique existe.
- **Délégation** : les rôles n'ont pas l'outil `Agent` ; seul le coordinateur délègue, comme le
  prévoit le contrat. Claude limite par ailleurs l'imbrication à trois niveaux.
- **Lecture seule** : les rôles de lecture sont en mode `plan`, sans `Edit`/`Write`. Codex applique
  une lecture seule au niveau du système ; Claude applique un mode de permission : une commande Bash
  non reconnue comme lecture demande une confirmation au lieu d'être interdite.

## Permissions et accès au code

- `additionalDirectories` donne accès en lecture et écriture (selon le mode) au code applicatif ;
  il ne charge ni `CLAUDE.md` ni `.claude/` de ce dossier, ce qui évite toute fuite de configuration.
- Mode `default`, contournement des permissions désactivé, sandbox Bash activé, commandes sandboxées
  non auto-approuvées, sortie du sandbox refusée. Le sandbox autorise l'écriture dans le workspace,
  le code applicatif et le dossier temporaire ; le réseau demande une approbation par domaine.
- Sept commandes de lecture du moteur (`workflow status|next|context|sources|report|environment`,
  `doctor`) s'exécutent sans confirmation ; un test vérifie qu'elles n'écrivent rien. Les commandes
  qui consignent (begin, check, review, accept…) restent soumises à confirmation.
- Le sandbox protège `.claude/skills`, `.claude/agents` et `.claude/settings.json` : `models-sync`,
  `adapter-add` et `skill sync` se lancent dans un Terminal, session Claude fermée.

## Démarrer et changer d'assistant

```bash
node dist/index.js workflow init ../mon-projet --name "Mon produit" --owner "Kelly" --adapter claude-code
cd ../mon-projet/ai-workspace
claude
```

Puis `/project-start`. Pour ajouter Claude à un workspace Codex (ou réparer une installation) :

```bash
node .starter/run.mjs workflow adapter-add claude-code --dry-run
node .starter/run.mjs workflow adapter-add claude-code
```

## Conventions officielles suivies

- [Sous-agents](https://code.claude.com/docs/en/sub-agents) : `model`, `effort`, `tools`, `disallowedTools`, `permissionMode`
- [Modèles et effort](https://code.claude.com/docs/en/model-config)
- [Skills](https://code.claude.com/docs/en/skills)
- [Permissions et répertoires additionnels](https://code.claude.com/docs/en/permissions)
- [Sandbox](https://code.claude.com/docs/en/sandboxing)
- [Mémoire, CLAUDE.md et AGENTS.md](https://code.claude.com/docs/en/memory)
- [Réglages](https://code.claude.com/docs/en/settings-reference)
