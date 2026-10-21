# Architecture, données et sécurité — conception et preuves conditionnelles

Référence conditionnelle du workflow v3, accessible dans un workspace installé à
`.starter/runtime/core/contracts/architecture-data-security.md`. Lire uniquement les sections
utiles à la tâche. Ce contrat guide les agents ; il n'ajoute ni scanner de sécurité, ni approbation
automatique, ni garantie de conformité ou d'absence de vulnérabilités au moteur.

## Applicabilité et proportion

Tout projet conserve les bases pertinentes : examiner dépendances et secrets réellement présents,
protéger les accès et données existants, ne pas exposer de ressources privées lors d'une publication.
Approfondir seulement lorsque le produit ou le changement le justifie :
- Architecture : composants multiples, intégrations, synchronisation, état partagé, forte contrainte
  de disponibilité/performance, migration ou choix technique durable.
- Données : persistance, données personnelles, réservations, comptes, opérations monétaires,
  synchronisation concurrente, séparation par client/organisation ou migration de schéma.
- Sécurité : authentification/autorisation, espace admin, API publique, import de fichiers,
  secrets, prestataires, données privées, paiement ou effet important d'une compromission.
- Confidentialité et exploitation : traitements de données, conservation, sauvegardes,
  restauration, suppression, transfert ou dépendance à un tiers critique.

Noter « applicable », « non applicable avec raison » ou « à déterminer » pour les risques qui
affectent le résultat. Une simple page statique sans collecte ni persistance n'impose ni base de
données, ni diagramme d'architecture exhaustif, ni dossier de menaces. « Non vérifié » n'est pas
« non applicable ». Ajuster l'analyse à la modification réelle d'un produit existant.

## Sources et responsabilités

PA conserve les choix et obligations produit (finalités, territoires, parcours, critères, sources
et incertitudes). Discover/Handoff reprennent ces sources sans modifier le package PA v1 ni son
manifeste. Setup choisit une architecture technique et les protections réalisables ; Plan relie
leurs critères aux phases existantes ; Phase implémente et vérifie ; Review conteste les preuves ;
Ship vérifie les risques pertinents à la cible. Aucun backlog ou registre de conformité parallèle.

Conserver une source de vérité technique dans les documents existants du projet. Pour une application
non triviale, ou lorsqu'un dossier technique est demandé, produire ou actualiser une conception
consultable (par exemple `docs/architecture.md` si ce chemin convient au dépôt), et la référencer
depuis les critères existants. Ne pas créer de dossier systématique, de schéma fictif ni de seconde
autorité décisionnelle. Épingler les sources locales pertinentes par `workflow sources` puis
`sources: [{path, sha256}]` dans les phases affectées ; ne pas épingler un document non pertinent.

## Setup — décisions d'architecture

Partir des parcours, contraintes métier et code réels. Pour les changements significatifs,
décrire à la profondeur utile :
- Composants et responsabilités, dépendances, interfaces et contrats d'API, frontières de
  confiance, chemins des données, identité de l'appelant et points d'autorisation.
- Environnements, hébergement, configuration, secrets, dépendances externes, modes de panne,
  observabilité, reprise et sauvegarde pertinentes ; capacité/performance si elles comptent.
- Alternatives raisonnables, compromis, hypothèses, décisions ouvertes et déclencheurs de
  révision. Préserver les choix déjà adoptés tant qu'aucun fait ne justifie une migration.

Une conception est exploitable si la phase suivante sait quoi implémenter, avec quels invariants,
comment vérifier les cas critiques et quelles inconnues empêchent une décision sûre. Un diagramme
seul ou une liste de technologies ne suffit pas. Si les risques sont élevés et les décisions
fondamentales manquent, expliciter le blocage ciblé avant d'implémenter le chemin concerné ; faire
avancer le reste du travail autorisé.

## Setup — données et intégrité

Lorsqu'une persistance est applicable, décrire les entités/collections et leurs finalités,
attributs et types, identifiants, relations et cardinalités, contraintes métier, états et transitions,
propriété des données, lecture/écriture autorisées et cycle de vie. Préciser selon la technologie :
- SQL : clés, références, unicité, nullabilité, contraintes, transactions/isolement, index motivés,
  migrations et stratégie de retour arrière ; éviter un DDL arbitraire sans moteur choisi.
- Document/NoSQL : structure, duplication voulue, règles d'accès, requêtes/index, limites des
  écritures atomiques, transactions ou mécanismes équivalents ; ne pas simuler des clés étrangères.
- Toute persistance : cohérence et concurrence (ex. double réservation), idempotence des opérations
  sensibles, traçabilité adaptée, durée de conservation, suppression, export, sauvegarde et
  restauration lorsque nécessaires.

Fournir un schéma logique/physique, contrats, migrations ou exemples de requêtes **si leur détail
est nécessaire à la réalisation ou demandé**. Ne pas inventer une base pour un site purement statique.
Signaler explicitement les garanties qui dépendent du service choisi ou d'essais réels.

## Setup — menaces, confidentialité et contrôles

