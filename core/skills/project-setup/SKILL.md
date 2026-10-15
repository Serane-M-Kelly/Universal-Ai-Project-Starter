---
name: project-setup
description: "Préparer ou fiabiliser le socle technique minimal et ses vérifications pour le produit cadré, en conservant le code existant et en identifiant les expertises utiles."
---

# project-setup

Identifier d'abord le suivi réellement accessible dans le projet. Si l'absence de
`.starter/workflow.json` est constatée après inspection, suivre uniquement
[la procédure historique](references/legacy-v014.md). Si le dépôt ou le suivi n'est pas
accessible, déclarer son état **inconnu**, sans déduire un parcours historique de cette
absence d'accès ; préparer des options conditionnelles sans simuler des commandes exécutées.
Avec un suivi v3 constaté, appliquer la suite ci-dessous.

Lire `.starter/WORKFLOW.md`, le brief et le profil de project.yaml. Inspecter code, Git, dépendances,
commandes réellement disponibles et premières capacités prévues avant les choix techniques.
Ne pas imposer de stack ni installer toutes les dépendances du futur produit. Proposer les décisions
techniques qui permettent de reprendre les composants, tokens, polices et actifs AD pertinents ;
identifier leurs versions et contraintes réelles. Proposer les autres décisions
durables encore ouvertes ; réaliser les ajustements locaux déjà autorisés. Conserver le code adopté.
Définir les vérifications adaptées à la stack, sans inventer un scheme Xcode ou un accès réseau.
Contrôler les modèles avec workflow environment ; demander les observations du poste si nécessaire.
Définir les rôles utiles dans .starter/models.json puis workflow models-sync. Le spécialiste
Product Owner/plan confrontera ensuite le découpage aux dépendances techniques.
Conserver un rapport concis sur ce qui fonctionne, les commandes vérifiées et les limites ;
`workflow setup-record --report CHEMIN --by AGENT --request MISSION` enregistre cette référence.
Un rapport seul ne prouve pas la faisabilité ; ne pas annoncer une vérification non réalisée.
Passer à project-plan lorsque le socle suffit pour la prochaine phase.

## Architecture, données et sécurité selon le risque

Pour toute persistance, authentification, réservation, intégration ou risque technique significatif,
lire les sections Setup de `.starter/runtime/core/contracts/architecture-data-security.md`.
Définir responsabilités et flux, modèle de données et invariants, menaces pertinentes et contrôles
vérifiables avant les phases qui en dépendent. Pour des données déjà présentes, identifier
leurs rattachements et migrations comme prérequis des garanties d'intégrité ou d'isolation ;
ne pas déclarer un socle prêt à les assurer sans les preuves correspondantes. Consigner les décisions techniques dans les sources
existantes ou un dossier consultable si la complexité ou la demande le justifie ; aucun document
supplémentaire obligatoire pour une simple landing statique. Reprendre les exigences PA sans
créer de backlog, de schéma ou de registre parallèle.

## README du produit

Pour un nouveau produit, créer ou vérifier un README minimal et exact selon la section Nouveau projet de `.starter/runtime/core/contracts/product-readme.md`. Pour un produit adopté, ne pas réécrire le README existant sans demande ; sa reprise suit la procédure conservatrice du même guide.

## Visibilité dans la recherche, selon le périmètre

Pour les pages publiques avec un enjeu de recherche, lire Setup et Plan dans `.starter/runtime/core/contracts/search-visibility.md`. Examiner rendu, URL, environnements, capacités existantes et moyens de contrôle avant de proposer des dépendances. Ne pas ajouter de framework ou plugin SEO par habitude.
