# Version 0.23.0 — SEO proportionné au projet

## Changements

- Une référence conditionnelle commune couvre préparation, réalisation, revue, publication et suivi SEO.
- Discover reprend le cadrage PA ou complète les lacunes ; Handoff vérifie les critères transmis.
- Setup examine les possibilités de la stack avant d'ajouter des outils ; Plan rattache les critères aux phases.
- Phase et Review distinguent rendu local, preuves techniques et observations sur le site publié.
- Ship contrôle la cible après publication réelle ; Start reprend les données de suivi lorsqu'elles existent.
- Les refontes prennent en compte anciennes URL, domaines, langues et contenus utiles.
- Un produit privé ou une retouche indépendante n'impose aucun audit SEO.

Le nombre de skills actifs reste neuf. Aucun schéma, commande SEO ou statut du moteur n'est ajouté.
Les critères restent dans le brief et le plan existants, les preuves dans leurs rapports habituels.
La référence se trouve dans `core/contracts/search-visibility.md` et dans le runtime installé à
`.starter/runtime/core/contracts/search-visibility.md`. Seules les sections pertinentes sont à lire.

Les skills personnels PA et AD sont mis à jour séparément dans le compte de Kelly : PA cadre les
contenus et l'acquisition ; AD préserve leur présentation. Ils ne sont pas installés par cette archive.

## Limites et installations existantes

Ce sont des consignes de travail, pas un scanner automatique, une certification SEO ou une garantie
de classement. Un test local, un HTTP 200 ou un score Lighthouse ne prouve pas l'indexation. Les
contrôles externes exigent leurs accès ; une mesure absente reste inconnue. Aucun abonnement,
service, traceur, rappel ou compte Search Console n'est créé automatiquement.

Les nouveaux workspaces reçoivent cette version complète. Les skills modifiés exigent le runtime
0.23.0 pour le workflow v3 afin de ne pas pointer vers une référence absente d'un ancien runtime.
La nouvelle distribution ne met pas à jour les workspaces 0.20/0.21/0.22. Ne pas remplacer leurs
seuls skills ou runtime ; aucune migration sur place v3 n'est livrée. Conserver le suivi existant
et préparer une mise à niveau spécifique si l'historique doit être repris. La migration legacy reste
réservée aux formats historiques déjà pris en charge.

Les procédures legacy des skills partagés restent distinctes ; le parcours SEO intégré documenté
ici concerne le workflow v3. Le contrat d'import PA v1 à dix documents reste inchangé.

## Utilisation

Voir [le parcours SEO](SEO-WORKFLOW.md), [le guide complet](GUIDE-COMPLET-KELLY.md) et
[les validations effectuées](VALIDATION.md). Git et publication restent manuels dans le workflow
de Kelly. Les observations futures sont prévues dans le plan ; elles ne sont pas exécutées par avance.
