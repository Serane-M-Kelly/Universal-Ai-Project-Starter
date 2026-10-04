# Validation de la version 0.25.0

Environnement : macOS (Darwin 25.5.0), Node 24.10.0, 3 octobre 2026. Aucune session Codex ou
Claude Code n'a été lancée et aucun appel de modèle n'a été fait par les tests.

Référence : la 0.24.0 non modifiée, copiée puis validée sur ce poste avant tout changement,
donnait 229/229. `npm run validate` sur la 0.25.0 réussit : **250 tests réussis (229 hérités +
21 nouveaux), aucun échec ni test ignoré**, vérification TypeScript, compilation et contenu du
paquet (213 fichiers). Journal : [release-025.txt](validation/release-025.txt). Six assertions
historiques ont été adaptées aux seuls numéros de version (project-setup v7, project-ship v5,
runtime minimal 0.25.0, starter_version 0.25.0), sans retirer de vérification.

Nouveaux cas : `tests/release-025.test.mjs` (continuité des essais humains, dont un workspace réel
produit par le runtime 0.24.0 d'origine) et `tests/readme-check.test.mjs` (site statique, API avec
variables, extension WordPress GPL, reprise d'un README existant) : voir [tests/README.md](../tests/README.md).

Vérifications hors suite :
- parcours complet dans un workspace créé par `workflow init` (Codex + Claude Code), via le runtime
  embarqué : observation, README modifié, `carry --dry-run`, contrôle, `carry`, statut
  `ready_for_review` avec l'essai conservé ; une modification de code ensuite est refusée ;
- copie de Calepio en lecture seule (blob README `1a08c857…`, commit `49bb6ab`) : `readme-check`
  sans erreur ni avertissement ; README et `docs/architecture.md` réorganisés conservables,
  `src/data/landing.ts` refusé ;
- commandes des fixtures exécutées : `npm test` (site statique) et `pnpm test` (API) réussissent
  après correction d'un script `node --test tests/` invalide sous Node 24. Composer/PHPUnit absents :
  commandes WordPress non exécutées.

Revues :
1. sous-agent Claude (contexte séparé, lecture seule) : 1 défaut bloquant et 5 à corriger ;
2. revue finale ChatGPT, premier passage : 3 contournements bloquants reproduits ;
3. sous-agent Claude adverse sur ces corrections : 14 classements à tort et 1 contournement par
   restauration d'état, reproduits.
Tous sont corrigés et couverts par des tests qui échouaient sur la version précédente (détail dans
[les notes 0.25](RELEASE-0.25.0.md)). Les sous-agents sont de la même famille de modèle que l'auteur :
ce ne sont pas des revues indépendantes humaines. Les dernières corrections attendent la revue ChatGPT.

# Historique — 0.24

# Validation de la version 0.24.0

Environnement : macOS 26.5.1, Node 24.10.0, 2 octobre 2026. Claude Code 2.1.287 et
codex-cli 0.159.3 sont installés sur le poste mais n'ont pas été lancés par les tests.

`npm run validate` réussit : **229 tests réussis (217 hérités + 12 nouveaux), aucun échec ni test
ignoré**, vérification TypeScript, compilation et contenu du paquet vérifiés (200 fichiers).
Journal : [release-024.txt](validation/release-024.txt). La suite 0.23 d'origine, exécutée sur le
même poste avant modification, donnait 217/217.

Les nouveaux cas (`tests/release-024.test.mjs`) couvrent les fichiers générés pour Claude, la
synchronisation sur deux assistants et les changements d'adaptateur : voir
[tests/README.md](../tests/README.md). Trois assertions historiques ont été adaptées au seul numéro
de version 0.24.0, sans retirer de vérification.

Reproduction manuelle du défaut, avec la distribution 0.23 non modifiée : sur un workspace Codex,
`ai-project adapter add claude-code` affiche « Skills synchronisés : 9 » mais laisse `.claude/skills`
vide et le Doctor bloque (9 copies absentes) ; `skill sync` ne répare pas. Le passage par
`models.json` + `models-sync` crée les agents Claude, aucune copie de skill ni `settings.json`, et le
Doctor bloque sur un `ENOENT`. Avec la 0.24, le même workspace est diagnostiqué, prévisualisé sans
écriture, réparé (verdict WARNING : seulement l'absence de Git de la fixture), et le runtime 0.23
embarqué fonctionne encore ensuite (`doctor`, `models-sync`, `skill sync`).

Non vérifié ici, à faire dans une vraie session (liste détaillée dans la réponse de livraison et
[l'audit](AUDIT-CLAUDE-CODE-0.24.md)) : chargement des skills `/project-…` et des agents, modèle
effectivement exécuté par rôle sur le compte, mode `plan` des sous-agents, règles `allow` sous
sandbox, écriture du builder dans le dossier applicatif. Aucun appel de modèle n'a été effectué.

La vérification de l'archive extraite est décrite dans [archive-024.txt](validation/archive-024.txt).

---

# Historique — 0.23

# Validation de la version 0.23.0

Environnement : Linux, Node 24.19.0, 1er octobre 2026.

`npm run validate` réussit : **217 tests réussis, aucun échec ni test ignoré**, vérification TypeScript, compilation et contenu du paquet vérifiés. Le paquet npm contient 194 fichiers et 1 030 574 octets décompressés. Journal : [release-023.txt](validation/release-023.txt).

Les deux nouveaux cas vérifient, pour Codex et Claude Code, la présence de la référence SEO dans le runtime indépendant installé et la résolution des chemins depuis les skills natifs. Ils vérifient aussi le refus d’une mise à jour isolée du skill Ship lorsque le runtime est encore 0.22, sans mutation des fichiers de suivi ou des copies du skill. Les autres tests conservent leur couverture ; les assertions des numéros de version ont été adaptées au catalogue.

Trois exercices en contextes indépendants ont vérifié le comportement de PA sur une refonte bilingue, d’AD sur une page publique minimaliste et de Ship/Start sur des sorties de production défectueuses : [cas et limites](validation/forward-023.md). Les validateurs des deux skills personnels PA/AD ont également réussi.

Ces résultats ne prouvent pas l’indexation, le classement ou la performance SEO d’un produit. Aucun outil externe, déploiement client ou accès Search Console n’a été exécuté. La 0.23 n’a pas été testée nativement sur Mac ; Kelly a fourni séparément une validation réussie de la 0.22 sur macOS avec Node 24.10.0. La livraison actuelle conserve le fonctionnement du moteur et ajoute des consignes conditionnelles.

La vérification finale du ZIP extrait est décrite dans [archive-023.txt](validation/archive-023.txt). Les personnalisations et historiques des workspaces v3 existants ne sont pas migrés automatiquement. Voir [les notes de version](RELEASE-0.23.0.md).

---

# Historique — 0.22

# Validation de la version 0.22.0

Environnement : Linux, Node 24.19.0, 1er octobre 2026. Les nouveaux contrôles sont dans
`tests/release-022.test.mjs` ; les assertions de versions des tests historiques suivent le catalogue.

**`npm run validate` réussit : 215 tests réussis, aucun échec ni test ignoré, compilation TypeScript
et paquet vérifiés.** Le paquet npm contient 193 fichiers et 1 016 565 octets décompressés.

Résultats détaillés et journal final : [release-022.txt](validation/release-022.txt).
Les huit tests de transmission du skill Project Architect réussissent, dont l’import idempotent
contre le runtime réel : [journal PA](validation/pa-022.txt).

Huit nouveaux scénarios automatisés couvrent :

- ajout, synchronisation, mise à niveau et conflits des copies natives Codex et Claude ;
- refus d’installer des skills de phases sur legacy et refus d’un runtime trop ancien ;
- conservation des diagnostics non positifs et des codes de sortie dans Doctor compact ;
- blocage après changement de référence PA/AD et arbitrage du changement de phase active ;
- refus d’une preuve positive si une référence change pendant la commande de contrôle ;
- chemins extérieurs, liens, disparition de fichier et préservation des références omises du plan ;
- distinction entre acceptation historique et préparation de commit sur des références courantes.

Deux agents, dans des contextes distincts et des fixtures isolées, ont reçu les demandes ordinaires
de préparer le plan d’un formulaire et de reprendre sa phase. Le premier a épinglé les quatre
sources utiles et enregistré une seule phase, sans lancer l’implémentation. Le second a constaté
une palette différente de la référence et consigné le blocage en conservant le mandat, sans modifier
le code, le plan ni les empreintes. Le coordinateur a vérifié les états produits et le code inchangé :
[résultats synthétiques](validation/forward-022.json). Aucun résultat n’est une acceptation d’un
produit de Kelly ni un benchmark de modèles sur son compte.

Mesures reproductibles : `node scripts/benchmark-context.mjs` et
`node scripts/benchmark-doctor.mjs`. Résultats :
[contexte](validation/context-022.json), [Doctor](validation/doctor-022.json).
Sur la fixture Doctor : 4 989 → 359 octets, 23 contrôles positifs regroupés, avertissement intégral,
verdict WARNING et code de sortie 1 conservés. Sur les fixtures de contexte : rapport 15 739 →
1 603 octets ; contexte historique 7 508 → 1 919 octets. Aucune mesure de tokens facturés.

Des passes intermédiaires ont échoué sur les numéros de versions attendus par cinq tests historiques ;
ces assertions ont été actualisées, sans retirer leurs vérifications de comportement.
Le ZIP est vérifié après extraction avec son runtime et ses dépendances embarquées. Aucun essai
natif macOS/Windows, appel authentifié des nouveaux modèles sur le compte de Kelly ou déploiement
de produit n’est revendiqué. Les personnalisations des workspaces déjà installés ne sont pas migrées
automatiquement ; voir [les limites de mise à niveau](RELEASE-0.22.0.md).

---

# Historique : validation de la version 0.20.1

La dernière exécution de `npm run validate` sous Linux avec Node 24.19.0 réussit :
**197 tests, 197 réussis, aucun échec ni test ignoré**, compilation et paquet vérifiés.
`npm audit` ne signale aucune vulnérabilité après la mise à jour de fast-uri à 3.1.7.
Le journal final est dans [release-v0201-197.txt](validation/release-v0201-197.txt).

Les trois nouveaux tests couvrent le cycle sous un alias de dossier et deux refus de sortie
du workspace. La passe finale utilise le répertoire temporaire habituel de Linux ; les essais
intermédiaires avec tout TMPDIR sous un alias sont documentés dans les
[notes du correctif](PATCH-0.20.1.md), y compris leurs échecs intermittents.
Aucune exécution native macOS n’a été réalisée ici : Kelly doit relancer les commandes sur son Mac.

---

# Historique : validation de la version 0.20.0

Validation effectuée le 8 septembre 2026 dans un environnement Linux, avec Node.js 24.19.0.
Il s’agit du starter intégré et d’exercices isolés, pas du produit Télécommande de Kelly.

## Vérifications exécutées

- Version historique 0.14.1, avant intégration : **176 tests réussis**, aucun échec.
- Suite intégrée `npm run validate` : **194 tests réussis**, aucun échec, compilation TypeScript et vérification du contenu du paquet réussies.
- Après les derniers ajustements de reprise et de documentation des commandes : **18 tests de workflow réussis**, ainsi que **8 contrôles du dépôt**, la compilation et la vérification du paquet. Ces tests sont des sous-ensembles de la suite de 194, pas 26 nouveaux tests.
- Un dernier essai depuis l’archive décompressée a identifié un avertissement hérité « aucun adaptateur » malgré les agents natifs présents. Son routage Doctor est corrigé et le test du CLI public a été relancé avec succès.
- Les neuf skills passent le validateur de structure SKILL.md.
- Les tests historiques ont conservé leurs contrôles de comportement. Les assertions de versions suivent le nouveau catalogue ; Discover est désormais installable sur un projet existant. Le contrat Ship historique est toujours contrôlé dans sa référence archivée.

Les nouveaux scénarios couvrent : lancement par le CLI public après approbation du brief,
réutilisation du mandat, reprise dans un nouveau processus, échec puis correction, preuves
périmées après modification du code, véritable tâche humaine distincte d’un test, ajout futur
sans interruption de l’actif, modification de périmètre, dépendances, réouverture, rendu manuel
archivé, rapports de revue rattachés aux empreintes, verrou, état corrompu, configuration native,
liens de compilation Swift, migrations du pilote et du backlog historique, commit manuel
avec une modification préexistante exclue.

## Essais avec des agents dans des contextes distincts

Un premier agent a reçu Next et une demande évoquant une fonctionnalité future. Il a constaté
la préparation manquante sans lancer de phase ni inventer son autorisation.

Un essai Phase a révélé une incompatibilité du format de date entre brief-approve et Doctor.
Le moteur écrivait un horodatage alors que le brief exige une date civile. Le défaut est corrigé
et couvert par le test qui emploie réellement la commande publique begin.

Une nouvelle session d’agent a ensuite reçu uniquement le workspace et la demande courte
`$project-phase 1`. Dans un exercice d’addition, elle a corrigé l’opération et exécuté trois tests
contenant huit assertions. Elle a résolu un verrou résiduel par la commande prévue, après
vérification de l’absence du processus. Elle a terminé à « Prête pour la revue », sans inventer
d’observation humaine ou d’acceptation. Le manque de --help constaté pendant cet essai a aussi
été corrigé ; l’aide est maintenant intégrée au runtime.

Un autre agent a inspecté directement le code et les tests, réexécuté les trois tests et vérifié
les empreintes avant et après. Son rapport réel a été enregistré par le coordinateur. Le moteur
a alors indiqué « Prête à accepter ». Aucune acceptation de Kelly n’a été simulée.

Ces essais évaluent les instructions et les transitions avec les outils de cet environnement.
Ils ne constituent pas un lancement du CLI Codex authentifié de Kelly ni un benchmark
Astra/Sol/Terra/Luna. Le format des agents TOML a été vérifié dans la
[documentation officielle](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Limites et essai utilisateur restant

L’accès aux modèles, leur effort effectivement appliqué et le chargement des agents sur le Mac
restent à constater dans la session de Kelly. Aucun build iOS/macOS ni essai iPhone–Mac n’a été
exécuté ici. Les résultats du pilote v0.1.1 rapportés par Kelly ne sont pas attribués à cette version.

L’adaptateur Claude est généré, mais son parcours conversationnel n’a pas été évalué ici.
Les gros monorepos, les liens symboliques de sources et les jeux riches en assets restent à éprouver.
Les répertoires générés ignorés ne doivent pas contenir de sources écrites à la main. Les signatures
locales détectent une incohérence ; elles ne prouvent ni l’authenticité de l’historique ni la qualité métier.

L’essai suivant se trouve dans [DEMARRER.md](../DEMARRER.md). Le critère utilisateur est de
conduire une phase, sa revue et une reprise avec les appels ordinaires, sans relais par une autre IA.
