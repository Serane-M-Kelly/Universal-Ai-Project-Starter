---
schema_version: 2
backlog_version: 1
status: draft
approved_by: null
approved_at: null
source_brief_version: 1
source_setup_report: reports/setup-report.md
last_reviewed_at: null
id_allocation:
  next_phase: 2
  next_item: 3
  next_task: 3
  next_evidence: 1
phases:
  - id: PH-0
    title: Socle du projet
    goal: Rendre visible le travail déjà accompli avant le premier incrément produit.
    disposition: active
    prepared_by: null
    prepared_at: null
  - id: PH-1
    title: "[Première phase de réalisation]"
    goal: "[Ce que cette phase rend possible]"
    disposition: active
    prepared_by: null
    prepared_at: null
items:
  - id: BLG-001
    title: "[Socle technique vérifié]"
    phase: PH-0
    order: 1
    stage: ready
    disposition: active
    required: true
    priority: P0
    depends_on: []
    derived_from: []
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks:
      - id: TSK-001
        title: "[Action déjà réalisée pendant project-setup]"
        category: tech
        required: true
        disposition: active
        derived_from: []
        origin: planned
        source_work: null
        origin_reason: null
        added_at: null
        blocked_reason: null
        dropped_by: null
        dropped_at: null
        dropped_reason: null
        evidence_log: []
  - id: BLG-002
    title: "[Résultat observable]"
    phase: PH-1
    order: 1
    stage: candidate
    disposition: active
    required: true
    priority: P1
    depends_on:
      - BLG-001
    derived_from: []
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks:
      - id: TSK-002
        title: "[Action concrète et vérifiable]"
        category: tech
        required: true
        disposition: active
        derived_from: []
        origin: planned
        source_work: null
        origin_reason: null
        added_at: null
        blocked_reason: null
        dropped_by: null
        dropped_at: null
        dropped_reason: null
        evidence_log: []
---

# Backlog — [Nom du projet]

Ce fichier est la source unique de la roadmap, du backlog priorisé, de la checklist de construction, de la carte des unités et de l'état de progression. Le frontmatter ci-dessus fait autorité ; le bloc de roadmap ci-dessous en est une **projection générée** — ne jamais l'éditer à la main, le régénérer avec `ai-project backlog sync-view`.

Un résultat `BLG-NNN` n'autorise jamais une implémentation, et une tâche `TSK-NNN` n'est jamais soumise à approbation : seule l'approbation d'une unité `WORK-NNN` autorise à construire, et seule l'acceptation humaine du résultat (`outcome_accepted_by` / `outcome_accepted_at`) rend un résultat terminé.

L'état effectif d'une tâche, d'un résultat et d'une phase est **calculé** : ne jamais tenter de l'écrire. Seuls `stage`, `disposition`, les preuves et l'acceptation sont stockés.

<!-- backlog:roadmap début · bloc généré · ne pas éditer à la main · régénérer avec `ai-project backlog sync-view` -->

## Roadmap

**Construction : 0/2 tâches obligatoires terminées.**
**Résultats obligatoires : 0/2 acceptés.**
**Détail : 2 résultats détaillés, 0 encore sans tâche.**

### PH-0 — Socle du projet — `not_started` · résultats 0/1 · construction 0/1
> Rendre visible le travail déjà accompli avant le premier incrément produit.

#### BLG-001 — [Socle technique vérifié]
`ready` · P0 · construction 0/1 · résultat non démontré

- [ ] `TSK-001` [Action déjà réalisée pendant project-setup] · technique

### PH-1 — [Première phase de réalisation] — `not_started` · résultats 0/1 · construction 0/1
> [Ce que cette phase rend possible]

#### BLG-002 — [Résultat observable]
`candidate` · P1 · après BLG-001 · construction 0/1 · résultat non démontré

- [ ] `TSK-002` [Action concrète et vérifiable] · technique

<!-- backlog:roadmap fin -->

## Détail des résultats

### BLG-001 — [Socle technique vérifié]

- **Résultat observable recherché :** [ce qui est déjà démontré par le setup]
- **Source :** `reports/setup-report.md`, `docs/decisions.md#DEC-NNN`
- **Valeur ou risque traité :** [pourquoi ce socle compte]
- **Critères généraux de réussite :** [observables]
- **Justification de l'ordre :** phase 0, travail antérieur au backlog. Cocher chaque tâche uniquement en enregistrant sa preuve historique réelle (`kind: report` vers le rapport de setup, `kind: decision` vers une décision) avec sa date réelle.

### BLG-002 — [Résultat observable]

- **Résultat observable recherché :** [ce que l'on pourrait constater si ce résultat était atteint]
- **Source :** [PROJECT_BRIEF.md §5 / §12, ou docs/decisions.md#DEC-NNN]
- **Valeur ou risque traité :** [pourquoi ce résultat compte]
- **Critères généraux de réussite :** [observables ; les critères d'acceptation détaillés appartiennent au WORK-NNN]
- **Justification de l'ordre :** [pourquoi avant ou après les résultats voisins]
