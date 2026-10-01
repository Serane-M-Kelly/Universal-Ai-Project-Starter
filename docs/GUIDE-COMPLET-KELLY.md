# Le Starter 0.23.0 — Guide pratique de Kelly

Ce guide décrit la version livrée 0.23.0. Il distingue les fonctions effectivement présentes des outils, accès et décisions à fournir. Les exemples de demandes sont à écrire dans Codex ; les commandes Bash sont à exécuter dans Terminal.

## 1. Ce que tu es censée faire maintenant

Commence par un petit projet d’essai indépendant. Vérifie le cycle préparation → réalisation → revue → essai personnel → reprise. Ensuite, utilise le starter sur ton vrai projet avec le parcours approprié ci-dessous.

Si ton projet possède déjà un workspace 0.20, 0.21 ou 0.22, conserve-le : décompresser la nouvelle archive ne le met pas à jour. Il n’existe pas dans cette livraison de commande générale de mise à niveau sur place d’un workspace v3. Voir la section 13 avant toute manipulation.

Tu n’as pas à apprendre neuf commandes ni à éditer du JSON. Tu exprimes ton objectif, tu arbitres les vrais choix, tu observes le résultat et tu décides de son acceptation. L’agent entretient le suivi.

## 2. Qui fait quoi : toi, PA, AD et le starter

| Intervenant | Responsabilité | Exemple |
|---|---|---|
| Toi | Intention, contraintes, choix, observations réelles et acceptation | « Le paiement reste hors périmètre pour cette version. » |
| Project Architect — PA | Besoin, public, positionnement, parcours, périmètre et décisions produit | Définir le parcours de réservation et les critères de réussite. |
| Art Director — AD | Direction visuelle, identité, composition, assets, états et règles visuelles | Définir la palette, les composants et leur comportement visuel sur mobile. |
| Starter | Transformer les décisions en travail réalisable, réaliser, vérifier, conserver l’état et préparer la livraison | Construire et tester le parcours de réservation approuvé. |

PA et AD sont utiles lorsque le problème le justifie. Une correction de bouton n’exige pas un nouveau cadrage produit. Une affiche autonome peut relever uniquement d’AD. Un petit outil au besoin déjà clair peut commencer directement dans le starter.

Le starter ne rend pas automatiquement accessibles tes conversations ChatGPT, tes fichiers Figma ou Claude Design. Fournis les fichiers, exports et décisions nécessaires. PA et AD ne sont pas installés automatiquement comme skills personnels par cette archive.

## 3. Installer un nouveau projet

Décompresse `Universal_AI_Project_Starter_v0.23.0.zip`, puis ouvre Terminal dans le dossier décompressé contenant `dist`, `README.md` et `DEMARRER.md`.

Tu peux vérifier les prérequis :

```bash
node --version
git --version
codex --version
```

Le runtime demande Node.js 22 ou supérieur. Codex doit être disponible pour le parcours Codex. Git sert au versionnement et aux livraisons par commit. La distribution contient déjà le programme compilé et ses dépendances : aucun `npm ci` n’est nécessaire simplement pour démarrer.

Depuis le dossier de la distribution, choisis une destination qui n’existe pas encore :

```bash
node dist/index.js workflow init ../mon-projet --name "Mon produit" --owner "Kelly"
cd ../mon-projet/ai-workspace
codex
```

Deux espaces sont séparés : `app` contient le produit ; `ai-workspace` contient son pilotage privé, ses règles, décisions et preuves. Ouvre Codex dans **ai-workspace**. Le runtime est copié localement : le dossier de distribution n’a pas besoin de rester à côté du projet.

Pour ton premier essai, écris dans Codex :

```text
$project-start
Je veux une liste de tâches locale : ajouter, cocher, supprimer et conserver après rechargement.
Sans compte, serveur ni déploiement. Prépare le projet et propose un plan simple à valider.
```

L’initialisation du workspace ne signifie pas qu’un framework complet, un dépôt Git ou un hébergement sont déjà opérationnels. Setup prépare les éléments techniques nécessaires au projet retenu.

### Choisir le profil et l’assistant

Ajoute éventuellement `--profile nextjs`, par exemple, à la commande d’initialisation.

