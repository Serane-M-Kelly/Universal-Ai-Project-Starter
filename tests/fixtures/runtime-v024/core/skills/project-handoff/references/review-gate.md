# Porte de revue du brief

Utiliser cette référence pour une revue de passage. Ne pas transformer les questions en exigences universelles : marquer « non applicable » avec une raison lorsque le contexte le justifie.

## Contrôles de cohérence

- Le problème décrit existe-t-il indépendamment de la solution proposée ?
- La cible principale reste-t-elle identique dans le résumé, les parcours et l'acceptation ?
- Chaque élément du MVP répond-il à un besoin ou à une contrainte explicite ?
- Une exclusion contredit-elle un parcours ou un livrable annoncé ?
- Une règle métier dépend-elle d'une décision encore ouverte ?
- Les critères de succès mesurent-ils un résultat plutôt qu'une simple livraison ?
- Les contraintes dites imposées ont-elles une source ou une décideuse ?
- Les risques majeurs possèdent-ils une prochaine preuve, une décision ou une condition d'arrêt ?

## Contrôles de traçabilité

- Chaque affirmation déterminante est-elle un fait, une observation, une hypothèse, une préférence, une contrainte ou une décision identifiable ?
- Les preuves référencées existent-elles réellement dans `intake/` ou à l'adresse citée ?
- Les décisions acceptées figurent-elles dans `docs/decisions.md` sans être recopiées inutilement ?
- `PROJECT_STATE.md` reflète-t-il la version effectivement examinée ?
- Le rapport distingue-t-il les contrôles exécutés des contrôles seulement recommandés ?

## Revue renforcée

Appliquer ces contrôles lorsqu'un risque élevé est présent :

- La personne compétente pour accepter le risque est-elle identifiée ?
- Un avis juridique, sécurité, accessibilité, médical ou métier est-il nécessaire avant approbation ?
- Les données sensibles sont-elles minimisées, protégées et assorties d'une règle de suppression ?
- Les personnes affectées sans être utilisatrices ont-elles été prises en compte ?
- Les conséquences d'une erreur, d'un abus ou d'un retrait du service sont-elles décrites ?
- Une condition interdit-elle la réalisation tant que l'avis qualifié manque ?

L'assistant ne remplace jamais l'avis qualifié. L'absence de cet avis produit `BLOCKED` lorsqu'il est nécessaire à une décision responsable.

## Sémantique de la décision

- « J'approuve le brief vN » : approbation explicite si l'identité est connue.
- « J'approuve si X est changé » : `CHANGES_REQUIRED`, pas d'approbation.
- « Cela me convient » : demander une confirmation explicite de la version.
- « On peut commencer » : demander si cette phrase signifie l'approbation du brief vN.
- Absence de réponse ou approbation passée : aucune nouvelle approbation.

## Format du rapport

```markdown
# Revue du brief vN

- Date : AAAA-MM-JJ
- Périmètre : PROJECT_BRIEF.md vN
- Vérifications exécutées : [liste]
- Vérifications non exécutées : [liste et raison]
- Verdict : READY_FOR_APPROVAL / CHANGES_REQUIRED / BLOCKED / APPROVED

## Constats

| Sévérité | Section | Constat et impact | Correction ou décision attendue |
|---|---|---|---|

## Risques résiduels

| Risque | Statut | Autorité attendue ou acceptation |
|---|---|---|

## Décision humaine

- Décision : en attente / approuvé / refusé / reporté
- Personne : [nom ou inconnue]
- Référence : [message, réunion ou aucune]

## Prochaine étape autorisée

[action ou aucune]
```
