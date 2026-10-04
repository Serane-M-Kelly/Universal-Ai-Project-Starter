---
name: project-next
description: "Recommander la prochaine phase réalisable, son résultat et le spécialiste adapté, sans commencer son implémentation ni modifier les priorités de la propriétaire."
---

# project-next

Lire `.starter/WORKFLOW.md`, puis `workflow next --compact`. Lire le contexte de la phase proposée seulement.
Si une phase est active, indiquer comment la reprendre ou ce qui attend son acceptation. Ne pas
recommander une nouvelle phase pour contourner un blocage. Sinon expliquer objectif, résultat
observable, dépendances et agent utile. Détailler une phase future insuffisamment cadrée avec
la fonction Product Owner avant son lancement. Ne pas transformer une suggestion de priorité
en décision humaine. Terminer par un appel court à project-phase avec le numéro visible.

Pour lire une preuve, utiliser `workflow report ID_PREUVE`. Le regroupement des tests réussis
ne démontre pas leur couverture : lire les noms ou assertions utiles avec --raw ou --stream.
Les erreurs et les revues restent intégrales. Ne pas refaire un contrôle pour retrouver son log.