| Profil | Usage |
|---|---|
| `generic` | Choix par défaut ; stack inconnue ou autre environnement. |
| `node-api` | API HTTP TypeScript correspondant aux conventions du profil. |
| `nextjs` | Projet Next.js TypeScript. |
| `swiftui` | Projet SwiftUI ; Xcode et les essais sur appareil nécessitent l’environnement adéquat. |
| `wordpress` | Site, thème ou plugin WordPress avec son environnement réel. |

Un profil fournit des règles et des contrôles ; ce n’est pas une application complète préinstallée. Un projet Express ou JavaScript existant ne doit pas être forcé dans Next.js. Le profil générique permet d’adapter le suivi à sa stack.

Pour un nouveau workspace Claude Code, ajoute `--adapter claude-code`. Ouvre ensuite ce workspace dans Claude Code et vérifie le chargement des skills natifs. Les exemples `$project-…` de ce guide concernent Codex ; dans un autre assistant, nomme le skill ou formule la demande selon son interface. L’adaptateur Claude n’utilise pas les identifiants de modèles OpenAI comme modèles Claude.

## 4. Choisir le bon départ

### A. Tu as une idée encore floue

Travaille d’abord avec PA : pour qui, quel problème, quels parcours, quelle première version ? Fais intervenir AD si des choix visuels structurants sont nécessaires. Ne demande pas encore un plan technique détaillé pour une intention instable.

Demande à PA de préparer les fichiers de transmission utiles au starter. Puis suis le parcours C.

### B. Tu as un besoin simple et précis

Commence directement avec Start. Donne le résultat attendu, les limites et un exemple d’utilisation. Discover ne doit compléter que les informations manquantes.

```text
$project-start
Je veux un formulaire qui calcule un devis localement selon ces trois paramètres : […]
Voici les règles de calcul : […]. Sans compte ni sauvegarde distante.
Prépare un plan proportionné et signale les seules décisions qui manquent.
```

### C. Tu as un dossier PA et des éléments AD pour un nouveau projet

Fournis le dossier local réel, décompressé, et son chemin. Le format de package PA v1 attend sa structure complète de dix fichiers ; le nom du projet dans le manifeste doit correspondre au nom utilisé à l’initialisation.

```text
$project-start
Le dossier PA est ici : /chemin/product-package.
Les exports AD sont ici : /chemin/design.
Vérifie leur compatibilité avec ce projet, importe le package si les conditions le permettent,
complète seulement les manques et prépare le plan de réalisation.
Réutilise les décisions déjà validées dont tu peux vérifier la portée.
```

L’agent peut utiliser, depuis ai-workspace :

```bash
node .starter/run.mjs intake import "/chemin/product-package" .
```

**L’import automatique est réservé aux modes d’entrée `idea` ou `brief`, avec un brief encore en brouillon.** Un import réussi n’est pas une approbation du produit ni une autorisation générale de réaliser tout le contenu.

Les fichiers AD utilisés comme référence doivent être identifiés et épinglés dans le plan. Un index ne couvre pas automatiquement tous les fichiers qu’il cite. L’agent doit lire et suivre les références effectivement nécessaires : tokens, composants, états ou autres fichiers pertinents.

### D. Tu as déjà du code, sans historique de starter à reprendre

Crée d’abord une copie ou un clone isolé si tu veux un essai sans intervenir sur ton exemplaire habituel. Place le pilotage hors du dépôt produit. Depuis la distribution :

```bash
node dist/index.js workflow init ../mon-projet-pilotage --name "Mon produit" --owner "Kelly" --code-root "/chemin/absolu/vers/le-code"
cd ../mon-projet-pilotage/ai-workspace
codex
```

`--code-root` désigne le code réel à utiliser : **il ne le copie pas et ne crée pas de branche**. Cette commande crée un nouveau suivi, sans importer l’historique d’un ancien workspace.

```text
$project-start
Analyse le projet existant, ses commandes et son état Git avant toute modification.
Mon objectif est […]. Préserve les changements déjà présents.
Propose un plan limité à cet objectif et relève les incertitudes importantes.
```

Dans ce mode `existing`, un dossier PA sert de **référence pour le changement** : l’import automatique décrit au parcours C est refusé. L’agent doit confronter le dossier au code et aux décisions actuelles. Ne lui demande pas de remettre artificiellement le brief en brouillon pour contourner cette restriction.

