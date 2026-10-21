# Commandes du workflow

Depuis ai-workspace : node .starter/run.mjs workflow ACTION.
Pour les détails : workflow --help. --workspace permet de choisir un autre workspace.
Les options --by et --request décrivent des déclarations réellement reçues : elles ne
prouvent ni l'identité humaine ni le consentement à une étape non demandée. Lire
`.starter/runtime/core/contracts/action-authority.md` avant les transitions.
`--independent` déclare une revue faite en contexte distinct, sans authentifier la délégation.

| Action | Paramètres / effet |
|---|---|
| sources | Empreintes du brief, des règles et des références de la phase active. --path CHEMIN répétable : empreintes de fichiers locaux à épingler dans le plan, sans approbation ni lecture de leur contenu à la place de l'agent. |
| report ID | Rapport enregistré vérifié ; vue compacte si utile, --raw pour l’original. --stream stdout/stderr/original, --offset et --limit pour les extraits. --metrics pour les octets. |
| status, next | État et recommandation, aucune phase lancée. --compact [--metrics] disponible. |
| context N | Contrat, preuves, empreintes et chemins nécessaires à la phase. --compact [--metrics] omet les preuves historiques si utile. |
| plan | --file tableau.json --by --request ; identités existantes préservées, nouvelles allouées. |
| brief-approve | --by --request ; enregistre l’approbation réelle du brief courant. |
| setup-record | --report fichier --by --request ; archive le rapport de socle vérifié. |
| begin N | --by --request ; mandat réutilisé, une phase active, dépendances acceptées. |
| task-add N | --summary --reason --by --request ; ajout technique à résultat inchangé. |
| check N | --task ID (répétable) --by --request --timeout MS -- programme arguments. |
| observe N | --task ID --summary --by --request ; observation réellement reçue. |
| review N | --report JSON --verdict passed/changes_required/blocked --independent --by --request. |
| carry N | --proof ID_OBSERVATION [--task ID] --dry-run : diff calculé et classement, sans écriture. Puis --path (chaque chemin changé) --criteria --reason --checks --limits --by --request : conserve l'essai humain si seuls des documents non consommés ont changé. Ne crée ni observation ni revue. |
| readme-check | [--path README.md] [--previous FICHIER \| --previous-ref REF] [--code-root CHEMIN] ; signaux consultatifs en lecture seule sur le README du produit, code de sortie 0. |
| accept N | --by --request ; preuves et revue indépendantes actuelles requises. |
| reopen N | --by --request ; réouverture de la phase et de ses dépendantes. |
| block/unblock N | --reason --by --request ; obstacle/condition puis résolution constatée. |
| prepare-commit N | --path relatif (répétable) --message ; prépare les commandes sans Git en écriture. |
| verify-commit | Observe le commit manuel et le compare à la préparation. |
| environment | Versions Node, codex et claude trouvées, assistants installés, configuration et variables d’environnement qui remplacent les modèles Claude ; pas de test d’accès au serveur. |
| models-sync | Génère les fichiers natifs de chaque assistant listé dans `adapters`, préserve les personnalisations inconnues. |
| adapter-add ID | `codex` ou `claude-code` [--dry-run] ; ajoute ou répare un assistant : réglages, agents, copies des skills et fichier d’instructions absents. Refuse sans rien écrire si une copie ou un réglage a été personnalisé. À lancer dans un Terminal, assistant fermé. |
| relocate | --code-root --by --request ; archive les anciens chemins et régénère les chemins natifs. |
| repair-view | --by --request ; archive la vue modifiée puis la reconstruit, sans changer le plan. |
| recover-lock | --by --request ; uniquement si le processus propriétaire n’existe plus. |
| restore-state | --snapshot .starter/history/fichier.json --by --request ; valide puis restaure. |
| migrate | --source ancien-workspace --target nouveau-dossier [--dry-run]. |
| runtime-upgrade | Depuis la nouvelle distribution, assistants fermés : --workspace CHEMIN --dry-run (fichiers touchés, préservés, personnalisations, incompatibilités, empreinte du plan), puis --plan EMPREINTE --by --request. --finish termine une migration vérifiée dont le nettoyage final a échoué. Sauvegarde vérifiée ; comportement identique exigé par défaut. --accept-proof-invalidation tolère seulement la péremption des preuves, sans les requalifier ni modifier workflow.json ; tout autre changement bloque. Attention : les anciens runtimes peuvent lire les secrets pendant status/context ; refuser cette migration si l'accès aux secrets est interdit. Annulation automatique en cas d'échec. Ne modifie jamais workflow.json ni l'historique. |
| runtime-rollback | --workspace CHEMIN [--dry-run] --by --request ; restaure une migration interrompue ou annule la dernière migration. Bloqué si le suivi a changé depuis, sauf --accept-state-changes avec un état lisible par le runtime précédent. |


Exemple : workflow check 1 --task t-2 --by builder --request "Vérifier la phase autorisée" -- node --test
Après --, les arguments sont ceux du programme de vérification. Aucun shell implicite.

Une phase peut inclure `sources: [{"path":"design/INDEX.md","sha256":"empreinte de 64 caractères"}]`.
Les chemins sont relatifs au workspace. Épingler également les fichiers utiles référencés par l'index.
Une modification exige un examen et une révision autorisée du plan ; omission conserve les sources
existantes, [] demande leur retrait. Les références externes nécessitent un export/version explicite.
Hors workflow : `node .starter/run.mjs doctor . --json --compact` conserve tous les contrôles,
avertissements, blocages et codes de sortie ; omettre --compact pour les diagnostics positifs détaillés.
