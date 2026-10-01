# Contrat des livraisons

## Objectif

Empêcher qu'un artefact préparé, une commande envoyée ou un déploiement en cours soit présenté comme une livraison réussie.

Chaque livraison possède :

- `livraisons/SHIP-NNN.md` pour son périmètre, sa cible, son autorité et son état ;
- `reports/ship/SHIP-NNN.md` pour les portes, l'exécution et les preuves observées.

## États

```text
proposed
  → candidate
  → ready_to_ship
  → approved
  → shipped
```

`partially_shipped`, `blocked` et `rolled_back` représentent des résultats réels et ne doivent pas être réécrits en succès.

## Autorité

- Le préparateur peut construire et qualifier un candidat local.
- Une personne humaine autorise une action portant sur une cible et un candidat exacts.
- Les politiques de `project.yaml` bornent les commits, actions externes, déploiements et opérations destructives.
- L'état `shipped` provient d'une preuve externe et de contrôles post-livraison, jamais de l'intention d'un agent.

Une autorisation ne s'étend ni à une autre cible, ni à une nouvelle version, ni à une relance non idempotente.