### E. Tu as déjà un workspace de starter

Reprends dans son ai-workspace avec Start. Si tu souhaites le faire passer à 0.23, applique les distinctions de la section 13. Ne recrée pas un nouveau suivi en pensant conserver automatiquement l’ancien.

## 5. Le cycle quotidien

### 1 — Reprendre et savoir où tu en es

```text
$project-start
Reprends ce projet. Résume le résultat acquis, les blocages et la prochaine action utile.
```

Une simple demande de reprise n’autorise pas à recommencer à coder. Start examine l’état et retrouve les décisions et mandats conservés.

### 2 — Choisir la suite

```text
$project-next
```

Next recommande une phase faisable. Tu peux sauter cette étape si tu sais déjà quelle phase tu veux lancer. Un bon plan découpe des résultats testables ; il ne crée pas une phase pour chaque fichier.

### 3 — Autoriser la réalisation

```text
$project-phase 1
Réalise cette phase, effectue ses vérifications et enchaîne la revue.
Corrige les écarts dans le périmètre convenu. Arrête-toi aux essais qui demandent mon intervention.
```

Remplace 1 par le numéro réel. L’autorisation couvre les travaux nécessaires à cette phase, y compris ses corrections locales. Elle n’autorise pas automatiquement la phase suivante, un push ou une publication.

### 4 — Vérifier le résultat

```text
$project-review
Vérifie la phase en cours par rapport à ses critères et aux références applicables.
```

La revue apporte un examen distinct du travail de construction. Des écarts pertinents déclenchent des corrections et une nouvelle vérification. Les suggestions facultatives ne doivent pas devenir des conditions imprévues. Si deux cycles ne convergent pas, l’agent doit exposer le désaccord concret.

### 5 — Faire ton essai réel et accepter

L’agent ne peut pas inventer ton observation d’un écran, d’un appareil ou d’un service inaccessible. Effectue les gestes demandés et décris le résultat.

```text
J’ai essayé l’ajout, la suppression et le rechargement sur mon navigateur : tout correspond.
J’accepte cette phase.
```

Si ça ne convient pas : « À l’étape 3, j’obtiens X alors que j’attends Y ; voici la capture. » Une acceptation conditionnelle est possible si ses conditions sont précises et réellement vérifiables. Elle ne remplace pas une observation humaine indispensable.

### 6 — Préparer la livraison

```text
$project-ship
Prépare le commit de cette phase avec les fichiers exacts et un message clair.
```

Dans ton workflow, tu exécutes toi-même les commandes Git préparées. L’agent vérifie ensuite le résultat réel. **Acceptation, commit, push et déploiement sont quatre actes distincts.** Pour publier, précise l’environnement et la destination souhaités ; un commit ne donne pas cette autorisation.

## 6. À quoi servent les neuf skills ?

| Skill | Quand l’utiliser | Exemple concret |
|---|---|---|
| `project-start` | Entrée et reprise | Retrouver l’état après trois jours. |
| `project-discover` | Clarifier un manque qui bloque l’exécution | Déterminer le comportement d’un formulaire hors ligne. |
| `project-handoff` | Vérifier la transmission vers l’exécution | Contrôler que les critères reprennent les décisions PA. |
| `project-setup` | Préparer la base technique minimale | Configurer la commande de test utile à la première phase. |
| `project-plan` | Organiser les résultats et dépendances | Répartir un parcours de réservation en livrables vérifiables. |
| `project-next` | Recommander la prochaine étape | Repérer la phase réalisable sans dépendance bloquante. |
| `project-phase` | Réaliser une phase autorisée | Implémenter le formulaire et ses états d’erreur. |
| `project-review` | Évaluer les critères et organiser les corrections | Vérifier le clavier, les erreurs et les tests du formulaire. |
| `project-ship` | Préparer une livraison précise | Préparer le commit puis vérifier celui que tu as exécuté. |

Ces responsabilités expliquent leur conservation : Discover/Handoff/Plan travaillent sur la préparation de l’exécution ; PA décide du produit. Le starter réalise et vérifie le visuel choisi ; AD en conçoit la direction.

Start peut orienter et enchaîner une préparation autorisée. Tu n’as pas à invoquer mécaniquement chaque skill. L’ancien `project-work` reste réservé aux formats historiques, pas au workflow v3 quotidien.

