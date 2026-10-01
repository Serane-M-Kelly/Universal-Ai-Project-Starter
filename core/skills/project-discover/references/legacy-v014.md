---
name: project-discover
description: "Transformer une idée, un brief incomplet ou un product-package importé en PROJECT_BRIEF.md brouillon fondé sur des faits, hypothèses, risques et décisions explicites. Utiliser quand le problème, la cible, la valeur, le MVP ou les critères de succès doivent être établis, ou après ai-project intake import pour contrôler et consolider les recherches de Project Architect ; ne pas utiliser pour implémenter, adopter un dépôt déjà cadré ou approuver le brief."
---

# Project Discover

Transformer une intention encore incertaine en contrat produit révisable. Produire un brouillon exploitable sans présenter une hypothèse comme un fait ni une recommandation comme une approbation.

## Choisir la route d'entrée

- Si `intake/product-package/registry.yaml` existe, lire `references/package-intake.md` et suivre la route **package importé**.
- Sinon, suivre la route **idée ou brief incomplet** décrite ci-dessous.

Dans la route package importé, ne pas recommencer la recherche déjà sourcée. Auditer sa qualité, conserver ses limites et questionner seulement les lacunes qui peuvent changer la décision ou empêcher un brief responsable.

## Respecter l'autorité

- Lire `project.yaml`, `PROJECT_BRIEF.md`, `PROJECT_STATE.md`, le registre d'import éventuel et les preuves déjà référencées avant de questionner.
- Préserver le contenu rédigé par l'utilisatrice et signaler les contradictions au lieu de les résoudre silencieusement.
- Garder le brief en `status: draft`. Ne jamais renseigner `approved_by` ou `approved_at` au nom d'une personne.
- Ne pas commencer l'implémentation, choisir une stack ou créer un backlog de réalisation pendant cette procédure.
- Ne lancer aucune recherche externe, prise de contact, dépense ou autre action externe sans respecter `governance.external_actions` et la demande de l'utilisatrice.
- Ne jamais écrire de secret dans le workspace.

## Choisir la profondeur

Appliquer le parcours le plus léger qui permette une décision responsable :

- **Express** : besoin clair, faible risque, coût limité, action réversible.
- **Standard** : plusieurs inconnues sur la cible, la valeur, le périmètre ou l'acceptation.
- **Renforcé** : données sensibles, obligations légales, forte irréversibilité, coût élevé ou impact humain important.

Expliquer en une phrase le niveau retenu. Passer au niveau supérieur si une inconnue peut invalider le projet ou causer un dommage significatif.

## Conduire la découverte

### 1. Établir la décision recherchée

Identifier la décision que le brief doit rendre possible : poursuivre, réduire, tester, reporter ou abandonner. Reformuler l'objectif en résultat observable, sans présumer de la solution.

### 2. Inventorier ce qui est déjà connu

Classer chaque élément utile comme :

- fait sourcé ;
- observation ;
- hypothèse ;
- préférence ;
- contrainte imposée ;
- décision humaine.

Associer une source ou une raison et un niveau de confiance aux affirmations déterminantes. Écrire « inconnu » quand l'information n'existe pas.

### 3. Combler les lacunes bloquantes

Questionner progressivement, par groupes cohérents de trois questions maximum. Commencer par les lacunes qui peuvent changer la décision :

1. problème actuel et coût de l'inaction ;
2. personnes concernées et contexte d'usage ;
3. résultat attendu et manière de l'observer ;
4. alternatives actuelles ;
5. périmètre minimal et exclusions ;
6. parcours et règles métier critiques ;
7. données, sécurité, contraintes et acceptation ;
8. risques, inconnues et conditions d'arrêt.

Proposer un défaut explicite lorsqu'il aide à avancer, mais attendre sa confirmation avant de le transformer en décision. Consulter `references/question-bank.md` seulement si une catégorie reste insuffisamment cadrée ou si le parcours est renforcé.

### 4. Rechercher uniquement ce qui change la décision

Si une recherche externe est autorisée et nécessaire :

- formuler d'abord la question décisionnelle ;
- privilégier les sources primaires et datées ;
- enregistrer les références dans `intake/research/` ;
- séparer ce que la source établit de ce qui en est inféré ;
- noter les limites, contradictions et dates de validité.

Ne jamais déclarer qu'un marché, un besoin ou une conformité est prouvé par une recherche superficielle.

### 5. Mettre à jour les sources de vérité

Compléter `PROJECT_BRIEF.md` sans modifier sa structure ni dupliquer la configuration mécanique de `project.yaml`.

- Conserver le statut `draft`.
- Renseigner uniquement les éléments établis ou les marquer explicitement comme hypothèses.
- Relier les critères de succès à une mesure, un seuil et un moment de vérification.
- Formuler les exclusions aussi précisément que les inclusions.
- Placer les preuves détaillées dans `intake/` et les référencer depuis le brief.
- Préserver toute archive sous `intake/product-package/` ; ne jamais corriger directement un package importé.
- Inscrire dans `docs/decisions.md` seulement les décisions réellement acceptées.
- Mettre à jour `PROJECT_STATE.md` après un progrès observé : stade, objectif immédiat, décisions attendues, blocages et prochaine action.

Respecter `core/contracts/source-of-truth.md` si ce fichier est disponible dans le starter ; dans un workspace généré, appliquer les règles de propriété décrites par les fichiers existants.

### 6. Évaluer la préparation à la revue

Le brouillon est prêt pour une revue humaine seulement si les éléments suivants sont explicites :

- problème, cible et résultat attendu ;
- niveau de preuve et hypothèses majeures ;
- MVP, exclusions et parcours critiques ;
- critères d'acceptation mesurables ;
- données, sécurité et contraintes applicables ;
- risques, inconnues, conditions d'arrêt et décisions encore attendues ;
- personne responsable de l'acceptation.

Attribuer l'un des états suivants :

- `READY_FOR_REVIEW` : suffisamment cadré pour demander une décision humaine ;
- `NEEDS_EVIDENCE` : une preuve déterminante manque mais le travail peut continuer ;
- `BLOCKED` : aucune décision responsable n'est possible sans information ou autorité supplémentaire.

Ces états n'approuvent jamais le brief.

## Restituer le résultat

Terminer par une synthèse courte contenant :

1. la décision désormais possible ;
2. les faits et preuves déterminants ;
3. les hypothèses encore ouvertes ;
4. les décisions enregistrées ;
5. les risques ou blocages ;
6. l'état de préparation et la prochaine action humaine recommandée.

Nommer les fichiers modifiés. Si aucune modification n'était autorisée, fournir les changements proposés sans prétendre les avoir appliqués.
