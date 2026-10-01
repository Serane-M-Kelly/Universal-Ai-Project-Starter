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
  next_phase: 7
  next_item: 20
  next_task: 20
  next_evidence: 6
phases:
  - id: PH-0
    title: Socle du projet
    goal: Disposer d'un socle technique vérifié avant toute fonctionnalité.
    disposition: active
    prepared_by: null
    prepared_at: null
  - id: PH-1
    title: Prouver le pavé tactile
    goal: Savoir si le curseur du Mac peut être piloté depuis l'iPhone (Q-001).
    disposition: active
    prepared_by: null
    prepared_at: null
  - id: PH-2
    title: Compléter le pavé
    goal: Ajouter défilement et sensibilité une fois le mécanisme validé.
    disposition: active
    prepared_by: null
    prepared_at: null
  - id: PH-3
    title: Lien durable et sûr
    goal: Association persistante, refusée hors appairage, sans rejeu (Q-003, Q-004).
    disposition: active
    prepared_by: null
    prepared_at: null
  - id: PH-4
    title: Commandes courantes
    goal: Couvrir média, navigation et saisie depuis le lit.
    disposition: active
    prepared_by: null
    prepared_at: null
  - id: PH-5
    title: Utilisable au quotidien
    goal: Rendre l'ensemble installable, lisible et réglable sans assistance.
    disposition: active
    prepared_by: null
    prepared_at: null
  - id: PH-6
    title: Expérimental
    goal: Tenter le geste à trois doigts, ou l'abandonner explicitement.
    disposition: active
    prepared_by: null
    prepared_at: null