## 7. Tous les grands cas de travail

| Situation | Demande adaptée | Limite à respecter |
|---|---|---|
| Site vitrine ou landing page | « Réalise les parcours et sections validés, avec leurs critères de conversion. » | Les textes, preuves et visuels nécessaires doivent être disponibles. |
| Application web ou tableau de bord | « Planifie puis réalise ce parcours utilisateur de bout en bout. » | Comptes, données et services réels nécessitent des accès adaptés. |
| API | « Implémente cet endpoint avec validation, erreurs et tests. » | Définir le contrat et l’environnement de test. |
| Application native | « Réalise cette fonctionnalité et prépare les essais sur appareil. » | Les compilateurs et appareils ne sont pas fournis par le starter. |
| WordPress | « Modifie ce thème/plugin dans l’environnement de test. » | Besoin du vrai environnement WordPress. |
| Autre logiciel, jeu ou outil interne | « Adapte le profil générique et les vérifications à cette stack. » | Pas de chaîne de compilation universelle prête à l’emploi. |
| Nouvelle fonctionnalité | « Ajoute ce résultat au plan, avec dépendances et critères. » | Une décision produit importante peut revenir à PA. |
| Refonte importante | « Confronte les décisions PA/AD à l’existant, puis propose les étapes. » | Ne pas remplacer des comportements utiles sans arbitrage. |
| Bug précis | « Reproduis ce défaut, identifie sa cause, puis corrige-le dans ce périmètre. » | Distinguer correction de phase et nouveau besoin. |
| Diagnostic seul | « Cherche la cause et présente les preuves, sans modifier le code. » | L’audit n’autorise pas les corrections. |
| Retouche visuelle | « Applique cette modification validée et vérifie les états concernés. » | Pas de nouvelle exploration AD complète si inutile. |
| Performance | « Mesure ce ralentissement, corrige sa cause et compare le résultat. » | Définir une mesure et des conditions reproductibles. |
| Accessibilité | « Audite ce parcours puis propose des corrections vérifiables. » | Compléter l’automatisation par les essais pertinents. |
| Sécurité | « Examine ce périmètre et classe les problèmes avec leurs preuves. » | Un audit limité ne constitue pas une garantie exhaustive. |
| Dépendances ou migration technique | « Prépare la migration, les risques, les vérifications et le retour arrière. » | Séparer modifications locales et actions sur des données/services réels. |
| Refactorisation | « Simplifie cette zone en préservant ces comportements. » | Fixer les invariants et tester les risques réels. |
| Tests ou documentation | « Produis ce résultat vérifiable sans élargir le chantier. » | Adapter la phase à un livrable non fonctionnel. |
| Livraison | « Prépare la livraison de cette version vers cette destination. » | Accès, autorisation et résultat de publication doivent être réels. |

Pour la conversion et le juridique, PA cadre notamment les parcours, les informations nécessaires et les questions dépendant de l’activité, des données ou des pays concernés. AD traite leur présentation et les interactions ; le starter réalise et teste les comportements décidés. Il n’existe pas dans cette livraison de certification juridique automatique ni de garantie de conversion. Une vérification juridique doit préciser son périmètre et s’appuyer sur des sources officielles actuelles ; un avis professionnel peut être nécessaire selon le sujet.

## 8. Ajouter, retirer ou changer une idée pendant le travail

- **Correction dans la phase** : « Ce champ doit afficher l’erreur prévue ; corrige-le. » Le mandat existant peut suffire.
- **Idée indépendante pour plus tard** : « Ajoute l’export CSV à la suite, sans interrompre la phase actuelle. »
- **Changement de l’objectif actif** : « Remplaçons le formulaire par une réservation avec paiement. » L’agent expose l’impact et demande l’arbitrage nécessaire avant de changer le périmètre.
- **Réorganisation** : « Priorise la réservation et reporte le tableau de bord. Vérifie les dépendances. »
- **Suppression d’un besoin** : « Retire cette fonctionnalité du périmètre et conserve la trace de la décision. »
- **Régression après acceptation** : « Cette fonctionnalité acceptée ne marche plus dans ce cas. » L’agent détermine les phases ou validations affectées ; l’ancienne acceptation reste historique.

