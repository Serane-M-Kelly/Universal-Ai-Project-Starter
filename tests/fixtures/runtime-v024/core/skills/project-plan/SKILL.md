---
name: project-plan
description: "Organiser le backlog sous la direction de la propriétaire avec une fonction Product Owner et une vérification technique du découpage, des critères et des dépendances."
---

# project-plan

Sans `.starter/workflow.json`, suivre uniquement [la procédure historique](references/legacy-v014.md).
Avec un suivi v3, appliquer la suite ci-dessous.

Lire `.starter/WORKFLOW.md`, le brief et workflow status. Assurer la fonction Product Owner ou la
confier au planner configuré si utile. Consulter le code et les contraintes techniques ; demander
une contre-analyse technique lorsque l'incertitude justifie un second regard. Ne pas créer une équipe
permanente. Définir une phase par un résultat cohérent et vérifiable, avec exclusions et dépendances.
Éviter les grandes phases techniques comme « tout le backend » et les microphases par fichier.
Détailler la prochaine phase ; les phases lointaines peuvent garder des tâches et critères à préciser.
Pour une évolution, classifier : correction actuelle, ajout indépendant, changement d'actif/priorité,
ou idée non engagée. Ne pas interrompre l'actif pour un ajout indépendant. Faire trancher seulement
les conséquences qui exigent une décision nouvelle. Préserver identités et acquis du plan existant.
Écrire un fichier JSON de proposition : tableau de {id?, title, goal, validation, excludes, depends_on,
optional, agent, tasks:[{id?,title,human}], sources?:[{path,sha256}]}. Épingler les sources PA/AD
utiles à cette phase après lecture avec `workflow sources --path CHEMIN`. Reprendre les sources
existantes ; [] les retire explicitement après examen du changement. Relier critères produit,
états visuels et contrôles fonctionnels sans dupliquer le dossier. Reprendre les identités de workflow context/status pour
les éléments existants ; omettre id pour les nouveaux. Les dépendances utilisent les ids de phase
ou les titres uniques de la proposition, résolus par le moteur lors du premier enregistrement.
`workflow plan --file PLAN_JSON --by PERSONNE --request MOTS_REELS` applique la demande autorisée.
--allow-active-change n'est utilisé qu'après arbitrage explicite affectant l'actif. Le moteur conserve
l'historique et invalide les mandats/acceptations affectés, pas les phases futures indépendantes.
Ne pas éditer BACKLOG.md ni workflow.json. Restituer le plan lisible et l'impact, puis project-next.
L'ajout de fonctionnalités ne constitue pas une autorisation de les implémenter immédiatement.

## Visibilité dans la recherche, selon le périmètre

Pour un périmètre SEO applicable, lire `.starter/runtime/core/contracts/search-visibility.md`. Relier aux phases les critères utiles, la préservation des URL lors des refontes, les contrôles sur la cible publiée et le suivi après observation. Réutiliser les sources produit et leur mécanisme d’épinglage ; aucun backlog SEO parallèle. Ne pas bloquer la livraison technique sur une hausse future de trafic ni lancer le suivi sans mandat.
