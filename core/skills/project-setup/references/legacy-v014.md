---
name: project-setup
description: "Préparer, configurer et vérifier le socle technique reproductible d'un projet à partir d'un brief approuvé ou d'un dépôt existant explicitement adopté : architecture minimale, outillage, dépendances, commandes, environnement et contrôles de base. Utiliser après project-handoff avant la première fonctionnalité, ou pour fiabiliser l'environnement d'un projet existant ; ne pas utiliser pour découvrir le produit, développer une fonctionnalité, migrer destructivement, déployer ou publier."
---

# Project Setup

Transformer une décision produit en environnement technique vérifié. Livrer un socle minimal sur lequel `project-work` pourra agir sans confondre préparation et réalisation.

## Respecter les portes d'entrée

- Lire `project.yaml`, `PROJECT_BRIEF.md`, `PROJECT_STATE.md`, `docs/decisions.md` et les instructions de l'assistant.
- Consulter `ai-project profile show <profile.id>` lorsque la commande est disponible ; appliquer ses principes et résultats de setup sans élargir le périmètre produit.
- Exécuter `ai-project doctor` avant toute mutation.
- Pour les modes `idea` et `brief`, exiger un brief `approved` avec une personne et une date valides. Refuser de contourner `project-handoff`.
- Pour les modes `existing` et `maintenance`, exiger un objectif de setup borné et inspecter le dépôt avant de proposer une modification.
- Considérer le code, les configurations et les changements Git existants comme appartenant à l'utilisatrice.
- Ne pas créer de fonctionnalité métier, écran produit, contenu final, migration de données, déploiement ou intégration externe pendant le setup.

## Définir l'unité de setup

Formuler avant d'agir :

- le résultat technique attendu ;
- les éléments inclus ;
- les non-objectifs ;
- les décisions techniques déjà imposées ;
- les décisions encore nécessaires ;
- les contrôles qui prouveront la réussite.

Une unité correcte peut être « initialiser l'application avec ses commandes de qualité » ou « rendre l'environnement existant reproductible ». « Construire le MVP » n'est pas une unité de setup.

## Inspecter avant de choisir

Résoudre `code_root` et `repository_root` depuis `project.yaml`, puis relever sans modifier :

- structure, fichiers d'entrée et documentation existante ;
- état Git et changements non validés ;
- langages, frameworks, gestionnaire de paquets et fichiers de verrouillage ;
- versions réellement disponibles des outils ;
- scripts et contrôles déjà fonctionnels ;
- fichiers d'environnement documentés ;
- contraintes du profil actif.

Ne pas mélanger deux gestionnaires de paquets ni remplacer une convention existante sans décision explicite. Dans un dépôt existant, préférer l'adaptation minimale à une régénération.

## Décider le socle minimal

Séparer les contraintes du brief, les faits détectés et les préférences techniques. Si une décision structurante manque, présenter peu d'options avec : adéquation au besoin, coût opérationnel, maturité, réversibilité et risque. Attendre la décision humaine avant de scaffolder.

Conserver le profil `generic` tant qu'aucun profil spécialisé disponible ne correspond réellement au projet. Ne jamais inventer un profil.

Pour une version ou une pratique susceptible d'avoir changé, vérifier la documentation primaire actuelle si la recherche externe est autorisée. Enregistrer la source et la date dans la décision d'architecture ; ne pas choisir automatiquement « la plus récente ».

## Contrôler l'autorité avant chaque action sensible

Appliquer les politiques de `project.yaml` :

- téléchargement ou installation de dépendances : `external_actions` ;
- remplacement, suppression, réinitialisation ou migration difficilement réversible : `destructive_actions` ;
- création d'un commit : `commits` ;
- déploiement ou publication : interdit dans ce skill, même si la politique le permet.

Ne jamais stocker de secret. Créer uniquement des exemples sans valeur sensible, tels que `.env.example`, et documenter la provenance attendue des valeurs réelles.

## Construire le socle

Procéder par changements petits et vérifiables :

1. créer ou compléter `docs/architecture.md` à partir de `assets/architecture-template.md` sans écraser un document existant ;
2. enregistrer les choix structurants acceptés dans `docs/decisions.md` ;
3. initialiser ou ajuster la structure minimale dans `code_root` ;
4. fixer les versions et le gestionnaire de paquets selon les conventions choisies ;
5. configurer uniquement les contrôles applicables : lint, typecheck, test et build ;
6. documenter l'installation, le démarrage et les variables d'environnement ;
7. maintenir les fichiers d'exclusion nécessaires sans retirer les règles existantes ;
8. mettre à jour `project.yaml.commands` uniquement avec des commandes réellement observées et exécutables.

Préserver les changements non liés. Ne pas ajouter de dépendance, d'abstraction ou de service « pour plus tard ».

## Vérifier le résultat

Consulter `references/setup-gates.md` et appliquer la variante nouveau projet ou dépôt existant.

- Exécuter les commandes applicables dans l'ordre le moins coûteux : lint, typecheck, tests ciblés puis build.
- Exécuter l'installation seulement si elle est nécessaire et autorisée.
- Relancer `ai-project doctor` après les modifications.
- Examiner le diff et l'état Git pour repérer les fichiers inattendus, secrets, artefacts ou modifications hors périmètre.
- Ne jamais transformer une commande non exécutée en succès. Indiquer `non exécuté` avec sa raison.

Créer `reports/setup-report.md` à partir de `assets/setup-report-template.md`. Relier chaque résultat aux commandes ou fichiers qui le prouvent.

Attribuer un verdict :

- `SETUP_READY` : socle reproductible, contrôles applicables réussis et aucun blocage ;
- `SETUP_WARNING` : socle utilisable avec une limite non bloquante explicitement acceptée ;
- `BLOCKED` : décision, autorité, outil ou contrôle déterminant manquant.

## Mettre à jour l'état

Après un résultat réellement vérifié :

- renseigner dans `PROJECT_STATE.md` le setup effectué et son verdict ;
- référencer `reports/setup-report.md` ;
- enregistrer les blocages restants ;
- définir la prochaine étape seulement avec `SETUP_READY` ou un `SETUP_WARNING` explicitement accepté : `project-plan` pour les modes `idea` et `brief` (obligatoire avant toute unité `project-work`), `project-plan` ou directement `project-work` pour les modes `existing` et `maintenance` selon que plusieurs unités restent à prioriser ;
- conserver la version du brief approuvé pour les modes `idea` et `brief`.

Ne pas créer de commit sauf demande explicite et politique compatible.

## Restituer le setup

Terminer par :

1. le résultat technique obtenu ;
2. les décisions acceptées ;
3. les fichiers et dépendances ajoutés ou modifiés ;
4. les commandes exécutées et leurs résultats ;
5. le verdict ;
6. les limites ou blocages ;
7. la prochaine étape autorisée.

Préciser explicitement qu'aucune fonctionnalité produit n'a été réalisée.
