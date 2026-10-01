# Ce que permet le starter

Tu gardes la même façon de piloter un site, une webapp, une application, un logiciel ou un jeu.
Les spécialistes et les contrôles s’adaptent au produit. Le starter n’est pas un générateur qui
fournit automatiquement tous les frameworks et outils nécessaires à chaque plateforme.

Project Architect prépare le besoin, les parcours, le périmètre et les décisions. Art Director
approfondit l’identité visuelle et les critères artistiques. Claude Design sert à réaliser les
documents, maquettes, prototypes et animations que tu choisis. Ces outils travaillent en amont :
le starter reçoit leurs sources et décisions, puis organise l’implémentation. Il ne lance pas
automatiquement Claude Design et n’atteste pas d’une intégration native avec lui.

| Skill | Son résultat pour toi |
|---|---|
| project-start | Retrouver l’état réel et le travail autorisé, puis guider la préparation manquante. |
| project-discover | Compléter les lacunes et contradictions sans recommencer le cadrage suffisant. |
| project-handoff | Traduire les sources et décisions dans le brief prêt pour la réalisation. |
| project-setup | Préparer le socle technique minimal et les spécialistes adaptés au projet. |
| project-plan | Construire un backlog de phases testables et de taille raisonnable, avec une fonction Product Owner. |
| project-next | Recommander la prochaine phase, son objectif et l’agent utile. |
| project-phase | Réaliser, tester et corriger la phase choisie dans son mandat persistant. |
| project-review | Faire une revue distincte, traiter les défauts et préparer l’acceptation du résultat. |
| project-ship | Préparer les commandes de commit et de livraison manuels, puis vérifier les faits accessibles. |

Tu n’as pas à lancer les neuf skills à chaque séance. Start peut réutiliser les capacités de
préparation nécessaires déjà autorisées. Au quotidien, le parcours reste Start → Next → Phase →
Review, puis acceptation et Ship au moment choisi. Une autorisation reçue ne disparaît pas après
chaque tâche interne ou un changement de session.

Tu peux demander « ajoute cette fonctionnalité », « le clic ne fonctionne pas », « où en sommes-nous ? »
ou « pause ». L’agent tient le backlog à jour. Il revient vers toi lorsqu’un choix produit, une
extension de périmètre ou un essai réel le nécessite. Tu ne coches pas manuellement un état technique.

Le moteur conserve un état structuré unique, un backlog lisible généré, des rapports et un historique.
Les preuves sont reliées au code et au contrat vérifiés. Une nouvelle modification peut les rendre
périmées. Un essai humain ne peut pas être remplacé par un test automatisé. Doctor détecte les
incohérences qu’il sait contrôler ; il ne prouve pas à lui seul que le produit répond au besoin.
Le code applicatif et le workspace privé sont séparés. Le workspace doit aussi être sauvegardé.

Les adaptateurs Codex et Claude Code rendent les instructions et rôles disponibles dans leurs formats.
Les affectations de modèles sont configurables ; un fichier ne prouve pas leur disponibilité et un
skill ne change pas magiquement le modèle de la conversation principale. Les profils fournis sont
Générique, API Node, Next.js, SwiftUI et WordPress. Les autres technologies demandent une configuration
et des vérifications adaptées. L’historique v2 et l’ancien pilote Python disposent de migrations
explicites ; cela ne constitue pas une mise à jour automatique de chaque runtime installé.

La version 0.21 ajoute une lecture compacte des rapports et contextes : tes gestes restent identiques.
Elle conserve les originaux et leurs vérifications, ne supprime aucune étape d’acceptation et ne
facture aucun appel à un modèle de résumé. Elle ne garantit ni un pourcentage d’économie de tokens,
ni un fonctionnement autonome de tous les outils externes.

La 0.22 corrige la synchronisation des skills, étend la sortie compacte à Doctor et permet
d'épingler les références PA/AD d'une phase. Si une référence change, l'agent examine l'écart avant
de réutiliser une validation. Les modèles proposés pour une nouvelle installation sont configurables ;
la délégation reste proportionnée au travail. Voir [les changements 0.22](RELEASE-0.22.0.md).