Une nouvelle suggestion ne doit pas invalider arbitrairement une phase indépendante déjà autorisée. À l’inverse, une vraie modification de son objectif ne doit pas passer pour une simple correction technique.

## 9. Quand PA ou AD change un fichier de référence

Le suivi peut épingler les fichiers locaux nécessaires par leur empreinte. Si une référence épinglée est modifiée ou disparaît, les opérations concernées peuvent être bloquées : démarrage, nouvelle preuve, acceptation ou préparation du commit.

Demande :

```text
La direction artistique a été mise à jour. Compare les nouvelles références à celles du plan,
explique les impacts et propose la révision nécessaire. Ne considère pas une nouvelle empreinte
comme une approbation de la modification.
```

Il faut examiner le changement avant de mettre à jour le plan. Une ancienne revue verte ne prouve pas la conformité aux nouvelles références. Les liens vers des outils externes ne se synchronisent pas automatiquement : fournis un export ou une version consultable. Une maquette seule ne décrit pas forcément tous les états, les interactions ou les droits sur les assets.

## 10. Préserver tes tokens sans perdre le fil

1. Reprends dans le même ai-workspace : le suivi doit porter l’historique, pas tes copier-coller.
2. Donne un objectif, un périmètre et un résultat attendu ; évite « améliore tout ».
3. Demande un état compact et les détails seulement lorsqu’ils éclairent une décision.
4. Réutilise les acquis PA/AD ; ne relance pas une exploration déjà suffisante.
5. Autorise ensemble réalisation, vérifications et revue d’une phase définie si c’est ton intention.
6. Ne fais pas exécuter le même travail de construction par plusieurs agents en parallèle sans raison.
7. Demande des tests proportionnés au risque et aux critères, pas un élargissement permanent de la campagne.
8. À la reprise, ne demande pas de relire tous les documents : l’agent doit lire ce qui est nécessaire, y compris les sources complètes quand la décision l’exige.
9. Réserve les efforts de raisonnement élevés aux ambiguïtés ou risques qui le justifient.

Les valeurs par défaut configurées dans cette archive sont : coordinateur et réalisation `gpt-6.1-sol` en effort moyen ; planification et revue `gpt-6.1-sol` en effort élevé ; lecture `gpt-6-luna` en effort moyen. Cela décrit la configuration du starter, pas la disponibilité sur ton compte ni un changement automatique du modèle de ta conversation.

Tu peux choisir Astra pour un problème difficile ; utiliser systématiquement son effort maximal n’est pas une condition de bon fonctionnement. Les sorties compactes réduisent le volume de contexte courant, mais aucune économie chiffrée de facture ou de quota n’est garantie : les lectures complémentaires et la complexité du travail comptent aussi.

## 11. Pause, reprise, plusieurs projets et sauvegardes

Tu peux fermer une conversation et reprendre avec Start dans le même ai-workspace. Demande explicitement la continuation de la phase si tu veux relancer l’exécution. Évite de faire écrire deux coordinateurs simultanément dans le même état de pilotage.

Utilise un workspace par projet. Dans chaque workspace, le workflow suit une phase active à la fois. Des spécialistes peuvent intervenir sur des tâches bornées sans prendre chacun le contrôle du plan.

Sauvegarde **le code et ai-workspace**. Le Git du produit seul ne conserve pas nécessairement les mandats, décisions et preuves du pilotage privé. Ce dernier n’a pas vocation à être publié dans le dépôt ou le site du produit.

Si tu déplaces le code, demande à l’agent d’utiliser `workflow relocate` pour mettre à jour les chemins. Ne remplace pas au hasard les chemins dans tous les fichiers. Un changement d’assistant suppose que les fichiers et l’adaptateur appropriés soient réellement accessibles.

## 12. Si quelque chose bloque

```text
$project-start
Diagnostique ce blocage. Donne la cause observée, l’action minimale de récupération
et les éventuelles décisions nécessaires. Préserve l’état et les travaux existants.
```

