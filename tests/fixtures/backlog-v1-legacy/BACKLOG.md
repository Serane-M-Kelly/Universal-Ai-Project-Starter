---
schema_version: 1
backlog_version: 1
status: draft
approved_by: null
approved_at: null
source_brief_version: 1
source_setup_report: reports/setup-report.md
last_reviewed_at: null
candidates:
  - id: BLG-001
    status: ready
    rank: 1
    priority: P0
    depends_on: []
    work_items: [WORK-001]
  - id: BLG-002
    status: candidate
    rank: 2
    priority: P1
    depends_on: [BLG-001]
    work_items: []
  - id: BLG-003
    status: selected
    rank: 3
    priority: P0
    depends_on: [BLG-001]
    work_items: [WORK-002]
  - id: BLG-004
    status: deferred
    rank: 4
    priority: P2
    depends_on: []
    work_items: []
---

# Backlog — Fixture héritée v1

## BLG-001 — Pavé tactile de base : déplacement et clic réels du curseur

- **Résultat observable recherché :** le curseur bouge et clique.

## BLG-002 — Défilement à deux doigts et sensibilité réglable

- **Résultat observable recherché :** défilement et sensibilité.

## BLG-003 — Association persistante et sécurisée

- **Résultat observable recherché :** association qui tient.

## BLG-004 — Geste à trois doigts

- **Résultat observable recherché :** Mission Control.
