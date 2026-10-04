---
name: project-ship
description: "Préparer, vérifier, faire autoriser et observer une livraison logicielle ou un artefact à partir d'unités de travail acceptées : candidat, version, notes, contrôles finaux, cible, retour arrière et preuve post-livraison. Utiliser quand un changement accepté doit être remis, publié, déployé ou empaqueté ; ne pas utiliser pour implémenter, corriger silencieusement, committer, taguer, publier ou déployer sans cible exacte et autorité humaine explicite."
---

# Project Ship

Transformer des unités acceptées en livraison traçable. Séparer la préparation du candidat, sa qualification, l'autorisation externe et l'observation du résultat réel.

## Vérifier les préconditions

- Lire `project.yaml`, `PROJECT_BRIEF.md`, `PROJECT_STATE.md`, l'architecture, les décisions, les unités incluses et leurs rapports.
- Exécuter `ai-project doctor` et bloquer sur tout verdict `BLOCKED`.
- Exiger que chaque unité incluse porte `status: accepted`, une personne et une date d'acceptation.
- Vérifier que la version du brief ou la demande de maintenance n'a pas changé depuis ces acceptations.
- Inspecter Git : dépôt, branche, commit de base, diff, fichiers non suivis, changements préexistants et relation avec la cible distante.
- Refuser d'inclure implicitement une modification non acceptée, même si elle semble utile ou minime.

Si une correction est nécessaire, créer ou rouvrir une unité `project-work`, la faire vérifier et accepter, puis reconstruire le candidat.

## Définir la livraison

Attribuer le prochain identifiant libre `SHIP-001` et créer `livraisons/SHIP-001.md` depuis `assets/shipment-template.md`.

Définir explicitement :

- unités et commit ou état source inclus ;
- cible exacte et environnement ;
- type de livraison : artefact local, remise, registre, store, staging ou production ;
- version ou identifiant de candidat ;
- utilisateurs ou systèmes affectés ;
- préconditions externes ;
- migrations et compatibilité ;
- stratégie de retour arrière ;
- contrôles post-livraison et fenêtre d'observation ;
- personne autorisée à approuver l'action.

Commencer avec `status: proposed`. Une demande « livre ceci » sans cible, version ou périmètre exact n'autorise aucune action externe.

## Construire le candidat

Passer à `candidate` seulement après avoir figé la source incluse. Préparer sans publier :

1. version et métadonnées cohérentes avec les conventions du projet ;
2. notes créées depuis `assets/release-notes-template.md` et reliées aux unités acceptées ;
3. artefact reproductible ou commande exacte de déploiement ;
4. configuration attendue sans aucune valeur secrète ;
5. instructions de migration, sauvegarde et retour arrière applicables ;
6. procédure de vérification et d'observation après livraison.

Ne pas ajouter une fonctionnalité, corriger un défaut ou refactorer pendant la fabrication du candidat. Une modification de code autre que les métadonnées de livraison retourne à `project-work`.

## Qualifier le candidat

Charger `references/ship-gates.md` et appliquer les portes communes, celles du type de cible et la variante renforcée si nécessaire.

- Repartir d'un état source identifié et examiner le diff final.
- Exécuter les commandes applicables de `project.yaml` et les tests d'acceptation reliés aux unités.
- Construire l'artefact avec la procédure documentée.
- Vérifier version, contenu, taille, signature ou empreinte lorsque applicable.
- Contrôler secrets, fichiers privés, dépendances, licences et vulnérabilités selon le risque et les outils disponibles.
- Vérifier la compatibilité des migrations, la sauvegarde et le retour arrière sans exécuter la migration de production.
- Faire une revue séparée du manifeste de livraison, des notes et des preuves.

Créer `reports/ship/SHIP-001.md` depuis `assets/ship-report-template.md`. Une commande non exécutée reste `non exécuté` ; une indisponibilité d'outil n'est jamais un succès.

