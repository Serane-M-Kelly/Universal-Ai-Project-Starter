# Universal AI Project Starter — 0.25.1

Version 0.25.1 : migration en place du runtime des projets existants 0.24 (`workflow runtime-upgrade`,
avec aperçu, sauvegarde vérifiée, comportement identique exigé et annulation). Voir
[la migration et ses garanties](docs/RELEASE-0.25.1.md).

Version 0.25.0 : un essai humain réussi n'est plus redemandé après une correction documentaire qui ne
le concerne pas (`workflow carry`, diff calculé et classé par le moteur), et les README publics des
produits suivent un guide adaptable avec un contrôle consultatif (`workflow readme-check`). Voir
[les changements, règles et limites](docs/RELEASE-0.25.0.md).

Version 0.24.0 : Claude Code est configuré avec la même précision que Codex dans les workspaces
par phases (accès au code, sandbox, rôles avec modèle et effort, skills), les deux assistants
partagent un même workspace et le changement d'assistant est réparé. Les fichiers Codex générés
restent identiques à la 0.23. Voir [les changements](docs/RELEASE-0.24.0.md),
[l'audit Claude Code](docs/AUDIT-CLAUDE-CODE-0.24.md) et [l'adaptateur Claude](adapters/claude-code/README.md).
Le [parcours SEO de la 0.23](docs/RELEASE-0.23.0.md), les corrections de la
[0.22](docs/RELEASE-0.22.0.md) et le module compact restent inclus.

Le parcours FNIX validé par Kelly, intégré au CLI Node du starter historique.
La propriétaire exprime ses objectifs ; l’agent organise le backlog et le moteur conserve
les autorisations, les preuves et l’historique. Le code applicatif reste séparé du pilotage.

Cette version introduit le workflow par phases. L’import Project Architect v1, les profils
techniques et les fonctions historiques du CLI sont conservés. Le moteur Python du pilote
n’est pas installé : un seul fichier de suivi v3 fait autorité dans les nouveaux workspaces.
Les anciens workspaces restent dans leur format jusqu’à une migration explicite.

Pour commencer : [guide de test et de migration](DEMARRER.md).
Pour retrouver toutes les capacités : [workflow de Kelly](docs/WORKFLOW-KELLY.md).
Pour comparer : [différences depuis la version historique](docs/DIFFERENCES.md).

## Au quotidien

| Appel | Résultat |
|---|---|
| `$project-start` | Reprise claire, état réel, préparation manquante et prochaine action. |
| `$project-next` | Phase recommandée, résultat attendu et spécialiste utile, sans démarrage. |
| `$project-phase 1` | Implémentation, vérifications et corrections dans un mandat persistant. |
| `$project-review` | Revue distincte, corrections nécessaires et résultat à accepter. |

Les capacités `project-discover`, `project-handoff`, `project-setup`, `project-plan` et
`project-ship` restent accessibles. Une préparation déjà autorisée peut être regroupée ;
un dossier Project Architect suffisant n’exige pas une nouvelle découverte du produit.
`project-work` n’est pas installé dans les nouveaux workspaces et son installation y est refusée.

Le backlog est une vue générée : demander « ajoute cette fonctionnalité » à l’agent.
Le planner assure la fonction Product Owner, confrontée aux contraintes techniques. Il ne
fixe pas un nombre de phases : chaque phase vise un résultat cohérent, testable et borné.
Les phases futures peuvent rester sommaires. Aucun ticket ou identifiant à saisir à la main.

## Démarrer sur Mac

Prérequis : Node.js 22 ou supérieur, Git pour préparer un commit, et Codex ou Claude Code
capable de charger les skills et les agents locaux. La disponibilité des modèles dépend
réellement de la session et du compte. `workflow environment` ne fait pas de requête modèle.

L’archive de livraison contient le CLI compilé et ses dépendances JavaScript. Depuis son
répertoire, créer un nouveau projet :

```bash
node dist/index.js workflow init ../mon-projet --name "Mon produit" --owner "Kelly"
```

Pour une copie isolée d’un produit existant :

```bash
node dist/index.js workflow init ../mon-pilote --name "Mon produit" --owner "Kelly" --code-root "/chemin/absolu/vers/la-copie"
```

Les profils `generic`, `node-api`, `nextjs`, `swiftui`, `wordpress` restent disponibles via
`--profile`. Le profil générique convient lorsque la stack n’est pas encore choisie.
Le starter inspecte les sources avant de créer le suivi. Il ignore les sorties usuelles,
dont BuildArtifacts, DerivedData et .build ; ne pas y conserver du code source manuel.

