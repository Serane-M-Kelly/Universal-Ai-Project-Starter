# Contrat du backlog et de la stratégie d'agents

## Objectif

Empêcher qu'une unité isolée soit réalisée sans vision du reste du MVP, empêcher qu'un élément de backlog soit confondu avec une autorisation d'implémenter, et empêcher qu'une progression de construction soit confondue avec la validation d'un résultat.

## Deux documents complémentaires

- `taches/BACKLOG.md` : **fichier canonique unique** — roadmap par phases, backlog priorisé, checklist de construction, carte des unités et état de progression. Aucun `ROADMAP.md` séparé n'est créé.
- `docs/agent-strategy.md` : mode d'exécution recommandé par responsabilité.

Les deux sont privés (`taches/` et `docs/`), jamais copiés dans `code_root`.

## 1. Le modèle à quatre niveaux

```text
Phase       grande étape cohérente de construction
└── BLG-NNN un seul résultat observable
    ├── TSK-NNN une action concrète et cochable
    └── WORK-NNN unité approuvée, déclare `realizes: [TSK-NNN, …]`
```

| Niveau | Répond à | Autorité | Ne porte jamais |
|---|---|---|---|
| Phase | quel morceau du produit construit-on ? | aucune (dérivée) | aucun état stocké |
| `BLG` | quel résultat observable vise-t-on ? | acceptation humaine du **résultat** | ni autorisation d'implémenter, ni détail de réalisation |
| `TSK` | quelle action concrète faut-il faire ? | **aucune** — une preuve, jamais une autorisation | jamais d'approbation humaine |
| `WORK` | quel lot borné autorise-t-on à réaliser ? | approbation humaine d'**implémenter** | ne redéfinit jamais le résultat du `BLG` |

### Les deux actes humains

| Acte | Objet | Enregistré dans |
|---|---|---|
| **Approbation** | autoriser la construction | `WORK-NNN.md` (`approved_by`/`approved_at`) |
| **Acceptation du résultat** | constater que le résultat est atteint | `BLG` (`outcome_accepted_by`/`outcome_accepted_at`) |

Quand un résultat n'a qu'une unité et que son acceptation démontre déjà le résultat, un seul échange humain produit les deux enregistrements.

## 2. États stockés et états calculés

Un fait dérivable n'est jamais stocké : ce serait une seconde source de vérité.

| Niveau | Stocké | Calculé |
|---|---|---|
| Phase | `disposition` (`active`/`retired`), `prepared_by`, `prepared_at` | `empty`, `optional`, `not_started`, `in_progress`, `complete`, `retired` |
| `BLG` | `stage` (`candidate`/`ready`), `disposition` (`active`/`deferred`/`retired`), `outcome_accepted_*` | `candidate`, `ready`, `in_progress`, `built`, `done`, `deferred`, `retired` |
| `TSK` | `disposition` (`active`/`blocked`/`dropped`), `evidence_log` | `todo`, `done`, `blocked`, `dropped` |

### Calcul de l'état d'une tâche

```text
une preuve `state: valid`        → done
sinon disposition == blocked     → blocked
sinon disposition == dropped     → dropped
sinon                            → todo
```

L'invalidation ou le remplacement d'une preuve ramène donc automatiquement la tâche à `todo`, `blocked` ou `dropped`, sans jamais stocker un second statut contradictoire.

### Calcul de l'état d'un résultat

```text
disposition retired / deferred                                        → retired / deferred
≥1 tâche obligatoire, toutes done, et acceptation présente            → done
≥1 tâche obligatoire, toutes done, sans acceptation                   → built
≥1 tâche done, OU ≥1 WORK réalisant une de ses tâches est approved+   → in_progress
sinon                                                                  → stage
```

La garde « ≥1 tâche obligatoire » interdit qu'un résultat sans tâche soit `built` ou `done`. Une tâche obligatoire `dropped` n'est pas `done` : elle bloque donc le résultat jusqu'à une décision substantielle.

### Calcul de l'état d'une phase

```text
disposition retired                                    → retired
aucun résultat actif                                   → empty
aucun résultat actif obligatoire                       → optional
tous les résultats actifs obligatoires sont done       → complete
≥1 tâche done, OU ≥1 unité active sur la phase         → in_progress
sinon                                                   → not_started
```

