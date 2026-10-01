# Version 0.22.0 — modifications issues de l’audit

Le parcours reste Start → Next → Phase → Review, puis Ship selon la demande.
PA conserve les décisions produit ; AD la direction visuelle ; le Starter réalise et vérifie.
Les neuf skills restent actifs. Project Work reste réservé aux workspaces historiques.

## Corrections

- **Skills natifs :** `skill add`, `skill sync` et `skill upgrade` utilisent l’adaptateur déclaré dans
  `.starter/models.json` pour un workspace v3. Une personnalisation indépendante d’une copie est
  signalée avant remplacement. `--force` reste un choix explicite après examen.
- **Compatibilité :** Discover, Handoff, Setup, Plan et Ship aiguillent explicitement l’ancien
  format vers leurs références historiques. Les quatre skills propres aux phases refusent une
  installation legacy. Le catalogue déclare les formats et le runtime minimal requis.
- **Doctor compact :** `doctor . --json --compact` exécute les mêmes contrôles et conserve verdict,
  avertissements, blocages et codes de sortie. Les diagnostics positifs sont comptés. Omettre
  `--compact` pour les détails. Start emploie cette sortie courte.
- **Références PA/AD :** le plan peut épingler les fichiers utiles à une phase. Une modification,
  disparition ou substitution par un lien empêche les nouvelles preuves et l’acceptation de cette
  phase, ainsi que la préparation de son commit. Le moteur ne décide pas du sens de la modification.
- **Contexte et agents :** les missions restent bornées ; pas de cumul systématique builder/implementer,
  ni de briefing complet pour une petite tâche. La revue dans un contexte distinct est conservée.
- **Documentation :** la promesse excessive de comparaison historique de Doctor a été corrigée
  dans Project Work. Les versions des skills modifiés et la distribution ont été incrémentées.

## Utilisation des sources produit et visuelles

L’agent lit les documents pertinents, puis récupère leurs empreintes :

```bash
node .starter/run.mjs workflow sources --path design/INDEX.md --path design/tokens.json
```

Il reprend les champs `path` et `sha256` retournés dans le tableau `sources` de la phase proposée
à `workflow plan`. Les chemins sont relatifs au workspace, sans lien symbolique ni sortie du dossier.
Les exigences restent dans les documents propriétaires ; leurs critères observables figurent dans
la phase. Le manifeste PA v1 conserve son format et ses dix fichiers.

Épingler chaque fichier nécessaire : l’empreinte d’un index ne suit pas automatiquement ses liens.
Une source distante nécessite un export local identifié ou une version externe consignée avec sa
limite d’accès. Le Starter n’interroge pas automatiquement Claude Design, Figma ou une URL.
Le code applicatif et ses assets restent suivis par l’empreinte de l’arbre source.

`context` affiche l’état des références ; `sources` inclut celles de la phase active ; `report`
indique leur correspondance courante lorsqu’elles existent. Les lectures compactes gardent ces
informations. Une empreinte ne prouve ni l’approbation humaine ni la pertinence d’un document.

Si un fichier change, examiner son impact puis réviser le plan dans l’autorisation applicable.
La révision de l’actif exige l’arbitrage explicite déjà prévu. L’omission de `sources` conserve les
références existantes ; `sources: []` demande leur retrait. Le moteur n’actualise jamais une empreinte
en silence. Les anciennes acceptations restent des jalons historiques ; elles ne justifient pas un
nouveau commit quand les références ont changé. Les phases sans source épinglée gardent leur contrat
antérieur : aucune obligation de créer un dossier AD pour une tâche sans interface.

## Modèles proposés pour une nouvelle installation

| Rôle | Modèle | Effort |
|---|---|---|
| Coordinateur, builder, implementer | GPT-6.1 Sol | medium |
| Planner, reviewer | GPT-6.1 Sol | high |
| Reader | GPT-6 Luna | medium |

Ce sont des points de départ configurables, pas un classement mesuré sur les projets de Kelly.
Choisir une délégation uniquement si elle apporte un travail utile. Pour une difficulté réelle,
un effort supérieur ou Astra peut être proposé sans changer le périmètre. Un skill ne change pas
le modèle parent. La disponibilité et le réglage réellement appliqué se vérifient dans la session.
Les replis restent explicites dans `fallbacks`. Claude hérite de sa session sauf `claude_model`
configuré : aucun identifiant OpenAI n’est imposé à cet adaptateur.

Sources officielles consultées le 1er octobre 2026 :
[sélection des modèles](https://learn.chatgpt.com/docs/model-selection),
[GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol),
[agents Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents).
Les tarifs API ne mesurent pas les quotas de l’abonnement ChatGPT.

## Installation et projets déjà créés

Pour un nouveau projet, utiliser `workflow init` depuis cette distribution : runtime, contrat,
skills et copies natives sont installés ensemble. Pour le code d’un produit existant, `--code-root`
permet de préparer un nouveau workspace de pilotage ; il ne récupère pas automatiquement le plan
et les preuves d’un ancien workspace v3.

Cette version ne fournit pas de mise à niveau automatique sur place des workspaces 0.20/0.21.
**Ne pas copier les seuls skills ou le seul workflow.json dans une ancienne installation.** Les
opérations sur les skills refusent un runtime local inférieur à 0.22.0. Leur mise à niveau ne met
pas à niveau le moteur, ses schémas ni le contrat commun. Conserver le workspace engagé tant que
son transfert complet n’a pas été préparé. `workflow migrate` reste réservé aux formats legacy ;
il ne sert pas à migrer un workspace déjà v3.

## Validation et économies

Voir [VALIDATION.md](VALIDATION.md) pour les commandes effectivement exécutées. Les nouvelles
régressions couvrent les deux adaptateurs, les conflits de personnalisation, le routage historique,
les sorties Doctor et les changements de références avant/pendant/après les vérifications.

La lecture compacte réduit le volume transmis sur certains cas ; elle ne garantit aucun pourcentage
de tokens ou de facture. Lire compact puis tout l’original peut coûter davantage. Pour une revue
des assertions, ouvrir directement les détails nécessaires. Ne jamais réutiliser un contrôle périmé
pour économiser une exécution. Les permissions et les commits/push/déploiements manuels restent inchangés.
