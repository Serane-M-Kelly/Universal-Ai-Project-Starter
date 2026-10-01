# Instructions Codex — {{PROJECT_NAME}}

## Périmètre

Tu travailles depuis le workspace privé de pilotage.

- Code du produit : `{{CODE_ROOT_RELATIVE}}`
- Racine du dépôt Git : `{{REPOSITORY_ROOT_RELATIVE}}`
- Configuration mécanique : `project.yaml`
- Contrat produit : `PROJECT_BRIEF.md`
- État opérationnel : `PROJECT_STATE.md`
- Décisions : `docs/decisions.md`

## Démarrage d'une tâche

1. Lire `project.yaml`.
2. Vérifier le statut et la version de `PROJECT_BRIEF.md`.
3. Lire `PROJECT_STATE.md`.
4. Consulter seulement les décisions, tâches et preuves utiles à la demande.
5. Vérifier l'état réel du code et de Git avant de proposer ou d'effectuer une modification.

Si le brief est encore en brouillon, limiter le travail à la découverte, au cadrage, au diagnostic d'adoption ou à une mission de maintenance explicitement autorisée. Ne pas lancer silencieusement la réalisation du produit.

## Sources de vérité

- Le brief approuvé possède l'autorité sur le problème, la cible, le périmètre et les critères d'acceptation.
- `project.yaml` possède l'autorité sur les chemins, le profil, les adaptateurs, les commandes et la gouvernance.
- Le code, Git et les contrôles exécutés constituent les preuves techniques.
- `PROJECT_STATE.md` résume l'état observé, mais ne remplace jamais une preuve.
- Signaler toute contradiction au lieu de réécrire silencieusement une source.

## Backlog et roadmap

Si `taches/BACKLOG.md` existe, il est le fichier canonique unique : roadmap par phases, résultats `BLG-NNN`, tâches `TSK-NNN`, carte des unités et progression.

- Quatre niveaux : `Phase → BLG-NNN → TSK-NNN → WORK-NNN`.
- Une `TSK` n'est **jamais** une autorisation : seule l'approbation d'un `WORK-NNN` autorise à construire, et seule l'acceptation humaine du résultat rend un `BLG` terminé.
- Le lien `realizes` vit uniquement dans `taches/WORK-NNN.md` ; le backlog ne le duplique pas.
- Les états d'une phase, d'un résultat et d'une tâche sont **calculés** : ne jamais tenter de les écrire.
- Le bloc `backlog:roadmap` du corps est **généré**. Ne jamais l'éditer à la main : après toute modification du frontmatter, exécuter `ai-project backlog sync-view`, puis `ai-project doctor`.
- Ne jamais cocher une tâche sans preuve réellement enregistrée. Une tâche `category: human` ne peut être validée que par une preuve `observation` nommant la personne qui a observé — jamais par un assistant ni un agent.
- Le journal des preuves est historique : `superseded` et `invalidated` sont terminaux, et le contenu d'une preuve enregistrée est immuable. Une preuve nouvelle prend un nouvel identifiant `EV-NNN`.
- Une évolution **substantielle** passe par `ai-project backlog revise`, qui archive l'état courant avant de changer de version et efface l'approbation. Ne jamais incrémenter `backlog_version` à la main.
- Le Doctor vérifie la cohérence de l'**état courant**. Il ne peut pas détecter une modification directe et coordonnée des fichiers de gouvernance : ne jamais présenter ses contrôles comme une garantie d'inviolabilité.

## Exécution

- Modifier le code uniquement dans le `code_root` configuré.
- Ne jamais copier dans le dépôt les fichiers privés du workspace.
- Utiliser seulement les commandes non nulles de `project.yaml`.
- Ne pas inventer une commande, une dépendance, une contrainte ou une approbation.
- Conserver les changements locaux existants qui ne concernent pas la tâche.
- Demander l'autorisation prévue par `governance` avant toute action externe, destructive, publication, déploiement ou commit.
- Ne pas créer ni activer un agent ou un skill sans besoin actuel identifié.

## Fin d'une tâche

1. Exécuter les contrôles applicables déclarés dans `project.yaml`.
2. Comparer le résultat aux critères d'acceptation.
3. Faire vérifier séparément tout changement risqué ou important.
4. Mettre à jour `PROJECT_STATE.md` uniquement avec des résultats observés.
5. Présenter clairement les preuves, les limites et la prochaine décision attendue.
