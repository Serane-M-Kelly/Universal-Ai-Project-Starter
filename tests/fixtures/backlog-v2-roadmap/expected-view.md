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
