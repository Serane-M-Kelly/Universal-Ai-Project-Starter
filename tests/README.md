# Tests

Les tests valident le starter sur des workspaces temporaires et des fixtures versionnées. Ils ne modifient jamais un projet réel de l'utilisatrice.

La première suite vérifie :

- la création et l'isolation d'un nouveau projet ;
- l'adoption non destructive, y compris dans un monorepo ;
- la détection complète des commandes d'une fixture Node autonome ;
- le refus d'un workspace privé placé dans un dépôt ;
- la détection d'une fuite de document privé ;
- la distinction entre secrets et modèles `.env.example` ;
- le blocage d'une configuration invalide ;
- la validation et la compatibilité des profils ;
- le refus d'un profil inconnu avant toute création ;
- la découverte du profil `node-api`, sa cible de création et son affichage ;
- l'adoption non destructive d'une API TypeScript complète ;
- le blocage d'un dépôt Node/API qui ne démontre pas son contrat ;
- la création ciblée et l'adoption de Next.js avec App Router ou Pages Router ;
- le blocage d'une application Next.js qui ne démontre plus ses routes, dépendances ou commandes ;
- la création ciblée et l'adoption de SwiftUI avec un projet Xcode au nom variable ou `Package.swift` ;
- le rejet de fausses preuves SwiftUI placées dans des artefacts générés ;
- la création ciblée et l'adoption d'un site, d'une extension et d'un thème WordPress ;
- la combinaison déterministe des scripts Composer et Node ;
- le rejet d'une fausse signature WordPress placée dans `vendor` ;
- la compilation TypeScript stricte de la fixture Node/API ;
- l'installation et l'idempotence de l'adaptateur Codex ;
- la protection des instructions personnelles existantes ;
- la compatibilité de version des adaptateurs ;
- le confinement des sorties malgré les liens symboliques ;
- l'installation de l'adaptateur Claude Code et la validité de ses réglages ;
- la coexistence de Codex et Claude Code sans modification du dépôt applicatif ;
- l'installation d'une source de skill unique pour plusieurs assistants ;
- la synchronisation d'une personnalisation locale ;
- la protection d'une copie native modifiée séparément ;
- le déploiement automatique des skills lors de l'ajout tardif d'un adaptateur ;
- l'absence d'agent activé par défaut et le catalogue conditionnel ;
- la traduction de Builder et Independent Reviewer pour Codex et Claude Code ;
- la création, l'activation et la conservation d'un agent rédigé par l'utilisatrice ;
- le refus d'une fixture d'agent qui prétend s'accorder une approbation humaine ;
- la protection des copies natives d'agents contre les écrasements silencieux ;
- le déploiement automatique des agents lors de l'ajout tardif d'un adaptateur ;
- la compatibilité d'un skill avec le mode d'entrée du projet ;
- l'installation et le référencement de `project-handoff` ;
- le blocage d'une approbation sans identité ou avec une date impossible ;
- le blocage de métadonnées d'approbation résiduelles sur un brouillon ;
- l'installation de `project-setup` avec ses portes et modèles sur un projet neuf ;
- l'installation non intrusive de `project-setup` sur un dépôt adopté ;
- l'installation du contrat, des portes et des rapports de `project-work` ;
- la compatibilité de `project-work` avec une maintenance adoptée ;
- l'installation du manifeste, des portes et des preuves de `project-ship` ;
- la création du dossier privé de livraisons ;
- le blocage d'une fuite de manifeste de livraison, y compris avec une ancienne configuration ;
- la validation et l'archivage idempotent d'un product-package prêt ;
- le refus d'un package brouillon, destiné à un autre projet ou importé dans un mode incompatible ;
- le refus des liens symboliques, secrets potentiels et briefs déjà approuvés pendant l'import ;
- la détection par doctor d'une archive product-package modifiée après import ;
- la compilation de tous les schémas et la cohérence des catalogues, profils et adaptateurs ;
- l'alignement des versions et l'intégrité des fixtures.

Exécution :

```bash
npm test
```

La porte complète utilisée par la CI ajoute le typage strict et l'inspection du paquet :

```bash
npm run validate
```
