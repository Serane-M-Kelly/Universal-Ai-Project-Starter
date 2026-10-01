# Ce qui change depuis Universal AI Project Starter 0.14.1

| Sujet | Version 0.20.0 intégrée |
|---|---|
| Moteur | Même CLI Node/TypeScript, avec un moteur de phases intégré ; aucun runtime Python ajouté. |
| Parcours quotidien | Start, Next, Phase, Review remplacent Project Work dans les nouveaux workspaces. |
| Préparation | Discover, Handoff, Setup et Plan restent disponibles ; les acquis sont réutilisés, les étapes autorisées peuvent être regroupées. |
| Project Architect | Import du product-package v1 conservé, schémas et sources archivées ; import distinct de l’approbation du brief. |
| Backlog | Plan canonique JSON et projection Markdown phases → tâches, sans édition manuelle attendue. |
| Planification | Fonction Product Owner, résultat testable par phase et contrôle de faisabilité technique ; aucun nombre fixe de phases. |
| Autorisation | Mandat de phase persistant, corrections locales incluses et reprise après interruption. |
| Évolutions | Ajout futur indépendant sans annuler l’actif ; arbitrage explicite lorsque le contrat actif est affecté. |
| Preuves | Empreintes du contrat et de l’arbre source, rapports conservés, échecs et périmptions pris en compte. |
| Essais humains | Observation attribuée aux mots réellement reçus ; un test automatique ne remplit pas une tâche humaine. |
| Revue | Contexte distinct, rapport lié aux empreintes ; l’indépendance est déclarée et doit être effectivement assurée par l’environnement. |
| Modèles | Configuration centrale par rôle, modèle et effort ; génération native Codex, héritage Claude séparé. Aucun basculement magique du modèle parent. |
| Git | Préparation de commandes sur une sélection exacte ; exécution manuelle puis comparaison du commit réel. |
| Robustesse | Verrou local, snapshots, réparation de vue, restauration d’état et détection des personnalisations natives. |
| Sources Swift | Les liens dans BuildArtifacts/DerivedData/.build sont ignorés ; les liens symboliques dans les sources restent refusés. |
| Anciens projets | Conversion vers un nouveau workspace ; archives intactes, anciennes validations à examiner. |
| Compatibilité | Profils et commandes historiques conservés ; l’ancien plan ne doit pas coexister comme deuxième autorité dans un workspace v3. |

L’import mécanique du workflow n’établit pas encore un gain mesuré de vitesse ou de qualité.
Les [résultats de validation](VALIDATION.md) séparent les contrôles du programme, les essais
d’instructions avec agents et ce qui reste à éprouver sur le poste utilisateur.