Pour les surfaces pertinentes, relier actif ou donnée, acteur/accès, scénario d'abus plausible,
impact, protection, moyen de vérification, responsable et risque résiduel. Prioriser selon le
contexte plutôt que réciter une checklist universelle. Examiner notamment, lorsqu'applicable :
- Autorisation côté serveur et séparation des rôles/tenants, authentification, gestion de session,
  règles de sécurité base de données (RLS, règles Firestore ou équivalents), accès administrateur.
- Validation des entrées et sorties, injection, XSS/CSRF selon architecture, fichiers importés,
  abus/rate limiting, erreurs sans fuite de données, secrets hors dépôt et journaux.
- Intégrité métier et concurrence, dépendances, configuration des environnements, sauvegardes,
  récupération, traitement des incidents et droits des prestataires.
- Minimisation, permissions, collecte et transmission des données, suppression/conservation et
  traceurs, seulement selon les exigences applicables établies par PA ou les faits du produit.

Séparer protection conçue, implémentée, testée localement et vérifiée sur la cible. Aucune
documentation ne prouve l'efficacité d'un contrôle. Les choix réglementaires non tranchés restent
« à vérifier » avec leur impact ; ne pas présenter un contrôle technique comme avis juridique.

## Plan, Phase et Review — preuves liées aux risques

Plan traduit les décisions pertinentes en critères observables et tâches dans les **phases
existantes**. Préciser pour chaque risque significatif : résultat attendu, test ou inspection,
environnement et preuve, et limite de couverture. Les nouvelles exigences hors mandat passent par
Plan et l'arbitrage normal, jamais par un faux `task-add`.

Avant de promettre ou d'accepter un invariant (isolation, intégrité, conservation ou contrôle
d'accès), identifier ses prérequis et les données **déjà présentes**, y compris les lignes
historiques, ambiguës ou non encore rattachées, ainsi que les écritures concurrentes. Si leur
mapping, leur migration ou leur réconciliation conditionne l'invariant, intégrer ces travaux
et leurs preuves dans la phase qui le revendique ou dans une phase préalable vérifiée. Sinon,
limiter explicitement le résultat à une fondation préparatoire, sans annoncer l'invariant
complet comme acquis. Une phase ne valide pas seulement les nouveaux enregistrements en
oubliant les anciens ; si le rattachement reste inconnu, signaler la dépendance et différer
l'acceptation correspondante.

Raccorder chaque risque critique aux critères du plan réellement en vigueur, à une preuve
située (révision, environnement, méthode, résultat et limites) et à la revue distincte requise
par le runtime applicable. Distinguer étape proposée, mandat obtenu, preuve exécutée, revue
rendue et acceptation humaine ; ne jamais annoncer une porte satisfaite par une intention.

Phase réalise les protections adaptées à la stack ; utiliser `workflow check` et les observations
réelles pour les tests pertinents (ex. refus d'un accès non autorisé, isolation de comptes,
collision de créneaux, validation d'entrée, migrations, restauration si applicable). Tester les
échecs et interdictions, pas seulement le scénario heureux. Ne pas utiliser de données privées
réelles ou secrets de production dans les preuves. Une réussite locale ne démontre pas un contrôle
sur l'environnement publié.

Review examine dans un contexte distinct les invariants, permissions, changements de schéma,
effets des dépendances et limites des tests proportionnés au périmètre, à partir du diff et des
preuves réelles. Ne pas déduire une couverture de sécurité du nombre de tests ou de la présence
d'un document. Un défaut critique non corrigé ou un contrôle critique sans preuve ne reçoit pas
un verdict « passed » pour le comportement concerné ; signaler précisément le blocage et les
corrections nécessaires. Une question ou suggestion non bloquante reste distincte.

## Ship — vérification de la cible et des risques résiduels

Pour une publication ou une migration affectée, inventorier version acceptée, environnement,
secrets/configuration sans les exposer, droits, dépendances, données, opérations de migration,
sauvegardes et possibilité réelle de retour arrière. Préparer des contrôles post-publication
adaptés aux chemins critiques et aux restrictions d'accès ; constater uniquement ce qui est
accessible après exécution autorisée. Une migration irréversible nécessite une stratégie de
récupération et un arbitrage explicite du risque avant son exécution.

Ne pas bloquer un simple commit sur un audit de déploiement. Ne pas annoncer « sécurisé »,
« conforme RGPD », « migration réussie » ou « restaurable » sans preuve correspondant à cette
affirmation et à la cible. Consigner limites, responsables et risques résiduels dans le rapport
de livraison existant. Ne pas exécuter Git, publication ou migration par défaut.

## Cas témoins pour les revues ciblées

- Landing publique statique : pas de schéma de base de données inventé ni de dossier technique
  lourd ; protections de publication existantes préservées.
- Réservation avec compte admin : contraintes de disponibilité/concurrence, permissions, parcours
  d'erreur et gestion des données personnelles couverts par critères et preuves.
- Application multi-tenant : absence de lecture/écriture intertenant, migrations, droits, secrets,
  stockage et récupération examinés selon le risque.
- Refonte avec données existantes : compatibilité, migration réversible ou risque arbitré, preuves
  sur versions source/cible, pas de réécriture automatique des décisions adoptées.