items:
  - id: BLG-008
    title: Socle technique vérifié
    phase: PH-0
    order: 1
    stage: ready
    disposition: active
    required: true
    priority: P0
    depends_on: []
    derived_from: []
    legacy_work_items: []
    outcome_accepted_by: Kelly
    outcome_accepted_at: 2026-08-06
    tasks:
      - id: TSK-001
        title: Approuver le brief produit.
        category: product
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
        evidence_log:
          - id: EV-001
            kind: decision
            ref: docs/decisions.md#DEC-013
            recorded_at: 2026-08-06
            observed_by: null
            state: valid
            state_reason: null
            state_at: null
      - id: TSK-002
        title: Choisir l'architecture technique (option A).
        category: architecture
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
        evidence_log:
          - id: EV-002
            kind: decision
            ref: docs/decisions.md#DEC-014
            recorded_at: 2026-08-06
            observed_by: null
            state: valid
            state_reason: null
            state_at: null
      - id: TSK-003
        title: Créer les cibles iOS et macOS.
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
        evidence_log:
          - id: EV-003
            kind: report
            ref: reports/setup-report.md
            recorded_at: 2026-08-06
            observed_by: null
            state: valid
            state_reason: null
            state_at: null
      - id: TSK-004
        title: Créer le package local SharedKit.
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
        evidence_log:
          - id: EV-004
            kind: report
            ref: reports/setup-report.md
            recorded_at: 2026-08-06
            observed_by: null
            state: valid
            state_reason: null
            state_at: null
      - id: TSK-005
        title: Vérifier les builds iOS/macOS et les tests SharedKit.
        category: quality
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
        evidence_log:
          - id: EV-005
            kind: report
            ref: reports/setup-report.md
            recorded_at: 2026-08-06
            observed_by: null
            state: valid
            state_reason: null
            state_at: null
  - id: BLG-001
    title: Déplacement réel du curseur
    phase: PH-1
    order: 1
    stage: ready
    disposition: active
    required: true
    priority: P0
    depends_on: []
    derived_from: []
    legacy_work_items:
      - WORK-001
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks:
      - id: TSK-006
        title: Définir le message de déplacement partagé (deltas).
        category: architecture
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
      - id: TSK-007
        title: Créer la surface tactile plein écran sur iPhone.
        category: ux
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
      - id: TSK-008
        title: Convertir le geste en deltas incrémentaux.
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
      - id: TSK-009
        title: Transmettre les deltas sur le réseau local.
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
      - id: TSK-010
        title: Recevoir et décoder les messages sur le Mac.
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
      - id: TSK-011
        title: Déplacer le curseur via CGEvent après contrôle de la permission
          Accessibilité.
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
      - id: TSK-012
        title: Saisir manuellement l'adresse IP du Mac (limite du prototype).
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
      - id: TSK-013
        title: Couvrir l'encodage/décodage par un test automatisé.
        category: quality
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
      - id: TSK-014
        title: Vérifier déplacement, arrêt net et latence sur les appareils physiques.
        category: human
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
  - id: BLG-009
    title: Clic par tap
    phase: PH-1
    order: 2
    stage: ready
    disposition: active
    required: true
    priority: P0
    depends_on:
      - BLG-001
    derived_from:
      - BLG-001
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks:
      - id: TSK-015
        title: Distinguer tap et glissement côté iPhone.
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
      - id: TSK-016
        title: Étendre le message partagé au clic.
        category: architecture
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
      - id: TSK-017
        title: Émettre un clic système sur le Mac.
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
      - id: TSK-018
        title: Vérifier la différenciation clic/déplacement sur les appareils physiques.
        category: human
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
      - id: TSK-019
        title: Retour haptique au clic.
        category: ux
        required: false
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
    title: Défilement à deux doigts
    phase: PH-2
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
    tasks: []
  - id: BLG-010
    title: Sensibilité réglable du pavé
    phase: PH-2
    order: 2
    stage: candidate
    disposition: active
    required: true
    priority: P1
    depends_on:
      - BLG-001
    derived_from:
      - BLG-002
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-011
    title: Découverte automatique du Mac (Bonjour)
    phase: PH-3
    order: 1
    stage: candidate
    disposition: active
    required: true
    priority: P0
    depends_on:
      - BLG-001
    derived_from:
      - BLG-003
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-003
    title: Association persistante et sûre entre sessions
    phase: PH-3
    order: 2
    stage: candidate
    disposition: active
    required: true
    priority: P0
    depends_on:
      - BLG-011
    derived_from: []
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-012
    title: Refus d'un appareil non associé (BR-001)
    phase: PH-3
    order: 3
    stage: candidate
    disposition: active
    required: true
    priority: P0
    depends_on:
      - BLG-003
    derived_from:
      - BLG-003
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-013
    title: Reconnexion après coupure sans rejeu (BR-002)
    phase: PH-3
    order: 4
    stage: candidate
    disposition: active
    required: true
    priority: P0
    depends_on:
      - BLG-003
    derived_from:
      - BLG-003
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-004
    title: Réglage du volume
    phase: PH-4
    order: 1
    stage: candidate
    disposition: active
    required: true
    priority: P1
    depends_on:
      - BLG-003
    derived_from: []
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-014
    title: Lecture / pause
    phase: PH-4
    order: 2
    stage: candidate
    disposition: active
    required: true
    priority: P1
    depends_on:
      - BLG-003
    derived_from:
      - BLG-004
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-015
    title: Changement d'app avec confirmation
    phase: PH-4
    order: 3
    stage: candidate
    disposition: active
    required: true
    priority: P1
    depends_on:
      - BLG-003
    derived_from:
      - BLG-004
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-005
    title: Saisie clavier vers le champ actif
    phase: PH-4
    order: 4
    stage: candidate
    disposition: active
    required: true
    priority: P1
    depends_on:
      - BLG-003
    derived_from: []
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-016
    title: Pavé accessible au-dessus du clavier
    phase: PH-4
    order: 5
    stage: candidate
    disposition: active
    required: true
    priority: P1
    depends_on:
      - BLG-005
    derived_from:
      - BLG-005
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-006
    title: Installation et lancement du compagnon
    phase: PH-5
    order: 1
    stage: candidate
    disposition: active
    required: true
    priority: P1
    depends_on:
      - BLG-003
    derived_from: []
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-017
    title: Guide d'octroi de la permission Accessibilité
    phase: PH-5
    order: 2
    stage: candidate
    disposition: active
    required: true
    priority: P1
    depends_on:
      - BLG-006
    derived_from:
      - BLG-006
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-018
    title: États de connexion lisibles en texte
    phase: PH-5
    order: 3
    stage: candidate
    disposition: active
    required: true
    priority: P1
    depends_on:
      - BLG-013
    derived_from:
      - BLG-006
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-019
    title: Écran de réglages minimal
    phase: PH-5
    order: 4
    stage: candidate
    disposition: active
    required: true
    priority: P2
    depends_on:
      - BLG-010
      - BLG-006
    derived_from:
      - BLG-006
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
  - id: BLG-007
    title: Geste à trois doigts (Mission Control)
    phase: PH-6
    order: 1
    stage: candidate
    disposition: active
    required: false
    priority: P2
    depends_on:
      - BLG-001
    derived_from: []
    legacy_work_items: []
    outcome_accepted_by: null
    outcome_accepted_at: null
    tasks: []
