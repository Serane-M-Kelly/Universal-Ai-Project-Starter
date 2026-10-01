---
schema_version: 1
work_item_version: 1
id: WORK-000
title: null
status: proposed
realizes: []
cross_cutting: false
unplanned_urgent: false
brief_version: null
source_request: null
approved_by: null
approved_at: null
started_at: null
ready_for_review_at: null
ready_for_acceptance_at: null
accepted_by: null
accepted_at: null
---

# Unité de travail — [WORK-000 : titre]

## Résultat attendu

[Un seul résultat observable.]

## Tâches réalisées

`realizes` déclare les `TSK-NNN` de `taches/BACKLOG.md` que cette unité entreprend. C'est le seul endroit où ce lien est écrit : le backlog ne le duplique pas. Les tâches doivent appartenir au même `BLG`, sauf lot transversal explicitement justifié ci-dessous.

`title` fournit le libellé court affiché dans la roadmap générée.

Si les tâches traversent plusieurs résultats, déclarer `cross_cutting: true` **et** ajouter une section `## Justification du lot transversal` contenant une explication réellement rédigée : pourquoi ces tâches doivent être réalisées ensemble et pourquoi les découper serait pire. Un titre de section vide ne vaut pas justification.

`unplanned_urgent: true` déclare la voie d'urgence documentée. C'est cette métadonnée, et jamais une phrase de `source_request`, qui atteste l'autorisation d'urgence.

## Contexte et comportement actuel

[Faits nécessaires, sans recopier le brief.]

## Périmètre inclus

- [Élément]

## Périmètre exclu

- [Élément]

## Critères d'acceptation

| ID | Critère observable | Preuve attendue |
|---|---|---|
| AC-01 | [critère] | [test, capture, mesure ou inspection] |

## Cas limites et risques

| Élément | Effet | Traitement ou autorité attendue |
|---|---|---|
| [élément] | [effet] | [traitement] |

## Stratégie de réalisation

[Approche minimale, fichiers probables et conventions à préserver.]

## Vérification prévue

- [Commande ou inspection]

## Retour arrière

[Procédure ou non applicable avec raison.]

## Décisions ou dépendances bloquantes

- [Aucune / décision]
