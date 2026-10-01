# SEO — réalisation, publication et suivi

Référence conditionnelle du workflow v3. Dans un workspace installé, ce fichier est accessible à
`.starter/runtime/core/contracts/search-visibility.md`. Lire la section utile au travail courant.
Ce guide oriente l'agent ; il n'ajoute ni scanner automatique, ni garantie de référencement au moteur.

## Applicabilité et source unique

Identifier les pages publiques dont la découverte par recherche compte, ou dont la modification
affecte des acquis. Reprendre les décisions PA et la carte des contenus : pages/URL, intentions,
langues, informations réelles, visibilité souhaitée et action utile. À défaut de PA, Discover
complète seulement les manques qui influencent l'exécution. Un dashboard privé, une API seule ou
une retouche indépendante n'impose pas un audit SEO. Distinguer besoin absent et besoin inconnu.

Référencer les exigences dans PROJECT_BRIEF ou leur source produit existante ; ne pas créer de
backlog SEO parallèle ni de document supplémentaire obligatoire. Épingler les fichiers locaux
utiles à la phase avec le mécanisme sources existant. Un changement de périmètre passe par Plan.
Ne pas modifier le contrat d'import PA v1. Aucun besoin d'installer un plugin SEO ou de changer
de framework par défaut ; examiner les capacités de la stack et du CMS déjà présents.

## Setup et Plan — préparer les vérifications

Déterminer contenu accessible, rendu serveur/client, URL de référence, environnements et commandes
réelles. Pour chaque famille de pages concernée, définir un résultat attendu et une vérification
proportionnée : méthode, URL/environnement, preuve à rapporter et limites. Un contrôle partagé
peut couvrir un modèle de page, mais ne prouve pas chaque contenu particulier.

Séparer réalisation avant publication, contrôle sur la cible publiée et observation ultérieure.
Inscrire les travaux de suivi dans le même plan, avec responsable et condition de reprise lorsque
les données existent. Ne pas conditionner l'acceptation technique à une hausse de trafic future.
Ne pas exécuter un déploiement, créer une automatisation ou installer un traceur au seul motif
qu'un point de suivi est prévu. Respecter les exigences de collecte transmises par PA.

## Phase et Review — contrôles applicables

| Besoin | Contrôle et preuve utiles |
|---|---|
| Contenu découvrable | Examiner réponse HTTP et contenu rendu des URL publiques représentatives, texte important, ressources nécessaires et liens HTML vers les pages utiles. Une source locale seule ne démontre pas le rendu accessible en production. |
| Présentation | Vérifier titres de pages descriptifs, descriptions adaptées, structure des titres, libellés de liens et alternatives d'images selon leur rôle. Ne pas imposer de densité de mots-clés, longueur universelle ou score magique. |
| Exploration et indexation | Vérifier statut HTTP attendu, robots.txt, meta robots et X-Robots-Tag, URL canoniques cohérentes et éventuel sitemap limité aux URL pertinentes. Un robots.txt bloquant l'exploration ne garantit pas la désindexation ; noindex exige que le moteur puisse le lire. |
| Accès privé et préproduction | Préserver authentification et contrôle d'accès ; noindex et robots.txt ne sécurisent pas des données privées. Ne lever les restrictions que pour les pages et la cible publique prévues. |
| Langues | Pour les versions destinées à être découvertes, examiner URL distinctes, liens de changement de langue, contenu réellement traduit et annotations hreflang réciproques appropriées, cohérentes avec les canonical. Ne pas canonicaliser toutes les traductions vers une seule langue par habitude. |
| Données structurées | Ajouter seulement les types pertinents, conformes aux informations réelles et visibles. Contrôler syntaxe et éligibilité selon la documentation actuelle ; ne pas inventer avis, note, prix ou adresse. Une validation ne garantit pas un résultat enrichi. |
| Performance et usage | Mesurer les pages et parcours mobiles pertinents avec outils disponibles ; indiquer conditions et limites. Distinguer mesures de laboratoire et données terrain. Un score Lighthouse ne prouve ni classement ni accessibilité complète. |
| Activité locale | Vérifier cohérence des informations validées : nom, prestations, coordonnées et zone pertinente. Signaler les accès externes nécessaires sans modifier une fiche d'établissement sans mandat. |

