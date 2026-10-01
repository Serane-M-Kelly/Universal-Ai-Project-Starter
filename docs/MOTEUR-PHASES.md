# Référence du moteur de phases

Depuis ai-workspace : `node .starter/run.mjs workflow ACTION`. La sortie est JSON pour
le coordinateur, qui la traduit en langage courant. `doctor . --json` conserve les diagnostics
historiques de chemins, profils, secrets, imports et sources de skills et contrôle le suivi v3.
Un verdict de cohérence ne prouve ni disponibilité d’un modèle ni correction du produit.

## Autorité des fichiers

- project.yaml : chemins, profil, commandes et références d’installation.
- PROJECT_BRIEF.md : résultat et limites du produit ; son empreinte approuvée vit dans le suivi.
- .starter/workflow.json : plan et faits d’exécution canoniques, schéma v3.
- BACKLOG.md : projection générée, aucune édition manuelle attendue.
- .starter/models.json : modèles, efforts et rôles configurés.
- reports : sorties réellement exécutées, revues et observations.
- .starter/history : snapshots et copies avant réparation, pas un registre infalsifiable.
- .starter/legacy-source : ancienne source archivée, jamais un second workflow actif.
- PROJECT_STATE.md : point d’entrée vers la commande status, pas un avancement à maintenir.

## Commandes

Les options peuvent suivre l’action ; --workspace permet d’exécuter depuis une autre localisation.
--by et --request exigent l’attribution et les mots réels, sans fournir d’authentification.

Consulter [la liste des commandes](../core/contracts/workflow-cli.md), également disponible
avec `node .starter/run.mjs workflow --help`.
## Plan fourni par l’agent

Tableau JSON de phases : title, goal, validation, excludes, depends_on, optional, agent,
tasks. Les tâches portent title et human. Omettre id pour un nouvel élément ; conserver
ceux du moteur pour les existants. Les dépendances peuvent désigner une identité ou un
titre de phase unique dans la même proposition. Les titres ambigus sont refusés.
Une modification pure de titre conserve les validations ; modifier un objectif, critère,
exclusion, dépendance ou tâche affecte le contrat. L’agent doit classer correctement la demande,
le moteur ne comprend pas les intentions sémantiques. Une évolution qui affecte l’actif exige
--allow-active-change avec la décision correspondante. Un ajout futur indépendant ne l’interrompt pas.
Chaque réouverture incrémente une génération interne afin que des preuves anciennes ne
redeviennent pas valides simplement parce que les textes sont identiques.

## Preuves

SHA-256 du contrat et des fichiers source, sans .git, node_modules, sorties/cache documentés.
Toute modification source périme les preuves actives. Les contrôles sont exécutés sans shell,
avec délai et taille de sortie limités ; un contrôle qui modifie la source n’établit pas une tâche.
Les rapports enregistrent aussi Node, système, architecture, répertoire et durée ; les versions
d’outils propres au produit restent à relever dans les contrôles pertinents.
Les commandes restent du code capable d’effets de bord et héritent des permissions : le coordinateur
doit examiner leur pertinence et autorisation. Les contrôles de profils ne sont pas exécutés
aveuglément. Un dernier échec sur une tâche retire sa démonstration dans la révision courante.

Le reviewer retourne un JSON avec code_hash, contract_hash, summary, findings et checks.
Les deux empreintes doivent correspondre au context fourni et à la révision encore présente.
Le moteur enregistre --independent ; il ne peut pas prouver l’identité ou l’indépendance réelle.
Les essais humains ne sont jamais remplacés par un test automatique. L’agent peut transmettre
un verdict d’observation négatif puis bloquer/corriger, au lieu d’enregistrer une réussite fictive.

Une phase acceptée est un jalon historique. Ses tests de régression pertinents doivent être
réexécutés pendant les évolutions et avant livraison. Pour préparer un commit, une revue sur
la révision exacte actuelle est exigée, même si la phase a été acceptée antérieurement.

## Reprise et personnalisation

Les mutations du suivi emploient un verrou, des snapshots et le remplacement atomique du JSON.
La vue est écrite après l’état : une coupure peut laisser une vue périmée, réparée par repair-view.
Ce n’est pas une transaction sur tous les fichiers, et les éditeurs externes ne partagent pas le verrou.
Une erreur après un contrôle peut laisser un rapport orphelin, jamais une réussite inventée.
Ne pas supprimer l’état pour résoudre une erreur. restore-state archive le fichier actuel,
valide le snapshot et révoque mandats/acceptations : les résultats doivent être réexaminés.
Le verrou est local au processus ; ne pas utiliser ce stockage pour une écriture multi-machine.

Si models-sync détecte une personnalisation, examiner les différences et les reporter dans
la configuration canonique ou conserver l’ancien fichier avant toute substitution explicite.
Ne pas modifier les empreintes du registre pour forcer l’acceptation d’un fichier.
Pour une future mise à jour incompatible du moteur, conserver l’espace actuel et utiliser une
procédure de migration propre à cette version. Le migrateur v0.20 couvre le pilote v0.1 et le
backlog historique v2 ; il ne prétend pas convertir un schéma futur ou fusionner arbitrairement
les personnalisations. La distribution et les sources permettent une maintenance versionnée.
