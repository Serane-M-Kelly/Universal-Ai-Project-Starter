# README public du produit

Référence conditionnelle du workflow v3. Dans un workspace installé, ce fichier est accessible à
`.starter/runtime/core/contracts/product-readme.md`. La consulter quand le README d'un produit est
créé, réorganisé ou repris, ou quand une livraison change ce qu'il annonce (fonction, commande,
configuration, URL, licence). Une coquille ou une retouche locale n'impose ni relecture du guide ni
contrôle global. Ce guide oriente la rédaction ; il n'ajoute aucun blocage au moteur.

Il vise les produits accompagnés par le Starter, pas le README du Starter lui-même.
Structure de référence : README de Calepio (blob `1a08c857f93b59dd67a247b93f037bb87b60c7d4`, lu le
3 octobre 2026). Reprendre son organisation, jamais ses affirmations, sa stack ou son statut juridique.

## Socle à adapter

Sept blocs, dans cet ordre lorsque c'est utile. Adapter intitulés et profondeur au produit ; fusionner
ou omettre un bloc sans contenu réel plutôt que laisser une rubrique vide.

1. **Nom et présentation** : ce que fait le produit en une ou deux phrases concrètes, pour qui et dans
   quel usage, puis le statut réel (prototype local, bêta, publié, maintenu, archivé).
2. **Fonctionnalités** : seulement ce qui est disponible et vérifiable dans cette version.
3. **Limites et données** : limites connues ; stockage, transmission, comptes, traceurs ou services
   tiers lorsque c'est pertinent ; distinguer clairement livré et prévu.
4. **Stack et prérequis** : technologies et versions effectivement requises, lues dans la configuration.
5. **Commandes et démarrage** : installation et lancement reproductibles, commandes exactes du dépôt.
6. **Architecture et tests** : aperçu bref, puis liens vers la documentation publique existante.
7. **Crédits et licences** : licence réelle du code, attributions et licences tierces obligatoires.

| Produit | Adaptations habituelles |
|---|---|
| Site statique | Commandes de build/prévisualisation, dossier généré, URL publiée si elle existe, polices et images créditées. |
| API | Base URL ou lancement local, authentification, variables d'environnement, format d'erreur ou lien vers la référence d'API, données conservées. |
| Application mobile | Plateformes et versions minimales, outil de build réel (Xcode, Gradle, Flutter…), permissions demandées, distribution (TestFlight, store) seulement si elle existe. |
| WordPress | Version WordPress/PHP requise, installation de l'extension ou du thème, Composer/WP-CLI s'ils sont utilisés, licence GPL compatible, hooks ou réglages exposés. |

## Extensions conditionnelles

| Contexte | Contenu à ajouter |
|---|---|
| Produit publié | URL réelle de démonstration ou d'utilisation, après observation de la cible. |
| Interface visuelle | Capture représentative ou courte démonstration accessible (texte alternatif) ; aucune maquette annoncée comme rendu réel. |
| Configuration nécessaire | Variables, services et fichier d'exemple sans secret (`.env.example` ou équivalent). |
| Produit à déployer | Procédure ou lien vers le guide de déploiement adapté. |
| Contributions prévues | Contribution, signalement de problèmes et contact réellement disponibles. |
| Signalement confidentiel | Canal de sécurité effectivement surveillé (SECURITY.md, adresse dédiée). |

## Règles de contenu

- Ne pas raconter le pilotage : aucun PA, AD, Starter, ai-workspace, phase, identifiant de preuve ou
  chemin interne. Garder les informations techniques publiques utiles : tests, limites connues,
  accessibilité et vérifications réellement faites.
- Chaque affirmation se vérifie sur ce produit. Ne jamais recopier « aucune donnée enregistrée »,
  « aucun traceur », « non publié », `noindex` ou une conformité sans l'avoir constaté ici.