---

# Backlog — Télécommande personnelle iPhone → Mac

Fixture de test : backlog v2 en planification progressive. Le frontmatter fait autorité ; le bloc ci-dessous est généré.

<!-- backlog:roadmap début · bloc généré · ne pas éditer à la main · régénérer avec `ai-project backlog sync-view` -->

## Roadmap

**Construction : 5/18 tâches obligatoires terminées.**
**Résultats obligatoires : 1/18 acceptés.**
**Détail : 3 résultats détaillés, 16 encore sans tâche.**
⚠ 1 lien historique à convertir : `BLG-001` ← `WORK-001`.

### PH-0 — Socle du projet — `complete` · résultats 1/1 · construction 5/5
> Disposer d'un socle technique vérifié avant toute fonctionnalité.

#### BLG-008 — Socle technique vérifié
`done` · P0 · construction 5/5 · résultat accepté le 2026-08-06 par Kelly

- [x] `TSK-001` Approuver le brief produit. · produit · preuve : docs/decisions.md#DEC-013
- [x] `TSK-002` Choisir l'architecture technique (option A). · architecture · preuve : docs/decisions.md#DEC-014
- [x] `TSK-003` Créer les cibles iOS et macOS. · technique · preuve : reports/setup-report.md
- [x] `TSK-004` Créer le package local SharedKit. · technique · preuve : reports/setup-report.md
- [x] `TSK-005` Vérifier les builds iOS/macOS et les tests SharedKit. · qualité · preuve : reports/setup-report.md

### PH-1 — Prouver le pavé tactile — `not_started` · résultats 0/2 · construction 0/13
> Savoir si le curseur du Mac peut être piloté depuis l'iPhone (Q-001).

#### BLG-001 — Déplacement réel du curseur
`ready` · P0 · construction 0/9 · résultat non démontré
⚠ Lien historique à convertir : `WORK-001` → à reporter dans `WORK-001.realizes`.

- [ ] `TSK-006` Définir le message de déplacement partagé (deltas). · architecture
- [ ] `TSK-007` Créer la surface tactile plein écran sur iPhone. · ux
- [ ] `TSK-008` Convertir le geste en deltas incrémentaux. · technique
- [ ] `TSK-009` Transmettre les deltas sur le réseau local. · technique
- [ ] `TSK-010` Recevoir et décoder les messages sur le Mac. · technique
- [ ] `TSK-011` Déplacer le curseur via CGEvent après contrôle de la permission Accessibilité. · technique
- [ ] `TSK-012` Saisir manuellement l'adresse IP du Mac (limite du prototype). · technique
- [ ] `TSK-013` Couvrir l'encodage/décodage par un test automatisé. · qualité
- [ ] `TSK-014` Vérifier déplacement, arrêt net et latence sur les appareils physiques. · humain

Unités associées : `WORK-001` — Prototype du déplacement du curseur — `proposed`

#### BLG-009 — Clic par tap
`ready` · P0 · après BLG-001 · construction 0/4 (+1 optionnelle) · résultat non démontré · issu de BLG-001

