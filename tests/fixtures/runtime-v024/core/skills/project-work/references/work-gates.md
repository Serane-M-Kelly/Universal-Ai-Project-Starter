# Portes d'une unité de travail

Utiliser cette référence pour appliquer la machine d'état, choisir la profondeur des contrôles et interpréter la revue.

## Machine d'état

| État | Condition d'entrée | Autorité de transition |
|---|---|---|
| `proposed` | contrat d'unité rédigé | assistant ou personne |
| `approved` | résultat, périmètre et critères explicitement autorisés | personne humaine |
| `in_progress` | première mutation réelle commencée | exécutant autorisé |
| `ready_for_review` | implémentation annoncée complète et tests ciblés exécutés | exécutant |
| `ready_for_acceptance` | portes applicables réussies et revue terminée | exécutant ou reviewer |
| `accepted` | résultat examiné et accepté sans condition pendante | personne humaine |
| `blocked` | obstacle empêchant la prochaine transition | exécutant ou reviewer |

Chaque retour arrière d'état doit conserver sa cause dans le rapport. Ne jamais effacer les preuves d'un échec ou d'un refus.

## Lien avec le backlog v2

| Fait | Propriétaire | Écrit par |
|---|---|---|
| tâches entreprises par l'unité (`realizes`) | **le fichier d'unité** | `project-work`, à la création ou par `legacy-link-conversion` |
| preuve d'une tâche (`evidence_log`) | le backlog | `project-work`, quand la preuve existe |
| acceptation du résultat (`outcome_accepted_*`) | le backlog | `project-work`, sur décision humaine |
| état d'une tâche, d'un résultat, d'une phase | **personne — calculé** | jamais écrit |

Après toute écriture du frontmatter du backlog ou d'une unité : `ai-project backlog sync-view`, puis `ai-project doctor`.

## Profondeur de vérification

### Légère

Pour documentation, texte, configuration locale réversible ou changement isolé à faible impact :

- contrôle ciblé ;
- inspection du diff ;
- vérification des liens ou formats concernés.

### Standard

Pour fonctionnalité ou correction courante :

- tests ciblés ;
- lint et typecheck applicables ;
- tests de régression voisins ;
- build applicable ;
- revue séparée du diff.

### Renforcée

Pour authentification, autorisation, données sensibles, paiements, migrations, concurrence, dépendance structurante ou impact humain élevé :

- base de comparaison avant changement ;
- tests de succès, erreur, abus et retour arrière ;
- analyse des frontières de confiance et des données ;
- revue indépendante ou avis qualifié si disponible ;
- décision humaine sur les risques résiduels.

## Porte READY_FOR_ACCEPTANCE

- L'unité porte une approbation humaine traçable.
- Chaque `TSK` de `realizes` est soit terminée avec une preuve valable, soit explicitement laissée `todo` ou `blocked` avec sa raison.
- Aucune `TSK` `category: human` n'est cochée autrement que par une observation portant le nom de la personne.
- Chaque critère d'acceptation possède une preuve ou un blocage explicite.
- Les commandes applicables ont réellement été exécutées.
- Le diff est borné et ne contient aucun secret ni artefact inattendu.
- Les changements préexistants restent distinguables.
- Aucun constat bloquant ou majeur ne demeure non résolu.
- Les risques résiduels ont une personne responsable.
- `PROJECT_STATE.md` et le rapport reflètent l'état observable.

## Sévérité de revue

- **bloquant** : perte, vulnérabilité, comportement faux ou critère essentiel absent ;
- **majeur** : régression probable, cas important manquant ou vérification non fiable ;
- **mineur** : amélioration limitée sans effet sur l'acceptation ;
- **information** : contexte ou suggestion future hors de l'unité.

Signaler les constats avant le résumé. Une préférence de style ne devient pas un défaut sans règle locale ou effet démontrable.