Passer à `ready_to_ship` uniquement lorsque toutes les portes obligatoires sont réussies et qu'aucun constat bloquant ou majeur ne reste ouvert. Cet état signifie « qualifié », jamais « publié ».

## Obtenir l'autorisation exacte

Présenter avant toute action externe :

- identifiant et version ;
- source incluse ;
- cible et environnement ;
- commandes ou opérations qui seront exécutées ;
- effets attendus et personnes affectées ;
- risques résiduels ;
- retour arrière ;
- vérifications post-livraison.

Appliquer les politiques :

- commit et tag : `commits` ;
- upload, message, registre ou appel externe : `external_actions` ;
- déploiement, publication ou mise en production : `deployment` ;
- suppression, migration irréversible ou rollback destructif : `destructive_actions`.

Une politique `allowed` n'est pas une consigne d'exécuter : elle exige encore une demande humaine actuelle portant sur cette cible et ce candidat. Avec `ask`, obtenir une confirmation explicite après le résumé. Avec `forbidden`, rester à `ready_to_ship` et fournir la procédure manuelle.

Après autorisation, renseigner `approved_by`, `approved_at` et `status: approved`. Une autorisation conditionnelle ne permet pas l'exécution tant que la condition n'est pas vérifiée.

## Exécuter sans élargir

- Utiliser uniquement le mécanisme et le compte déjà placés dans le périmètre.
- Ne jamais demander, afficher, copier ou enregistrer un secret dans le workspace ou le rapport.
- Exécuter une étape externe à la fois et observer son résultat avant la suivante.
- Ne pas modifier silencieusement la cible, la région, le canal, le destinataire ou la version.
- Arrêter en cas de résultat ambigu, d'état partiel ou de divergence avec le candidat autorisé.
- Ne pas relancer une opération non idempotente sans nouvelle analyse et autorité.

Un agent ou connecteur spécialisé peut effectuer une étape, mais reçoit uniquement la cible, l'action et l'autorité du manifeste approuvé.

## Observer et décider l'état réel

Après l'action :

1. capturer l'identifiant externe, l'URL, l'empreinte ou l'accusé de réception ;
2. exécuter les smoke tests et contrôles post-livraison prévus ;
3. vérifier version, disponibilité et comportement sur la cible exacte ;
4. observer les signaux définis pendant la fenêtre applicable ;
5. enregistrer toute différence entre résultat attendu et réel.

Utiliser les états :

- `shipped` : action réussie et résultat externe vérifié ;
- `partially_shipped` : certaines étapes ont réussi, l'état final reste incomplet ;
- `blocked` : aucune action ou prochaine étape sûre n'est possible ;
- `rolled_back` : retour arrière autorisé, exécuté et vérifié.

Ne jamais déclarer `shipped` sur la seule base d'une commande envoyée ou d'un statut « en cours ». Un artefact préparé mais non remis reste `ready_to_ship`.

En cas d'échec, préserver les preuves, évaluer l'impact et demander l'autorité avant tout rollback non déjà autorisé. Ne pas masquer un état partiel par un retour local réussi.

## Clôturer la livraison

Après résultat observé :

- finaliser `reports/ship/SHIP-001.md` ;
- enregistrer la décision, la cible, la version et les risques acceptés dans `docs/decisions.md` ;
- mettre à jour `PROJECT_STATE.md` avec l'état réel, les liens de preuve et la prochaine surveillance ou unité ;
- conserver les incidents et actions de suivi comme nouvelles unités `project-work` ;
- ne jamais inscrire de secret ou de donnée personnelle inutile dans les preuves.

## Restituer la livraison

Terminer par :

1. identifiant, version et cible ;
2. unités incluses ;
3. portes exécutées et résultat ;
4. autorité reçue ;
5. action réellement effectuée ;
6. preuve externe et contrôles post-livraison ;
7. état exact ;
8. risques, surveillance ou reprise nécessaires.

Employer « prêt à livrer » tant que l'action externe et sa vérification n'ont pas réellement réussi.
