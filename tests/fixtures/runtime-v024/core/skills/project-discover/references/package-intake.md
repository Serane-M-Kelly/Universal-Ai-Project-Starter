# Consolider un product-package importé

Charger cette référence uniquement lorsque `intake/product-package/registry.yaml` existe.

## 1. Vérifier avant d'interpréter

1. Exécuter ou consulter `ai-project doctor`.
2. Lire la dernière entrée pertinente du registre et son rapport dans `reports/intake/`.
3. Lire dans l'archive canonique :
   - `manifest.yaml` ;
   - `PROJECT_PASSPORT.md` ;
   - `EVIDENCE_REGISTER.md` ;
   - `PRODUCT_STRATEGY.md` ;
   - `UX_FLOWS.md` ;
   - `PROTOTYPE_BRIEF.md` ;
   - `VALIDATION_REPORT.md` ;
   - `DECISION_LOG.md` ;
   - `OPEN_QUESTIONS.md` ;
   - `REVIEW_REPORT.md` ;
   - `BUILD_HANDOFF.md`.
4. Arrêter si doctor signale une archive modifiée, une référence absente ou un registre incohérent.

Ne pas supposer que la version la plus élevée est la bonne si une décision humaine en désigne une autre. Signaler les packages concurrents ou remplacés.

Le `project.entry_mode` reste volontairement `idea` ou `brief` après l'import : le product-package enrichit l'entrée, il ne constitue pas un nouveau mode mécanique. Ne pas traiter cette combinaison comme une contradiction.

## 2. Construire une matrice de consolidation

Pour chaque section de `PROJECT_BRIEF.md`, identifier :

| Section du brief | Sources principales du package |
|---|---|
| problème, cible, alternatives | Passport, Evidence Register, Product Strategy |
| valeur et résultats | Product Strategy, Decision Log |
| MVP et exclusions | Product Strategy, Build Handoff, Decision Log |
| parcours critiques | UX Flows, Prototype Brief, Validation Report |
| règles métier | UX Flows, Build Handoff, décisions acceptées |
| données et sécurité | Passport, Prototype Brief, Open Questions |
| exigences non fonctionnelles | UX Flows, Build Handoff, décisions acceptées |
| contraintes | Passport, Decision Log |
| acceptation | Product Strategy, Validation Report, Build Handoff |
| risques et inconnues | Passport, Evidence Register, Open Questions, Review Report |

Classer chaque affirmation comme fait sourcé, observation, hypothèse, préférence, contrainte ou décision humaine. Référencer le chemin canonique et, si possible, l'identifiant `EV-*`, `DEC-*`, `UX-*` ou `Q-*`.

## 3. Traiter les décisions avec prudence

- Inscrire dans `docs/decisions.md` uniquement les entrées `accepted` dont la propriétaire et la date sont explicites.
- Conserver les entrées `proposed`, `rejected` ou ambiguës dans le package ; ne pas les transformer en décisions.
- Signaler toute contradiction entre le Decision Log, le prototype et le Build Handoff.
- Garder le brief en `draft`, avec `approved_by: null` et `approved_at: null`.

## 4. Préserver les limites de preuve

- Ne pas présenter une recherche publique comme une validation utilisateur.
- Ne pas présenter `simulation_ia` ou `revue_heuristique` comme `test_reel`.
- Reporter dans le brief les limites de méthode qui changent le risque ou le niveau de confiance.
- Si le Reviewer a passé le package avec limites, relier ces limites aux risques ou questions ouvertes.

## 5. Combler seulement les lacunes décisionnelles

Poser au maximum trois questions cohérentes à la fois. Ne demander une nouvelle recherche que si :

- une source déterminante est introuvable ou trop ancienne pour la décision ;
- une contradiction empêche de choisir le problème, la cible, le MVP ou un critère ;
- une obligation, une donnée sensible ou un risque important reste sans traitement ;
- le prototype ou la validation ne correspond pas à la version désignée comme canonique.

Écrire « inconnu » ou conditionner le périmètre lorsqu'une lacune non bloquante peut attendre.

## 6. Mettre à jour le workspace

1. Compléter `PROJECT_BRIEF.md` sans changer sa structure.
2. Référencer l'archive au lieu de recopier les rapports détaillés.
3. Reporter seulement les décisions humaines acceptées dans `docs/decisions.md`.
4. Mettre à jour `PROJECT_STATE.md` avec le stade réellement soutenu, les décisions attendues, les blocages et la prochaine action.
5. Ne jamais modifier l'archive, son manifeste, son rapport d'import ou son empreinte.

Terminer avec `READY_FOR_REVIEW`, `NEEDS_EVIDENCE` ou `BLOCKED`, puis recommander `project-handoff` seulement si le brief est suffisamment cohérent pour une revue humaine.