| Symptôme | Réaction attendue |
|---|---|
| Référence PA/AD modifiée | Comparer, arbitrer l’impact et réviser les références concernées. |
| Test en échec | Distinguer régression, défaut antérieur et problème d’environnement, avec preuves. |
| Accès manquant | Identifier l’accès précis ; tu le fournis par le mécanisme approprié, sans inventer un succès. |
| Modifications Git déjà présentes | Identifier leur origine et préserver les travaux ; ne pas les supprimer pour obtenir un état propre. |
| Verrou après interruption | Vérifier d’abord qu’aucun processus propriétaire ne travaille encore. |
| Vue générée incohérente | Diagnostiquer puis utiliser la réparation prévue ; ne pas réécrire l’état de référence à la main. |
| État endommagé | Examiner les sauvegardes et conséquences d’une restauration ; ne pas recréer des validations fictives. |
| Doctor signale un avertissement | Lire sa cause ; un avertissement n’est pas systématiquement un blocage de tout le projet. |

`status`, `context` et Doctor aident au diagnostic. Tu peux laisser l’agent les appeler. Les vues générées comme le backlog ne sont pas des substituts à l’état de référence : évite les corrections manuelles improvisées.

## 13. Anciennes versions : trois situations différentes

| Ce que tu possèdes | Marche à suivre |
|---|---|
| Un ZIP ancien, sans projet créé | Utiliser directement la distribution 0.23 pour un nouveau projet. |
| Un workspace v3, notamment 0.20, 0.21 ou 0.22 | Conserver l’existant. Préparer une mise à niveau spécifique si tu veux conserver tout son historique ; pas de migration legacy. |
| Un pilote Python v0.1.1 ou backlog historique v2 | La commande de migration historique peut créer un nouveau workspace après diagnostic à blanc. |

Exemple **uniquement pour un format historique compatible**, depuis la distribution :

```bash
node dist/index.js workflow migrate --source "../ancien-pilote/ai-workspace" --target "../pilote-v022" --dry-run
```

Après examen des chemins et du résultat, la même commande sans `--dry-run` réalise la conversion vers la nouvelle destination. La migration conserve une archive de l’ancien suivi et réutilise le chemin du code ; elle ne copie pas l’application. Les anciennes preuves restent historiques. Le backlog historique v1 nécessite d’abord sa conversion vers v2 par l’ancien parcours adapté.

Ne remplace pas seulement quelques fichiers de runtime ou de skills dans un workspace existant. Un nouveau pilotage relié au même code reste un nouveau suivi : ce n’est pas une migration de son historique.

## 14. Modifier le starter ou ses skills plus tard

Il faut distinguer les sources du starter, les copies présentes dans les projets et tes skills personnels PA/AD. Modifier une source ne propage pas automatiquement la modification à tous les projets.

Pour les skills embarqués, l’agent doit modifier leur source canonique `skills/<nom>/SKILL.md`, puis utiliser la synchronisation prévue vers l’adaptateur. Les copies natives générées ne sont pas le bon endroit pour une modification durable. Les divergences locales doivent être examinées avant tout remplacement forcé.

Une modification de comportement du moteur demande sa propre validation et un traitement explicite de la compatibilité des workspaces. Demande un changement précis avec son résultat attendu, plutôt qu’une simplification générale qui supprimerait des contrôles utiles.

## 15. Les cinq demandes à garder sous la main

**Reprendre**

```text
$project-start
Reprends l’état actuel et indique la prochaine décision ou action utile.
```

**Lancer le travail**

```text
$project-phase 1
Réalise la phase, vérifie-la et enchaîne sa revue dans le périmètre autorisé.
```

**Signaler un défaut**

```text
Dans [écran/contexte], quand je fais [action], j’obtiens [résultat].
J’attends [résultat prévu]. Voici la capture ou le message exact : […].
```

**Ajouter une idée**

```text
Ajoute [besoin] pour la suite. Vérifie son impact sur le plan sans interrompre
la phase actuelle si cette idée en est indépendante.
```

**Accepter puis préparer le commit**

```text
J’ai testé [gestes] et observé [résultats]. J’accepte cette phase.
Prépare son commit et les commandes que je dois exécuter.
```

Ton premier objectif pratique est de réussir une petite phase puis de la retrouver correctement dans une nouvelle conversation. Tu pourras ensuite reprendre ce même fonctionnement sur un projet réel, sans avoir à administrer toi-même les fichiers du workflow.

## 16. Le parcours SEO de la 0.23

