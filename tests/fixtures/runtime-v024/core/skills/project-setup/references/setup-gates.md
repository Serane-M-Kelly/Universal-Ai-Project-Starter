# Portes de vérification du setup

Appliquer uniquement les contrôles pertinents et documenter toute exception. Un contrôle non applicable exige une raison ; un contrôle non exécuté n'est pas réussi.

## Porte commune

- `ai-project doctor` ne retourne aucun blocage.
- `code_root` et `repository_root` correspondent aux chemins déclarés.
- Les changements Git préexistants ont été identifiés et préservés.
- Le gestionnaire de paquets et son verrouillage sont cohérents.
- Les versions minimales des runtimes sont documentées ou fixées.
- L'installation et le démarrage sont reproductibles depuis la documentation.
- Les variables nécessaires possèdent un exemple sans secret.
- Les commandes inscrites dans `project.yaml` existent réellement.
- Les contrôles applicables ont été exécutés avec leurs codes de sortie.
- Aucun secret, artefact local ou fichier privé n'est apparu dans le dépôt.
- Le diff ne contient aucune fonctionnalité métier ni changement hors périmètre.
- Les choix structurants sont reliés à une décision humaine.

## Nouveau projet

- Le brief courant est approuvé et sa version est enregistrée dans l'état.
- La stack choisie répond aux contraintes du brief sans dépendance anticipée.
- Le squelette démarre ou produit son résultat minimal attendu.
- Un test de santé minimal vérifie l'outillage, pas une fonctionnalité fictive.
- Les dossiers et abstractions sans usage actuel ont été évités.

## Dépôt existant

- La structure et les conventions existantes restent propriétaires.
- Aucun générateur n'a remplacé silencieusement des fichiers existants.
- Les dépendances et fichiers de verrouillage n'ont pas été changés sans nécessité.
- Les commandes initialement disponibles ont été comparées après modification.
- Les échecs préexistants sont distingués des régressions introduites.
- Une procédure de retour arrière existe pour toute adaptation risquée.

## Interprétation des contrôles

- `réussi` : commande exécutée avec le résultat attendu ou fichier inspecté avec preuve ;
- `échoué` : résultat contraire au critère ;
- `non exécuté` : absence d'autorité, d'outil ou de temps ;
- `non applicable` : le critère ne correspond pas au projet, avec justification.

Seul `réussi` satisfait une porte obligatoire.