`optional` est évalué **avant** `complete` : une phase ne contenant que des résultats facultatifs ne s'affiche jamais terminée à 0/0. Une phase vide est un avertissement en brouillon et un blocage à l'approbation.

## 3. Granularité

**Résultat (`BLG`)** — plafond : deux choses constatables séparément font deux résultats. Plancher : *« la personne responsable pourrait-elle le constater elle-même sans lire le code ? »* Si non, c'est une tâche. Un découpage prévisible aujourd'hui s'écrit aujourd'hui.

**Tâche (`TSK`)** — une action qu'on saurait décrire dans un message de commit. Catégories : `product`, `ux`, `tech`, `architecture`, `data`, `security`, `quality`, `docs`, `delivery`, `human`.

## 4. Planification progressive

Toutes les phases sont définies et tous les résultats significatifs recensés dès la première planification. Seules la phase 0 historique et la prochaine phase de réalisation sont détaillées en tâches ; la phase suivante peut l'être partiellement. Les résultats lointains restent `stage: candidate` sans tâche — **c'est l'état normal, sans avertissement**.

Un résultat ne passe `stage: ready` que s'il possède un résultat défini, ses dépendances, **au moins une tâche obligatoire**, et un découpage suffisant pour créer une unité.

## 5. Preuves

Une tâche n'est terminée que par une preuve actuellement valable.