- [ ] `TSK-015` Distinguer tap et glissement côté iPhone. · technique
- [ ] `TSK-016` Étendre le message partagé au clic. · architecture
- [ ] `TSK-017` Émettre un clic système sur le Mac. · technique
- [ ] `TSK-018` Vérifier la différenciation clic/déplacement sur les appareils physiques. · humain
- [ ] `TSK-019` Retour haptique au clic. · ux · optionnelle

### PH-2 — Compléter le pavé — `not_started` · résultats 0/2 · non détaillée
> Ajouter défilement et sensibilité une fois le mécanisme validé.

- `BLG-002` — Défilement à deux doigts — `candidate` · P1 · après BLG-001
- `BLG-010` — Sensibilité réglable du pavé — `candidate` · P1 · après BLG-001 · issu de BLG-002

### PH-3 — Lien durable et sûr — `not_started` · résultats 0/4 · non détaillée
> Association persistante, refusée hors appairage, sans rejeu (Q-003, Q-004).

- `BLG-011` — Découverte automatique du Mac (Bonjour) — `candidate` · P0 · après BLG-001 · issu de BLG-003
- `BLG-003` — Association persistante et sûre entre sessions — `candidate` · P0 · après BLG-011
- `BLG-012` — Refus d'un appareil non associé (BR-001) — `candidate` · P0 · après BLG-003 · issu de BLG-003
- `BLG-013` — Reconnexion après coupure sans rejeu (BR-002) — `candidate` · P0 · après BLG-003 · issu de BLG-003

### PH-4 — Commandes courantes — `not_started` · résultats 0/5 · non détaillée
> Couvrir média, navigation et saisie depuis le lit.

- `BLG-004` — Réglage du volume — `candidate` · P1 · après BLG-003
- `BLG-014` — Lecture / pause — `candidate` · P1 · après BLG-003 · issu de BLG-004
- `BLG-015` — Changement d'app avec confirmation — `candidate` · P1 · après BLG-003 · issu de BLG-004
- `BLG-005` — Saisie clavier vers le champ actif — `candidate` · P1 · après BLG-003
- `BLG-016` — Pavé accessible au-dessus du clavier — `candidate` · P1 · après BLG-005 · issu de BLG-005

### PH-5 — Utilisable au quotidien — `not_started` · résultats 0/4 · non détaillée
> Rendre l'ensemble installable, lisible et réglable sans assistance.

- `BLG-006` — Installation et lancement du compagnon — `candidate` · P1 · après BLG-003
- `BLG-017` — Guide d'octroi de la permission Accessibilité — `candidate` · P1 · après BLG-006 · issu de BLG-006
- `BLG-018` — États de connexion lisibles en texte — `candidate` · P1 · après BLG-013 · issu de BLG-006
- `BLG-019` — Écran de réglages minimal — `candidate` · P2 · après BLG-010, BLG-006 · issu de BLG-006

### PH-6 — Expérimental — `optional` · résultats 0/0 · non détaillée
> Tenter le geste à trois doigts, ou l'abandonner explicitement.

- `BLG-007` — Geste à trois doigts (Mission Control) — `candidate` · P2 · après BLG-001 · non obligatoire

<!-- backlog:roadmap fin -->

## Détail des résultats

### BLG-008 — Socle technique vérifié

- **Résultat observable recherché :** un projet Xcode à deux cibles qui compile et dont les tests passent.
- **Source :** `reports/setup-report.md`, `docs/decisions.md#DEC-014`.

### BLG-001 — Déplacement réel du curseur

- **Résultat observable recherché :** un glissement à un doigt sur l'iPhone déplace réellement le curseur du Mac.
- **Source :** PROJECT_BRIEF.md §5, §11, §12 Q-001.

### BLG-009 — Clic par tap

- **Résultat observable recherché :** un tap sur la surface tactile produit un clic système sur le Mac.
- **Source :** PROJECT_BRIEF.md §5, §12 « différenciation clic/déplacement ».
