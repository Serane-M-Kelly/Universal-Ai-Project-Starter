---
name: project-handoff
description: "Vérifier qu'un PROJECT_BRIEF.md brouillon est complet, cohérent, traçable et suffisamment sûr, produire une revue de passage, obtenir une décision humaine explicite puis enregistrer correctement son approbation, son refus ou les changements demandés. Utiliser quand la découverte est terminée, qu'un brief doit être remis, gelé, approuvé ou réapprouvé avant setup ou réalisation ; ne pas utiliser pour découvrir le besoin, implémenter, ni approuver automatiquement."
---

# Project Handoff

Transformer un brief brouillon en décision humaine traçable. Séparer strictement la recommandation de l'assistant, l'autorité de l'approbatrice et les contrôles mécaniques.

## Respecter l'autorité

- Lire `project.yaml`, `PROJECT_BRIEF.md`, `PROJECT_STATE.md`, `docs/decisions.md` et les preuves référencées avant la revue.
- Ne jamais présenter le brief comme approuvé tant que son frontmatter ne porte pas une personne humaine identifiée et une date valide.
- Ne jamais déduire une approbation du silence, d'un ancien message, d'un « ça me paraît bien » ambigu ou d'une approbation assortie de changements.
- Ne pas modifier le fond du produit pendant la revue. Renvoyer les lacunes vers `project-discover` ou vers la personne responsable.
- Ne pas choisir l'architecture, démarrer le setup, créer du code ou mobiliser un agent de réalisation.
- Respecter `governance.brief_approval`. Une politique `allowed` ne remplace jamais la décision humaine ; elle autorise seulement son enregistrement sans demande de permission supplémentaire.

## Exécuter la porte de passage

### 1. Identifier la version examinée

Relever `brief_version`, `status`, `supersedes`, l'approbatrice attendue et la décision que le brief doit permettre. Vérifier que la revue porte sur le fichier actuel, pas sur une copie ou un résumé.

Si un brief déjà approuvé a subi une modification de fond, interrompre l'approbation tant que :

- la version précédemment approuvée n'est pas préservée dans `docs/internal/brief-history/` ;
- la version courante n'est pas incrémentée et repassée en `draft` ;
- `supersedes` n'identifie pas la version remplacée ;
- les conséquences sur l'état, les décisions et les tâches ne sont pas signalées.

### 2. Lancer les contrôles déterministes

Exécuter `ai-project doctor` depuis le workspace lorsque le CLI est disponible. Traiter tout verdict `BLOCKED` comme bloquant pour l'approbation. Ne pas maquiller un contrôle échoué par une appréciation qualitative.

Si le CLI n'est pas disponible, contrôler au minimum :

- frontmatter lisible et version positive ;
- statut `draft` avant décision ;
- absence d'approbatrice ou de date résiduelle sur le brouillon ;
- absence de placeholders présentés comme résolus ;
- présence des sources de vérité et des références annoncées.

Signaler explicitement que la vérification mécanique complète n'a pas été exécutée.

### 3. Examiner la qualité décisionnelle

Vérifier que le brief permet réellement de décider sans inventer d'information :

- problème, cible, résultat et coût de l'inaction compréhensibles ;
- preuves distinguées des hypothèses et limites visibles ;
- proposition de valeur reliée au problème ;
- MVP, exclusions, conditions et parcours critiques non contradictoires ;
- règles métier et cas limites déterminants ;
- critères de succès et d'acceptation mesurables ;
- données, confidentialité, sécurité et exigences non fonctionnelles proportionnées ;
- contraintes imposées séparées des préférences ;
- risques, inconnues, conditions d'arrêt et décisions restantes explicites ;
- responsable de l'acceptation identifié.

Consulter `references/review-gate.md` pour les contrôles détaillés et le format du rapport. Charger la partie renforcée seulement si des données sensibles, une obligation réglementaire, une forte irréversibilité ou un impact humain important sont présents.

### 4. Classer les constats

Classer chaque constat selon son effet sur la décision :

- **bloquant** : l'approbation serait trompeuse, dangereuse ou inexploitable ;
- **majeur** : la réalisation peut partir dans une direction substantiellement erronée ;
- **mineur** : amélioration utile sans effet sur le périmètre accepté ;
- **information** : contexte à conserver sans changement demandé.

Ne pas bloquer pour une préférence éditoriale. Relier chaque constat à une section précise, expliquer son impact et proposer la plus petite correction vérifiable.

### 5. Produire la recommandation

Créer ou actualiser `reports/brief-review-v<brief_version>.md` avec : périmètre revu, vérifications exécutées, constats, risques acceptés, décisions attendues et verdict.

Utiliser exclusivement l'un de ces verdicts :

- `READY_FOR_APPROVAL` : aucun constat bloquant ou majeur non résolu ;
- `CHANGES_REQUIRED` : une correction de fond ou une clarification est nécessaire ;
- `BLOCKED` : une preuve, une autorité ou un avis qualifié manque ;
- `APPROVED` : décision humaine explicite enregistrée et vérification finale réussie.

Un verdict `READY_FOR_APPROVAL` est une recommandation, jamais une approbation.

### 6. Obtenir la décision humaine

Présenter une synthèse courte : version, périmètre, risques résiduels, décisions encore ouvertes et recommandation. Demander une décision explicite portant sur la version examinée.

Accepter comme approbation uniquement une formulation sans ambiguïté équivalente à : « J'approuve le brief version N », émise dans l'interaction courante par une personne dont le nom est connu.

- Si l'identité manque, la demander avant l'enregistrement.
- Si la décision comporte une condition ou une correction, conserver `draft` et enregistrer `CHANGES_REQUIRED`.
- Si la personne refuse ou reporte, conserver `draft` et noter la prochaine condition de revue.
- Si `brief_approval: forbidden`, ne modifier aucune métadonnée d'approbation et expliquer qui doit effectuer l'enregistrement hors de cette procédure.

### 7. Enregistrer la décision

Après approbation explicite seulement :

1. conserver le contenu et `brief_version` de la version examinée ;
2. renseigner `status: approved`, `approved_by` et `approved_at` au format `AAAA-MM-JJ` ;
3. inscrire l'approbation et les risques explicitement acceptés dans `docs/decisions.md` ;
4. mettre à jour `PROJECT_STATE.md` avec la version approuvée, la fin du handoff et `project-setup` comme prochaine étape ;
5. relancer `ai-project doctor` ;
6. ne produire `APPROVED` que si le contrôle final ne retourne aucun blocage lié au brief.

Après refus, report ou changement demandé :

1. conserver `status: draft` ;
2. garder `approved_by` et `approved_at` à `null` ;
3. inscrire les corrections et leur responsable dans `PROJECT_STATE.md` ;
4. enregistrer dans `docs/decisions.md` uniquement les décisions effectivement prises, pas les suggestions de l'assistant.

## Restituer le passage

Terminer par :

1. la version examinée ;
2. le verdict ;
3. les constats bloquants ou majeurs ;
4. les risques résiduels acceptés ou encore ouverts ;
5. la décision humaine enregistrée, ou l'autorité encore attendue ;
6. les fichiers modifiés ;
7. la prochaine étape autorisée.

Ne jamais annoncer `project-setup` comme autorisé si le brief reste en brouillon.