- une seule entrée `state: valid` par tâche ;
- une entrée `superseded` ou `invalidated` exige motif et date ;
- le journal est **append-only** : une réouverture invalide, elle ne supprime jamais ;
- `kind: observation` exige un `observed_by` nommé ;
- `kind: report`/`document`/`decision` exige un chemin existant dans le workspace ;
- `kind: commit` exige une empreinte Git ;
- **`category: human` terminée ⇒ preuve `observation`** : aucun agent ne peut cocher une vérification physique ;
- une tâche peut être terminée **sans aucune unité**, sur preuve historique (phase 0 issue du rapport de setup ou d'une décision) ;
- **toute date** (`approved_at`, `prepared_at`, `outcome_accepted_at`, `added_at`, `recorded_at`, `state_at`, `dropped_at`) doit être une date calendaire réelle au format `AAAA-MM-JJ` : `0000-00-00`, `2026-02-30`, un libellé ou une chaîne blanche sont refusés ;
- **toute identité humaine** (`observed_by`, `outcome_accepted_by`, `prepared_by`, `dropped_by`) doit être réellement renseignée : une chaîne d'espaces est refusée.

### États d'une preuve

Le journal est historique et append-only **dans le workflow géré** : une réouverture passe l'entrée courante à `superseded` (preuve remplacée) ou `invalidated` (preuve fausse), avec motif et date, et une nouvelle preuve reçoit un **nouvel identifiant** `EV-NNN`. Jamais de suppression, jamais de réactivation d'une entrée écartée.

Le Doctor vérifie, dans l'état courant : au plus une entrée `valid` par tâche, motif et date obligatoires sur toute entrée écartée, et cohérence des états déclarés. *Il ne prétend pas prouver qu'une valeur antérieure n'a jamais été modifiée directement : sans historique externe fiable, cette comparaison est impossible (§6bis).* Les skills et les adaptateurs restent responsables de ne jamais inventer ni modifier une décision humaine.

## 6. Stabilité des identifiants

Dans le workflow géré, un identifiant n'est jamais réutilisé. Cela vaut pour `PH-N`, `BLG-NNN`, `TSK-NNN` et `EV-NNN`.

Le Doctor vérifie, **dans l'état courant** : unicité, format, compteur `id_allocation` strictement supérieur au maximum utilisé, existence des références, cohérence des filiations, absence de doublon.

- Aucun identifiant n'est réservé à l'avance : le compteur avance à la création.
- Un résultat sans objet passe `disposition: retired`, une tâche passe `disposition: dropped`, une phase passe `retired`. On ne supprime pas, on retire. Un renommage conserve l'identifiant.
- **Découpage** : au plus un successeur conserve l'identifiant d'origine, et seulement s'il porte le résultat dominant. Les autres reçoivent des identifiants neufs avec `derived_from`. Un titre conservé peut être réduit, jamais remplacé par un résultat sans filiation.

> **Limite explicite.** Une édition directe et coordonnée du backlog et de ses compteurs n'est pas détectable sans historique externe. Le Doctor ne promet aucune impossibilité absolue : il garantit la cohérence de ce qu'il peut observer, et la discipline du workflow géré fait le reste. De même, aucun contrôle ne peut juger si un titre renommé désigne encore le même résultat — remplacer un résultat exige un nouvel identifiant et une décision humaine, règle de gouvernance et non verrou d'exécution.

## 6bis. Modèle de confiance et limite explicite

### Ce que le starter garantit

- la cohérence de l'**état courant** du workspace ;
- la sécurité et l'atomicité de ses propres commandes ;
- l'absence de perte silencieuse pendant une migration ;
- la préservation exacte du récit et du frontmatter lors d'un `sync-view` ;
- la cohérence des identifiants, preuves, relations et approbations **visibles dans l'état courant** ;
- la création d'une archive avant toute évolution substantielle réalisée par le workflow officiel ;
- des diagnostics distincts pour un fichier absent, illisible, au frontmatter invalide ou au schéma invalide.

### Ce que le starter ne prétend pas garantir

Le starter **ne résiste pas** à une personne ou un assistant qui modifie ou supprime volontairement et de façon coordonnée le backlog, ses archives, ses compteurs, ses preuves et ses fichiers de gouvernance. Tout mécanisme placé dans le même workspace reste modifiable par la même autorité : il n'existe pas de frontière de confiance à l'intérieur du workspace.

Cette limite est assumée et ne doit jamais être présentée comme couverte.

> **Mode haute intégrité (hors v0.14.0).** Un historique infalsifiable nécessite une frontière externe. Un futur mode haute intégrité pourra utiliser un dépôt Git local privé ou un stockage transactionnel. Il ne fait pas partie de la v0.14.0.

### Historique de workflow

Une évolution substantielle passe par `ai-project backlog revise`, qui :

1. valide intégralement l'état courant ;
2. archive cet état de façon **exclusive** dans `docs/internal/backlog-history/BACKLOG-v<N>.md` ;
3. incrémente `backlog_version`, repasse en `draft` et efface l'approbation ;
4. régénère la vue ;
5. valide le résultat.

La procédure est récupérable après interruption : une archive **identique** à l'état attendu est la reprise d'une tentative interrompue ; une archive **différente** bloque. Une archive n'est jamais écrasée.

Ces archives constituent un **historique de workflow**, pas une preuve infalsifiable : elles enregistrent ce que le workflow officiel a fait, et rien de plus.

## 7. Ordre et dépendances

- L'ordre canonique des phases est **l'ordre du tableau `phases`**. Aucun rang global.
- `order` est unique **à l'intérieur d'une phase**.
- `depends_on` ne peut pointer que vers un résultat d'une phase antérieure, ou d'`order` inférieur dans la même phase.

Déplacer ou insérer une phase ne renumérote donc rien, et les cycles sont impossibles par construction.

## 8. Lien avec les unités

`realizes` vit **uniquement** dans `taches/WORK-NNN.md` : le backlog ne duplique jamais ce lien.

- une unité réalise une ou plusieurs tâches ;
- une même tâche peut être reliée à **plusieurs** unités (correction, nouvelle tentative) : c'est le cas nominal, pas une anomalie ;
- une unité reste normalement dans un seul résultat ; un lot transversal exige `cross_cutting: true` **et** une section `## Justification du lot transversal` ;
- `legacy_work_items` est un champ **transitoire** issu de la migration v1 → v2. Il conserve visible le lien opérationnel jusqu'à ce que `realizes` soit écrit, et ne peut être retiré qu'ensuite. Aucune unité rattachée au backlog dans une archive ne doit devenir injoignable.

## 9. Les quatre catégories de changement

| | Substantiel | Préparation de phase | Élaboration opérationnelle | Régénération de vue |
|---|---|---|---|---|
| Exemples | nouveau résultat ; modification du résultat, du périmètre, de la phase, d'une dépendance, de la priorité ou du caractère obligatoire ; nouvelle exigence de sécurité ; changement des critères généraux ; découpage ; réouverture d'un résultat accepté | passage de résultats de `candidate` à `ready` par ajout de leurs tâches, sans rien changer d'autre | tâche technique découverte pendant une unité approuvée, même résultat, sans effet sur le résultat, la sécurité, les critères ni le périmètre | `ai-project backlog sync-view` |
| `backlog_version` | incrémentée | inchangée | inchangée | inchangée |
| Approbation | effacée, à refaire | conservée | conservée | conservée |
| Trace | archive `docs/internal/backlog-history/` + décision | `phases[].prepared_by`/`prepared_at` | `origin: discovered`, `source_work`, `origin_reason`, `added_at`, mention dans le rapport d'unité | aucune |

**Régénérer la vue n'est jamais un changement substantiel** et n'affecte jamais l'approbation.

## 10. Vue générée

Le corps de `taches/BACKLOG.md` contient un bloc délimité par `<!-- backlog:roadmap début … -->` et `<!-- backlog:roadmap fin -->`. Ce bloc est une **projection pure** du frontmatter du backlog et du frontmatter des unités.

- il n'est jamais rédigé ni corrigé à la main ;
- `ai-project backlog sync-view` le régénère de façon atomique, sans toucher un octet du récit **ni du frontmatter** : celui-ci est réécrit tel quel, commentaires, quoting et mise en forme YAML compris ;
- la structure des marqueurs est vérifiée avant toute écriture : seuls « aucun marqueur » et « exactement un début suivi d'une fin » sont exploitables. Toute autre structure — marqueur dupliqué, inversé, ou recopié dans le récit — refuse d'écrire et laisse le fichier identique octet à octet ;
- un marqueur complet dans un champ rendu dans la vue (titre, objectif, motif, référence) est refusé : le bloc et le récit deviendraient indissociables ;
- le Doctor le régénère et le compare octet à octet ; une différence bloque ;
- la coche `[x]` correspond **exactement** à l'état calculé `done`, jamais à autre chose.

## 11. `docs/agent-strategy.md`

`covers` désigne des phases (`PH-N`) ou des résultats (`BLG-NNN`). Le motif `TSK-` n'est pas admis par le schéma : recommander un agent par micro-tâche est structurellement impossible. Le niveau `WORK` s'exprime dans le champ « Moment d'intervention ».

Trois couches distinctes restent séparées : la **recommandation** (mode et identifiant proposé), la **décision humaine** (approbation de la stratégie, qui n'installe rien), et la **disponibilité réelle** (`project.yaml.agents`, seule source mécanique).

La section « Responsabilités volontairement sans agent » doit couvrir explicitement les tâches `category: human` et l'acceptation des résultats.

`source_backlog_version` doit être égal au `backlog_version` en vigueur.

## 12. Autorité

- L'assistant propose, clarifie, réordonne, et coche une tâche **uniquement contre une preuve réelle**.
- Une personne humaine approuve les deux documents avant `PLAN_READY`, approuve chaque unité, et accepte chaque résultat.
- Aucun agent ne reçoit d'autorité de ces documents.
- `PLAN_READY` ne remplace jamais l'approbation individuelle d'un `WORK-NNN`.

## 13. Rôle du Doctor

Il vérifie des invariants strictement structurels : schémas ; unicité et stabilité des identifiants ; compteurs monotones ; aucun identifiant disparu ; filiation connue ; ordre unique par phase ; dépendances uniquement vers l'amont ; règles de preuve ; append-only comparé aux archives ; cohérence des acceptations ; `realizes`, lots transversaux et unités orphelines ; fraîcheur du bloc généré ; concordance des titres ; cohérence des versions.

Il ne juge jamais la pertinence d'une priorité, la complétude du backlog, l'utilité d'une tâche, la nécessité d'un agent, ni si un résultat est réellement démontré.

## 14. Compatibilité

La voie d'urgence repose sur la métadonnée structurée `unplanned_urgent: true` de l'unité, jamais sur une phrase de `source_request` — une formulation négative ne doit pas pouvoir valoir autorisation.

Le Doctor accepte `schema_version: 1` (schéma gelé `backlog.v1.schema.json`, contrôles v1, avertissement de migration **jamais bloquant**) et `schema_version: 2`. La migration est explicite (`ai-project backlog migrate`), archivée, et n'invente jamais une phase, une tâche, un `realizes`, une preuve ou une acceptation.
