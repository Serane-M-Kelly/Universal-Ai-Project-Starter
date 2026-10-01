# Contrat produit

## 1. Utilisatrice principale

La propriétaire d'un projet numérique qui souhaite travailler avec un ou plusieurs assistants IA tout en conservant la maîtrise :

- du problème et de la cible ;
- du périmètre ;
- des agents et de leurs instructions ;
- des décisions importantes ;
- des actions externes ;
- de l'acceptation et de la livraison.

## 2. Problème traité

Les assistants peuvent produire du code rapidement, mais rencontrent fréquemment les problèmes suivants :

- contexte incomplet ou contradictoire ;
- passage prématuré au code ;
- périmètre qui dérive ;
- instructions et rôles dupliqués ;
- choix techniques inventés ;
- reprise de session difficile ;
- vérifications incomplètes ;
- mélange entre fichiers privés et livrables ;
- dépendance à un assistant ou une stack ;
- règles critiques décrites mais non contrôlées.

## 3. Résultat attendu

À partir d'une entrée plus ou moins structurée, le starter doit produire un workspace où :

- le projet est compris à un niveau proportionné à l'enjeu ;
- le brief validé constitue le contrat produit ;
- l'état courant et la prochaine action sont visibles ;
- le bon profil technique est appliqué ;
- l'assistant dispose uniquement du contexte utile ;
- les agents sont sélectionnés selon les risques réels ;
- chaque lot possède des critères d'acceptation ;
- les contrôles applicables sont reproductibles ;
- la livraison nécessite une décision humaine explicite.

## 4. Modes d'entrée

Le système doit accepter quatre situations :

1. **Idée** : découverte produit nécessaire.
2. **Brief existant** : normalisation et validation avant setup.
3. **Dépôt existant** : adoption sans recréer le code.
4. **Maintenance** : mission bornée sur un projet déjà cadré.

Un `product-package` issu de Project Architect n'ajoute pas un cinquième mode d'entrée : il enrichit un workspace `idea` ou `brief` avec une recherche et une conception préalables. Son import reste distinct de leur consolidation dans le brief.

## 5. Sources de vérité prévues

### `project.yaml`

Configuration mécanique : identité, chemins, profil, adaptateurs, commandes et politiques.

### `PROJECT_BRIEF.md`

Contrat produit humainement validé : problème, cible, valeur, MVP, exclusions, règles métier, critères et contraintes.

### `PROJECT_STATE.md`

État opérationnel : stade, phase, tâche, décisions attendues, blocages et dernière vérification.

Les documents spécialisés complètent ces trois fichiers sans reproduire leur contenu.

### `intake/product-package/`

Archive versionnée et immuable des recherches, décisions proposées, parcours, prototype et limites reçus de Project Architect. Elle constitue une preuve d'entrée, pas un contrat produit approuvé. `project-discover` la traduit en brouillon ; `project-handoff` conserve la validation humaine.

## 6. Autorité

### L'assistant peut agir sans nouvelle validation pour

- lire et analyser le contexte placé dans le périmètre ;
- organiser des informations sans en changer le sens ;
- exécuter des contrôles locaux non destructifs ;
- préparer un brouillon ;
- effectuer une modification locale, réversible et déjà comprise dans une tâche explicitement validée.

### Une validation humaine est requise pour

- accepter ou modifier le brief ;
- changer la cible, la valeur ou le périmètre ;
- choisir une dépendance ou un fournisseur structurant ;
- engager une dépense ;
- traiter ou publier des données externes ;
- accepter un risque important ;
- déployer, publier ou envoyer un message ;
- effectuer une migration ou une suppression difficilement réversible.

## 7. Agents

Le noyau doit pouvoir fonctionner avec seulement :

- un Builder ;
- un Independent Reviewer.

Les autres agents sont conditionnels. Chaque agent doit posséder un déclencheur, une mission, des entrées, une autorité, des outils minimaux, un livrable et un critère de fin.

Les agents peuvent être entièrement rédigés par l'utilisatrice. Le starter ne doit jamais les réécrire silencieusement.

## 8. Skills

Le noyau fonctionnel visé est :

- `project-discover` ;
- `project-handoff` ;
- `project-setup` ;
- `project-plan` ;
- `project-work` ;
- `project-ship`.

`project-plan` transforme un socle prêt en roadmap de construction — phases, résultats `BLG-NNN`, tâches `TSK-NNN` — et en stratégie d'agents. `taches/BACKLOG.md` reste le fichier canonique unique ; aucun `ROADMAP.md` séparé n'est créé. Il est obligatoire après le setup pour les modes `idea` et `brief`, optionnel pour les modes `existing` et `maintenance`.

Une tâche `TSK-NNN` n'est jamais soumise à approbation : elle se coche contre une preuve enregistrée. L'approbation humaine porte sur les unités `WORK-NNN`, et l'acceptation du résultat sur les `BLG-NNN`. Une vérification physique (`category: human`) ne peut être validée que par une preuve d'observation nommant la personne.

Le starter garantit la cohérence de l'état courant du workspace, l'atomicité de ses commandes et la préservation exacte du contenu humain. Il ne garantit pas la résistance à une modification volontaire et coordonnée des fichiers de gouvernance : cette limite est explicite, et un mode haute intégrité fondé sur une frontière externe reste hors périmètre de la v0.14.0.

Les procédures déterministes doivent être déléguées au CLI plutôt qu'encodées uniquement dans les prompts.

## 9. Critères de réussite du starter

- initialisation compréhensible en moins de dix minutes ;
- aucun historique Git du starter copié dans un projet ;
- aucune fuite de fichier privé détectable ;
- reprise de session sans réexpliquer le projet ;
- aucun skill généré par projet lorsque seule la configuration change ;
- aucun agent activé sans responsabilité actuelle ;
- commandes de contrôle existantes et vérifiées ;
- résultat de diagnostic explicite : `READY`, `WARNING` ou `BLOCKED` ;
- projet nouveau et dépôt existant tous deux pris en charge ;
- mise à jour du starter sans écraser les personnalisations.

## 10. Non-objectifs de la première version

- déploiement automatique sur toutes les plateformes ;
- marketplace publique d'agents ;
- orchestration autonome d'une grande équipe d'agents ;
- support exhaustif de toutes les stacks ;
- interface graphique ;
- validation juridique ou commerciale automatique ;
- synchronisation cloud propriétaire.