Ouvrir le dossier `mon-projet/ai-workspace`, lancer Codex puis `$project-start`.
Avec Claude Code : ajouter `--adapter claude-code` (ou `--adapter codex,claude-code` pour les deux),
lancer `claude` dans `ai-workspace` puis `/project-start`. Pour ajouter l'autre assistant plus tard :
`node .starter/run.mjs workflow adapter-add claude-code` (ou `codex`), voir
[le changement d'assistant](adapters/README.md#passer-dun-assistant-à-lautre).
Le runtime est copié localement dans le workspace : garder le dossier du starter à côté
n’est pas nécessaire. Il ne modifie pas les installations globales ni le PATH.

Si `codex --version` et l’en-tête d’une session diffèrent, quitter la session et vérifier
`type -a codex`. Le nom configuré d’un modèle ne démontre pas que le serveur l’accepte.
Le starter n’annonce aucune version minimale Astra qu’il n’a pas vérifiée.

## Reprendre le pilote v0.1.1 ou un ancien workspace

Fermer l’ancien agent avant migration. La source reste intacte ; la destination doit être nouvelle.
Depuis cette distribution :

```bash
node dist/index.js workflow migrate --source "/chemin/telecommande-pilote-v011/ai-workspace" --target "../telecommande-v020" --dry-run
node dist/index.js workflow migrate --source "/chemin/telecommande-pilote-v011/ai-workspace" --target "../telecommande-v020"
```

La migration archive les fichiers historiques et leur inventaire SHA-256. Elle reprend
les phases, les tâches humaines et les dépendances convertibles. Pour le starter historique,
le profil et les commandes déclarées sont repris et restent à vérifier sur le poste. Aucune ancienne coche,
revue ou acceptation ne devient automatiquement une preuve sur la révision actuelle.
Les critères historiques incomplets doivent être précisés avant lancement. Les validations
humaines accessibles peuvent être examinées et référencées sans inventer de nouvelles déclarations.
La migration réutilise le chemin du code : elle ne crée pas une nouvelle copie du produit.
Pour un backlog historique v1, faire d’abord sa conversion v1 → v2 avec le CLI historique.

## Project Architect

Fournir le dossier product-package v1 à project-start. Le nom du produit doit correspondre
à celui du manifeste. Import mécanique :

```bash
node .starter/run.mjs intake import "/chemin/product-package" .
```

Cet import est réservé aux entrées idea/brief dont le brief est encore brouillon. Pour du code adopté ou un workspace engagé, utiliser le dossier comme source de changement, sans rétrograder les approbations. L’import valide et archive les sources. Il n’approuve pas le brief. Discover résout les
lacunes d’exécution ; Handoff consigne les décisions réellement applicables ; Setup prépare
le socle minimal ; Plan organise les résultats et leurs dépendances. Ne pas réinstaller
toutes les dépendances du futur produit pendant Setup.

## Modèles et spécialistes

`.starter/models.json` est la configuration centrale. Défauts Codex : coordinateur,
builder et implementer GPT-6.1 Sol medium ; planner et reviewer GPT-6.1 Sol high ; reader GPT-6 Luna medium.
Ces choix sont modifiables et ne constituent pas un benchmark. Après modification :

```bash
node .starter/run.mjs workflow models-sync
```

Les fichiers natifs déclarent réellement modèle et effort des agents. Un skill ne change
pas à lui seul le modèle du parent. Leur structure suit la
[documentation officielle des agents Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents). Les délégations doivent être réalisées par les outils
de la surface, puis leurs résultats examinés. Les replis autorisés sont documentés dans
`fallbacks`; le coordinateur les applique et les annonce, sans prétendre à une détection
automatique de disponibilité. Aucun modèle n’est lancé par le moteur Node.

Pour Claude Code, `claude_model` et `claude_effort` sont lus par rôle ; les identifiants et efforts
OpenAI ne sont jamais transmis. Défauts : coordinateur au choix de la session (`/model`, `/effort`),
planner et reviewer `opus` high, builder `inherit`, implementer `sonnet` medium, reader `haiku`.
Justification et limites : [adaptateur Claude](adapters/claude-code/README.md). Le chargement réel
dans une session Claude Code reste à vérifier sur le compte de Kelly.

## Git et livraison

Git, push et déploiement sont manuels par défaut. Après revue et acceptation, demander
« Prépare le commit de cette phase ». L’agent fournit les fichiers choisis et le message :

```bash
node .starter/run.mjs workflow prepare-commit 1 --path src/fichier.ts --message "Réaliser la phase"
```

La commande ne modifie ni l’index ni l’historique Git. Elle refuse un index déjà rempli,
un fichier préalablement modifié et une revue périmée. Examiner le diff avant d’exécuter
les commandes fournies. Après le commit :

```bash
node .starter/run.mjs workflow verify-commit
```

Le contenu, les fichiers et le parent du commit sont contrôlés. Après une correction du README
survenue après des essais humains, demander à l'agent de vérifier si ces essais restent pertinents :
il examine le diff avec `workflow carry --dry-run` et ne les conserve que si le moteur l'accepte ; la
revue et l'acceptation sur la nouvelle révision restent nécessaires. Cela ne prouve pas un push
ou un déploiement. `project-ship` prépare ces opérations selon la cible et exige ensuite
leur observation réelle ; pas de déploiement universel automatique.

## Validation et limites

Lire [VALIDATION.md](docs/VALIDATION.md) pour les résultats réellement exécutés et leurs limites.
Lire [MOTEUR-PHASES.md](docs/MOTEUR-PHASES.md) pour les commandes, schémas et procédures de reprise.
Le [contrat commun](core/contracts/phase-workflow.md) décrit les responsabilités appliquées par les skills.

Pour le README public d'un produit, l'agent suit [le guide conditionnel](core/contracts/product-readme.md)
(il ne s'applique pas au présent README, qui documente le Starter).

Le suivi local ne fournit ni authentification des humains ni historique infalsifiable.
Une preuve d’exécution peut être techniquement cohérente et insuffisante pour le métier :
la pertinence des tests et l’indépendance de la revue restent à examiner.
Le coût, la vitesse comparée et le fonctionnement de tous les modèles sur le Mac de Kelly
ne sont pas déduits des tests Node. Le code source est empreinté de manière conservatrice ;
les gros projets/assets et les monorepos avec liens symboliques restent à éprouver.

## Développer le starter

```bash
npm ci
npm run validate
```

Les commandes historiques `new`, `adopt`, `intake`, `profile`, `adapter`, `skill`, `agent` et
`backlog` restent dans le même CLI. Elles ne doivent pas créer un second plan dans un
workspace v3. Pour les règles de l’ancien format, consulter l’historique Git et les références
`legacy-v014.md`. Les autres documents historiques ne remplacent pas le contrat v0.22 ci-dessus.
