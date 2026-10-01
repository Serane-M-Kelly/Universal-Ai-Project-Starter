# Lecture compacte — version 0.21.0

Cette version ajoute notre première alternative ciblée à RTK. Elle ne dépend pas du logiciel RTK,
ne l’installe pas et ne fournit pas un proxy universel des outils. Elle traite les lectures du
workflow Node du starter, sans service externe, sans appel à un modèle de résumé et sans nouvelle
dépendance. L’algorithme fonctionne indépendamment du modèle ; le gain dépend de ce qu’il lit.

## Ce qui est livré

- `workflow status --compact` et `next --compact` : état lisible sans longues listes de tâches déjà
  réalisées lorsque cette représentation réduit le volume. Toutes les phases et leurs états restent visibles.
- `workflow context N --compact` : phase complète avec tâches humaines, critères, exclusions,
  mandat et changements préexistants ; anciennes preuves omises lorsque leurs empreintes ne
  correspondent plus. La dernière revue historique reste explicite. Aucun gain sur un petit
  contexte : le moteur renvoie alors sa représentation habituelle.
- `workflow report ID` : vérifie l’empreinte du rapport enregistré avant lecture. Regroupe seulement
  des séries de lignes de tests réussis reconnues au format spec (`✔ titre (1ms)` / `✓ ...`).
  Conserve les autres lignes, les métadonnées de commande et stderr. Échecs, revues, observations,
  formats inconnus et rapports trop courts restent intégraux.
- `workflow report ID --raw` : texte original complet, sans exécuter à nouveau le contrôle.
- `workflow report ID --stream stdout --offset 0 --limit 12000` : extrait exact, avec prochain
  offset et volume omis explicites. Flux possibles : stdout, stderr, original. Les offsets sont des
  unités UTF-16 JavaScript, pas des lignes ou des octets. Concaténer les contenus restitue le texte.
- `workflow sources` : empreintes du brief et des règles pour détecter un changement. Le premier
  chargement doit rester complet. Aucun cache persistant n’affirme que l’agent a lu un document.
- `--metrics` avec report ou une vue compacte : mesure les octets UTF-8 des réponses JSON,
  métadonnées de provenance comprises. L’enveloppe de mesure elle-même et le retour à la ligne CLI
  sont exclus et indiqués comme tels. Aucune estimation de tokens n’est présentée comme un fait.

Start, Next, Phase et Review utilisent ces lectures dans leurs instructions. Les neuf skills
restent les mêmes pour Kelly. Les cinq autres réutilisent les règles communes de lecture ciblée.
Les modèles, leurs efforts, les permissions et le mode de livraison restent configurés comme avant.

## Ce qui reste inchangé dans les preuves

`workflow check` exécute toujours la commande réelle et archive ses sorties et son résultat.
Il renvoie déjà une courte référence : la 0.21 ne réduit pas cette réponse. Le bénéfice apparaît
quand l’agent doit consulter le rapport ou reprendre une phase avec beaucoup d’historique.

La lecture ne crée pas de preuve, n’accepte pas de phase et ne change pas le backlog. Le statut
passed vient du moteur, du code de sortie et de la stabilité des sources, jamais du texte « réussi ».
Un rapport historique est accessible avec son indication de fraîcheur. Il ne valide pas le code
courant. Un rapport modifié ou redirigé par un lien interne est refusé. Un hash local n’est ni une
signature d’identité ni une protection contre une modification coordonnée des fichiers.

Le code de sortie de `report` indique si la lecture a réussi ; il peut être 0 alors que
`proof.passed` est false. Pour décider si le travail est prêt, utiliser le statut de la phase et les
critères, pas le succès de la commande de lecture.

## Où s’arrête cette première version

Ce module ne compresse pas automatiquement tous les Bash, recherches, MCP, captures ou documents.
Il n’intercepte pas les conversations, ne réduit pas le raisonnement interne d’un modèle et ne
connaît pas les tokens facturés par Codex ou Claude Code. Il ne remplace pas la lecture du code,
du brief ou des références artistiques utiles. Il ne résume pas les revues indépendantes.

Les instructions des skills guident l’utilisation ; elles ne garantissent pas qu’un agent choisira
chaque fois la lecture la moins coûteuse. Un agent qui ouvre d’abord le compact puis tout l’original
consomme davantage de texte que s’il avait directement ouvert l’original. Il faut évaluer cela sur
les projets réels avant d’ajouter d’autres filtres. Les sorties très longues non reconnues restent
longues : demander un extrait est une décision explicite, jamais une troncature silencieuse.

## Vérifier et mesurer

Depuis le dossier de distribution :

```bash
npm run validate
node scripts/benchmark-context.mjs
```

Le benchmark crée puis supprime un workspace de simulation. Il exécute réellement 400 tests
`node:test` très simples, lit leur rapport, puis compare un contexte ayant un historique de preuves.
Ce sont des données de mesure synthétiques, pas des preuves d’acceptation de ton produit.
Les résultats de préparation de cette distribution sont dans `CONTEXT-BENCHMARK.json`.
Ils incluent le cas défavorable : lecture compacte suivie de l’original complet.

Comparer ensuite deux séances sur un même travail réel : quantité de texte consultée, retours aux
originaux, temps humain, défauts et consommation exposée par l’outil s’il la rend disponible.
Aucun pourcentage de réduction des tokens ou de la facture n’est garanti par ce benchmark.

## Compatibilité avec un workspace existant

Le schéma de suivi reste v3. Depuis le dossier de la nouvelle distribution, ces commandes permettent
un essai en lecture seule sur un workspace 0.20.x (adapter le chemin) :

```bash
node dist/index.js workflow status --workspace "/chemin/ai-workspace" --compact --metrics
node dist/index.js workflow context 1 --workspace "/chemin/ai-workspace" --compact --metrics
```

Cela ne remplace pas son runtime installé, ses skills ou ses personnalisations. Le moteur local
`.starter/run.mjs` de cet ancien workspace reste à sa version précédente. Ne pas mettre les seuls
skills à jour vers des commandes que son runtime ne possède pas. Cette livraison installe l’ensemble
cohérent lors d’un `workflow init` dans une nouvelle destination ; elle ne fournit pas de mise à
niveau automatique sur place. Ne pas utiliser la migration legacy pour convertir un état déjà v3.

## Mesures de cette distribution (Linux, Node 24.19.0)

| Lecture synthétique | Original | Compact | Réduction de volume |
|---|---:|---:|---:|
| Rapport de 400 tests réussis | 15 739 octets | 1 603 octets | 89,82 % |
| Phase avec 9 preuves historiques et 1 courante | 7 508 octets | 1 919 octets | 74,44 % |

Rapport compact puis un extrait de 1 500 caractères : 4 252 octets au total.
Rapport compact puis original complet : 17 342 octets, soit **1 603 octets de plus** que la seule
lecture complète. La réponse de `workflow check` sans lecture du rapport ne pesait déjà que
114 octets ; le module ne fait rien gagner à ce stade. Les horodatages et durées peuvent faire
légèrement varier les tailles lorsque le benchmark est relancé.
