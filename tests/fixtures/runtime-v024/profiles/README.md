# Profiles

Un profil décrit les particularités techniques d'une famille de projets sans modifier le workflow commun.

## Ce qu'un profil possède

Chaque profil possède un manifeste `profile.yaml` validé par le schéma du cœur. Il déclare :

- son identifiant et sa version ;
- les modes d'entrée compatibles ;
- sa stratégie de configuration des commandes ;
- les commandes obligatoires ;
- les principes et résultats attendus du setup ;
- les fichiers ou dossiers techniques à contrôler, y compris plusieurs alternatives valides ;
- les structures à nom variable et les preuves textuelles bornées à rechercher dans les sources ;
- les champs obligatoires de manifestes JSON et les emplacements alternatifs acceptés.

Un profil ne contient ni le brief produit, ni les agents, ni les instructions propres à un assistant IA.

## Fonctionnement

Lors de `new` ou `adopt`, le CLI :

1. charge le profil demandé avec `--profile` ;
2. valide son manifeste ;
3. vérifie sa compatibilité avec le mode d'entrée ;
4. écrit son identifiant et sa version dans `project.yaml` ;
5. applique uniquement les valeurs déclarées par le profil ;
6. détecte les commandes existantes si la stratégie l'autorise.

Lors de `doctor`, le CLI recharge le profil, compare sa version et exécute ses exigences. Un profil absent, invalide ou incompatible produit un verdict `BLOCKED`.

## Stratégies de commandes

- `detect-existing` : détecter uniquement des commandes prouvées par le projet existant ;
- `profile-defaults` : utiliser les commandes explicitement déclarées par le profil ;
- `manual` : ne rien détecter et attendre une configuration explicite.

La valeur `null` signifie « commande inconnue ou indisponible ». Elle est préférable à une commande inventée.

## Règles de création

- Un profil couvre une famille technique, pas un seul projet.
- Un chemin exigé est relatif au `code_root` et ne peut jamais en sortir.
- Toute nouvelle structure du manifeste nécessite une nouvelle version de schéma.
- Une nouvelle version de profil ne remplace jamais silencieusement la version inscrite dans un projet.
- Un profil spécialisé n'est créé qu'après un besoin observé sur des cas réels.

Profils disponibles :

- [`generic`](generic/README.md), neutre et sans structure imposée ;
- [`node-api`](node-api/README.md), service HTTP TypeScript sans framework imposé ;
- [`nextjs`](nextjs/README.md), application Next.js TypeScript compatible App Router et Pages Router ;
- [`swiftui`](swiftui/README.md), application SwiftUI définie par un projet Xcode ou un package Swift ;
- [`wordpress`](wordpress/README.md), site complet, extension ou thème WordPress.