- Licence : reprendre le fichier LICENSE et les métadonnées (package.json, composer.json, en-tête
  WordPress). Sans licence, l'écrire ; ne pas inventer MIT. Conserver les attributions obligatoires
  (polices, images, code tiers) et lier leurs textes de licence présents dans le dépôt.
- Commandes : les déduire de la configuration réelle (scripts, verrou, Makefile, composer.json,
  Package.swift…). Pas de commande npm pour un projet qui n'utilise pas npm ; respecter le
  gestionnaire du verrou. Exécuter les commandes de démarrage lorsque c'est possible.
- Réutiliser la documentation publique existante et la lier ; ne pas créer tous les fichiers cités
  par Calepio. Un lien local doit viser un fichier présent.
- Ne pas écraser des instructions d'exploitation, de sécurité ou de contribution déjà utiles : les
  intégrer, les déplacer avec un lien, ou les conserver telles quelles.
- Secrets : jamais de valeur réelle, seulement des exemples ou des emplacements.

## Nouveau projet

Setup crée un README minimal et exact pour l'état présent (présentation, statut, prérequis et
commandes vérifiées) ; les autres blocs attendent un contenu réel. Une phase qui livre une
fonctionnalité, une commande ou une configuration met à jour le bloc concerné dans son mandat.
Review compare le README modifié au produit livré. Ship ajoute l'URL publiée seulement après son
observation. Ces mises à jour suivent les règles ci-dessus sans relire tout le guide à chaque fois.

## Reprise d'un README existant

Seulement pour un dépôt concrètement sélectionné par la propriétaire ; ne pas parcourir ni réécrire
d'autres dépôts. Procédure conservatrice :

1. Inventorier le README actuel : rubriques, commandes, liens, variables, licences, informations
   d'exploitation, de sécurité et de contribution. Lire les documents publics qu'il cite.
2. Vérifier chaque élément contre le dépôt et le produit réel ; noter ce qui est faux ou invérifiable.
3. Proposer la nouvelle version comme aperçu : diff, informations déplacées, retirées (avec motif)
   et points à confirmer. Ne rien écrire hors du mandat ou de la demande explicite.
4. Après accord, appliquer dans le dépôt sélectionné, puis contrôler (section suivante) en comparant
   à la version précédente. Une information utile retirée sans équivalent se rétablit ou se justifie.

## Contrôles

`node .starter/run.mjs workflow readme-check [--path README.md] [--previous-ref HEAD]` signale, en
lecture seule : liens locaux et ancres absents, commandes absentes de la configuration, variables
d'exemple non documentées ou introuvables, valeurs ressemblant à des secrets, vocabulaire de pilotage,
affirmations sans trace ou contredites, licences divergentes, attributions non référencées et, avec
`--previous-ref` ou `--previous FICHIER`, informations retirées. `--code-root CHEMIN` vise un dépôt
sans workspace. Le code de sortie reste 0 : les constats sont des signaux à examiner, pas une preuve.
**L'absence d'avertissement ne prouve pas que le README est exact ou complet**, notamment sur les
données, la sécurité ou les licences : ces points se vérifient sur le produit.
Il n'exécute pas les commandes, n'ouvre pas les liens externes et ne remplace ni la relecture ni
l'essai réel. Pour une capture, vérifier qu'elle provient du produit actuel.

Une correction du README après des essais humains ne justifie pas de les refaire si elle ne touche
pas ce qu'ils vérifient : utiliser `workflow carry` (voir `phase-workflow.md`). La revue du
changement et l'acceptation restent requises.

## Squelette indicatif

```markdown
# Nom

Présentation concrète : ce que fait le produit, pour qui, dans quel usage.

**Statut : …** (réel et daté si utile)

## Fonctionnalités
## Limites et données
## Stack et prérequis
## Commandes
## Architecture et tests
## Crédits et licences
```

Ajouter les extensions conditionnelles utiles, renommer ou fusionner les rubriques selon le produit.