Exécuter les contrôles locaux utiles avec workflow check dans la phase autorisée. Conserver les
preuves actuelles et les findings du reviewer. Pour un test externe ou manuel, préciser URL,
date, méthode, résultat et limites dans le rapport approprié ; ne pas transformer une inspection
en ligne inaccessible en résultat positif. Un test automatique réussi ne remplace pas une observation
humaine requise. Regrouper les contrôles par risque plutôt que refaire l'audit complet à chaque retouche.

## Refonte ou migration de domaine/URL

Avant modification, inventorier les URL utiles et les données accessibles d'indexation, de clics
et de liens ; conserver leur provenance et date. Signaler les métriques inconnues. Préparer une
correspondance des anciennes URL vers les destinations réellement pertinentes, avec décision
explicite pour les pages retirées. Préserver les URL stables lorsque leur changement n'est pas utile.

Vérifier les redirections permanentes appropriées (301/308), les destinations finales et l'absence
de boucle ; éviter les chaînes et la redirection générale vers l'accueil. Contrôler liens internes,
canonical, sitemap, langues et ressources après changement. Préparer les actions Search Console
applicables à la migration selon sa documentation actuelle ; ne pas déclarer une propriété vérifiée
ou un changement d'adresse soumis sans accès ni observation réelle. Conserver un retour arrière
réaliste et les accès nécessaires aux anciennes destinations selon le plan de migration.

## Ship — publication et contrôle externe

Un commit seul ne déclenche pas ce parcours. Pour la publication demandée, préparer la cible,
la révision, les paramètres d'environnement, les contrôles après mise en ligne et le retour arrière.
Les opérations Git/publication restent manuelles selon le contrat commun.

Après l'exécution réelle, examiner sur le domaine publié les URL représentatives et les exceptions
critiques : contenu, statuts, restrictions d'indexation résiduelles, canonical pointant en production,
sitemap s'il existe, redirections et langues. Consigner la cible, la date, la version connue et les
limites dans le rapport de livraison existant. Un contrôle local ou un simple HTTP 200 ne démontre
pas à lui seul le bon référencement du site en ligne.

Préparer ou utiliser Search Console lorsque l'accès est autorisé ; sinon demander le seul export
ou résultat nécessaire. Distinguer publiable, publié, techniquement accessible, indexé et performant.
Une demande d'indexation n'est pas une indexation observée. Un défaut corrigeable retourne au plan
ou à la phase affectée ; il ne permet pas de modifier silencieusement une phase acceptée.

## Suivi — reprendre à partir des données

Définir avec les décisions produit le responsable et le moment de revue : vérification au lancement,
puis période d'observation adaptée avant comparaison, souvent de plusieurs semaines. Ce n'est
pas un délai garanti. Aucun rendez-vous, rappel ou accès n'est créé implicitement.

Examiner pages indexées, erreurs pertinentes, impressions, clics et taux de clic par page/requête
avec Search Console ou exports réels. Séparer si utile marque/hors marque, pays et langues.
Relier aux contacts ou réservations uniquement si ces données existent et leur collecte est autorisée.
Conserver période, source, limites et contexte de comparaison (saisonnalité, migration, campagne).
Ne pas confondre corrélation et causalité, position moyenne et rang fixe, ou trafic et valeur produit.
Sans données, préparer les observations attendues et signaler l'attente sans inventer un succès.

Proposer les améliorations selon les écarts constatés dans le plan actuel. Éviter création massive
de pages, faux avis, liens artificiels ou modifications continuelles sans hypothèse vérifiable.
Les contenus périmés et les informations métier ont aussi besoin d'un responsable de mise à jour.

## Sources officielles

Références vérifiées le 1er octobre 2026. Consulter les pages actuelles avant une recommandation
spécifique dépendant d'un moteur ; ne pas relancer la recherche complète pour un contrôle inchangé.

- [Fondamentaux](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start)
- [Migration](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- [Langues et régions](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
- [robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Données structurées](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Visibilité locale](https://support.google.com/business/answer/7091)
- [Fonctionnalités IA](https://developers.google.com/search/docs/appearance/ai-features) : pas de fichier ou schéma IA obligatoire pour ces fonctionnalités Google, ni garantie de citation.
