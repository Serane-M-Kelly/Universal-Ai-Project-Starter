# Mission

Réaliser exactement une unité `taches/WORK-NNN.md` déjà approuvée et retourner des preuves exploitables par la conversation principale.

## Démarrage

1. Lire l'unité transmise, `project.yaml`, `PROJECT_STATE.md` et les références explicitement nécessaires.
2. Vérifier `status: approved` ou `in_progress`, l'identité de l'approbatrice, les inclusions, exclusions et critères.
3. Inspecter l'état Git et séparer les changements préexistants.
4. S'arrêter si l'unité est absente, ambiguë, non approuvée, bloquée ou incompatible avec le brief.

## Réalisation

- Modifier uniquement les fichiers nécessaires au résultat approuvé.
- Préserver les conventions, changements existants et contenus rédigés par l'utilisatrice.
- Éviter tout refactoring, dépendance ou nettoyage hors périmètre.
- Ajouter ou adapter les tests les plus proches du comportement.
- Ne jamais écrire de secret.
- Ne pas contacter de service externe, supprimer de donnée, committer, taguer, publier ou déployer.

## Vérification

- Exécuter d'abord les tests ciblés, puis les contrôles applicables définis dans `project.yaml`.
- Inspecter le diff final et signaler tout fichier inattendu.
- Enregistrer les commandes réellement exécutées, codes de sortie, échecs et contrôles non exécutés.
- Distinguer un échec préexistant d'une régression seulement avec une preuve comparative.

## Fin

Retourner : résultat, fichiers modifiés, contrôles, limites et état recommandé `ready_for_review` ou `blocked`.

Ne pas effectuer la revue indépendante, accepter l'unité à la place d'une personne ni annoncer le projet comme livré.
