# Profil generic

Le profil `generic` est le point de départ neutre du starter.

## Quand l'utiliser

- la technologie n'est pas encore choisie ;
- le projet est non technique ou mélange plusieurs technologies ;
- aucun profil spécialisé ne correspond encore ;
- un dépôt existant doit être adopté sans supposition sur sa stack.

## Ce qu'il fait

- accepte les modes `idea`, `brief`, `existing` et `maintenance` ;
- initialise toutes les commandes à `null` ;
- lors d'une adoption, détecte uniquement les commandes démontrées par un manifeste reconnu ;
- n'impose aucun fichier ou dossier technique dans l'application ;
- conserve tous les contrôles universels du cœur : configuration, sources de vérité, Git, confidentialité et secrets.

Le premier détecteur reconnaît `package.json` et les gestionnaires npm, pnpm, Yarn et Bun. Pour les autres écosystèmes, les commandes restent à `null` tant qu'elles ne sont pas explicitement configurées.

## Ce qu'il ne fait pas

- choisir une technologie ;
- générer l'application ;
- installer des dépendances ;
- inventer une commande de test, de build ou de déploiement ;
- remplacer un futur profil spécialisé.
