# Roadmap de construction

## Phase 0 — Contrat et architecture

- [x] Définir la promesse.
- [x] Définir les non-objectifs.
- [x] Définir les modes d'entrée.
- [x] Définir la séparation core, profils, adaptateurs et CLI.
- [x] Valider le socle avec l'utilisatrice.

## Phase 1 — Sources de vérité

- [x] Définir le schéma de `project.yaml`.
- [x] Créer le modèle de `PROJECT_BRIEF.md`.
- [x] Créer le modèle de `PROJECT_STATE.md`.
- [x] Définir les règles de mise à jour et de propriété.
- [x] Définir le format du registre de décisions.
- [ ] Valider les sources de vérité avec l'utilisatrice.

## Phase 2 — CLI minimal

- [x] Choisir TypeScript/Node.js, avec Node 22+ comme version maintenue.
- [x] Implémenter `new`.
- [x] Implémenter `adopt`.
- [x] Implémenter `doctor`.
- [x] Ajouter des messages et codes de sortie stables.
- [x] Valider le CLI minimal avec l'utilisatrice.

## Phase 3 — Profil générique

- [x] Définir le contrat d'un profil.
- [x] Créer le profil `generic`.
- [x] Configurer les contrôles sans inventer de commandes.
- [x] Valider le profil `generic` avec l'utilisatrice.

## Phase 4 — Adaptateurs

- [x] Définir le contrat et le schéma d'un adaptateur.
- [x] Créer l'adaptateur Codex.
- [x] Créer l'adaptateur Claude Code.
- [x] Valider la séparation entre le cœur et les formats spécifiques.
- [x] Valider l'adaptateur Codex avec l'utilisatrice.
- [x] Valider l'adaptateur Claude Code avec l'utilisatrice.

## Phase 5 — Skills principaux

- [x] `project-discover`.
- [x] `project-handoff`.
- [x] `project-setup`.
- [x] `project-work`.
- [x] `project-ship`.

## Phase 6 — Agents

- [x] Définir le contrat d'un agent.
- [x] Ajouter Builder.
- [x] Ajouter Independent Reviewer.
- [x] Créer le catalogue conditionnel sans l'activer par défaut.
- [x] Protéger les agents rédigés par l'utilisatrice.

## Phase 7 — Qualité

- [x] Ajouter les fixtures.
- [x] Tester la création et l'adoption.
- [x] Tester les configurations invalides.
- [x] Tester les séparations de fichiers.
- [x] Ajouter une validation continue du starter.

## Phase 8 — Profils supplémentaires

- [x] Node/API.
- [x] Next.js.
- [x] SwiftUI.
- [x] WordPress.

Chaque profil supplémentaire doit être validé sur des cas de création, d'adoption conforme et d'adoption incomplète.

La phase 8 est achevée avec quatre profils spécialisés validés.

## Phase 8.5 — Passerelle Project Architect

- [x] Définir le contrat `project-architect-product-package` v1.
- [x] Ajouter son schéma déterministe.
- [x] Implémenter `ai-project intake import`.
- [x] Archiver et tracer chaque version sans réécriture.
- [x] Étendre `doctor` à l'intégrité des packages importés.
- [x] Faire évoluer Project Discover vers une route package importé.
- [x] Tester les erreurs de projet, statut, autorité, secrets, liens et intégrité.

La prochaine étape est un pilote réel du parcours Project Architect → Claude Design → product-package → starter.

## Phase 9 — Backlog-roadmap v2 (project-plan v2)

- [x] Définir le modèle hybride `Phase → BLG → TSK → WORK`.
- [x] Séparer les états stockés des états calculés.
- [x] Distinguer la progression de construction de la validation du résultat (`built` vs `done`).
- [x] Rendre les preuves obligatoires et leur journal append-only.
- [x] Garantir la stabilité absolue des identifiants (`id_allocation`, `derived_from`).
- [x] Ordonner par phase, sans rangs globaux, avec dépendances uniquement vers l'amont.
- [x] Générer la vue Markdown et bloquer sa divergence (`backlog sync-view`, `BACKLOG_VIEW_STALE`).
- [x] Implémenter la migration v1 → v2 sans perte, avec `legacy_work_items` transitoire.
- [x] Ajouter la route `legacy-link-conversion` pour supprimer le blocage circulaire de migration.
- [x] Étendre `doctor` aux invariants de phases, tâches, preuves, identifiants et unités.
- [x] Mettre à niveau `project-plan` v2, `project-work` v3 et les adaptateurs.
- [x] Couvrir la v2 par une fixture dédiée et une suite de tests de référence.
- [ ] Migrer le pilote Télécommande (décision séparée).
- [ ] Retirer le support du schéma v1 (décision séparée, ultérieure).

### Décision architecturale : abandon de la couche registre + ancrage

La stratégie de registre d'intégrité et d'ancrage a été **entièrement retirée**. Les contre-revues ont montré qu'elle transformait `project-plan` en système transactionnel sans disposer d'une véritable frontière de confiance : tout mécanisme placé dans le workspace reste modifiable par la même autorité.

- [x] Suppression de `src/lib/backlog-integrity.ts`, de l'ancrage `backlog_integrity`, de `init-integrity` et `recover-integrity`, ainsi que des diagnostics et tests propres à cette couche.
- [x] `ai-project backlog revise` matérialise l'évolution substantielle : validation, archive exclusive, version, approbation effacée, vue régénérée — récupérable après interruption.
- [x] Le modèle de confiance est énoncé honnêtement dans les contrats, les skills et les adaptateurs.
- [x] Les tests couvrent les 14 parcours réellement supportés, chacun avec au moins un cas positif et un cas négatif.
- [ ] Mode haute intégrité (frontière externe : dépôt Git privé ou stockage transactionnel) — **hors v0.14.0**.

### Correctif 0.14.1 — cycle de vie des adaptateurs

- [x] Ajouter `ai-project adapter upgrade` avec comparaison au modèle historique et refus des sorties personnalisées sans `--force`.
- [x] Conserver les modèles v3 nécessaires à la mise à niveau vers les adaptateurs v4.
- [x] Valider la reprise d'un projet Claude Code existant dans Codex sans réécrire les sources canoniques.
- [x] Documenter le handoff : un seul rédacteur à la fois, état et diagnostic avant la bascule, aucun transfert du chat ni du prompt cache.