Le SEO intervient si des pages publiques doivent être découvertes depuis la recherche, ou si une refonte peut affecter leur visibilité. Pour un outil privé ou un changement sans impact, l’agent n’ouvre pas un chantier SEO. Il s’agit de nouvelles consignes de travail : la 0.23 n’ajoute pas un scanner automatique ni de nouvelle commande de référencement.

| Moment | Ce qui est fait | Preuve ou décision attendue |
|---|---|---|
| PA ou Discover | Définir intentions, pages, contenus, langues, action utile et informations manquantes. | Carte des contenus et sources réelles dans le dossier existant. |
| AD | Préserver textes, informations, navigation et versions linguistiques dans les maquettes. | Rendus inspectés ; pas de validation technique depuis une image. |
| Setup et Plan | Définir solutions adaptées à la stack, critères, contrôles de publication et suivi. | Même brief et même plan, sans dossier SEO obligatoire. |
| Phase et Review | Vérifier le contenu rendu, les URL, liens, métadonnées, restrictions et autres critères pertinents. | Contrôles proportionnés et limites explicites. |
| Ship | Après la publication manuelle, vérifier les pages sur le vrai domaine. | Rapport de livraison avec cible, date, version connue et constats. |
| Reprise après observation | Examiner indexation, impressions, clics et actions utiles lorsque les données existent. | Comparaison datée et propositions dans le plan actuel. |

Pour un nouveau site, tu peux écrire :

```text
$project-start
Ce site doit attirer des visiteurs depuis la recherche. Reprends mon dossier PA et AD.
Définis les pages et critères SEO utiles, puis prévois les contrôles sur le site publié
et le suivi après une période d’observation. Signale les données manquantes.
```

Pour une refonte, ajoute :

```text
Le domaine ou certaines URL vont changer. Préserve les contenus utiles et prépare
la correspondance des anciennes URL vers les destinations pertinentes. Vérifie les
redirections et les versions linguistiques, sans inventer de baseline de trafic.
```

Après publication :

```text
$project-ship
Voici le domaine et les résultats du déploiement. Vérifie les critères applicables
sur les pages publiées et indique ce qui reste inconnu faute d’accès.
```

Pour le bilan :

```text
$project-start
Voici mes exports Search Console et les observations disponibles. Compare les périodes
et pages pertinentes, puis propose les améliorations prioritaires sans les réaliser immédiatement.
```

Tu peux demander les mêmes objectifs à un workspace 0.22 par une consigne explicite ; cela ne le transforme pas en 0.23 et ne met pas à jour ses fichiers. La nouvelle archive sert aux nouvelles installations. Une reprise de ton historique existant demande une mise à niveau spécifique : ne remplace pas son runtime ou ses skills à la main.

Aucune hausse de trafic n’est exigée pour accepter une réalisation techniquement conforme. Une page publiée peut ne pas encore être indexée ; une page indexée peut attirer peu de visiteurs. Un score Lighthouse ne démontre pas le classement. L’agent distingue ces états et ne prétend pas avoir consulté Search Console si tu n’as fourni ni accès autorisé ni export.

Le point de suivi doit avoir un responsable et une condition de reprise. Le prévoir dans le plan ne crée pas de rappel automatique, n’installe pas de traceur et n’autorise pas une publication.

## 17. Art Director et les prototypes

Dans le skill personnel AD mis à jour, les maquettes d’interface et prototypes sont dirigés par défaut vers Claude Design. AD prépare les règles, contenus et ressources utiles, puis examine le résultat réel et regroupe les corrections. Si l’atelier n’est pas relié, il te remet un transfert prêt à utiliser ; il ne prétend pas avoir exécuté la fabrication. Une demande explicite de réalisation ici prévaut. Les affiches, logos et créations autonomes conservent leur atelier choisi.

AD peut également accompagner le naming et l’identité verbale/visuelle, la charte et les spécifications d’un design system. Le starter réalise et vérifie les composants de production. Le skill personnel AD et le starter restent deux éléments distincts ; l’archive n’installe pas PA/AD dans ton compte.

---

Guide fondé sur la distribution 0.23.0 livrée : DEMARRER.md, README.md, notes de version, contrats du workflow et de son CLI, profils, skills embarqués et conditions d’import du package produit. Les validations de la distribution ne remplacent pas les essais dans ton environnement réel ni ceux de ton produit.
