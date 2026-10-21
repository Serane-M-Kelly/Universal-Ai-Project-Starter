---
name: project-start
description: "Reprendre ou démarrer un projet, retrouver ses acquis et guider la préparation ou le travail actif sans demander de prompts techniques de coordination."
---

# project-start

Lire `.starter/WORKFLOW.md` et les frontières de
`.starter/runtime/core/contracts/action-authority.md` pour les transitions. Exécuter `workflow status --compact` et `doctor . --json --compact` via le moteur local.
Examiner les blocages et les sources utiles. Sans workflow v3, proposer la migration vers un nouveau
workspace et conserver l'historique ; ne pas exécuter les opérations v3 sur un ancien état.
Si status indique backlog_refresh_needed, régénérer la vue avec workflow repair-view en attribuant
la demande de reprise réelle ; examiner et archiver une éventuelle édition manuelle avant cela.
Pour un produit neuf ou un dossier Project Architect, examiner le code et les décisions existantes,
importer le dossier s'il est fourni puis préparer les éléments réellement manquants. Réutiliser
les skills Discover, Handoff, Setup et Plan lorsque nécessaires et autorisés ; ne pas exiger que
la propriétaire relance chaque étape administrative. Ne pas recommencer une recherche suffisante.
Pour une reprise, rappeler résultat acquis, phase active, obstacle éventuel et prochaine action.
Ne pas lancer une phase si la demande porte uniquement sur la reprise. Ne pas confondre un choix
d'architecture à proposer et une autorisation de modifier le produit. Vérifier l'environnement
avant la première délégation, sans exécuter toutes les vérifications à chaque reprise.

Pour lire une preuve, utiliser `workflow report ID_PREUVE`. Le regroupement des tests réussis
ne démontre pas leur couverture : lire les noms ou assertions utiles avec --raw ou --stream.
Les erreurs et les revues restent intégrales. Ne pas refaire un contrôle pour retrouver son log.
Exécuter `workflow sources` à la reprise : lire intégralement le brief et les règles présents
si leur contenu n’est plus dans le contexte ou si leur empreinte a changé.

## Visibilité dans la recherche, selon le périmètre

Si la demande porte sur le suivi SEO d’un site lancé, lire Suivi dans `.starter/runtime/core/contracts/search-visibility.md` et reprendre les observations/exports accessibles, la période et les critères existants. Sans données, nommer ce qui manque ; ne pas inventer de mesures ni relancer l’implémentation. Pour une autre reprise, ne pas rouvrir un audit SEO sans impact.
