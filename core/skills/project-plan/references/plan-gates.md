# Portes du plan

Utiliser cette référence pour le verdict de phase, les quatre catégories de changement, les règles de preuve et la procédure de travail urgent non planifié. Le contrat complet est `core/contracts/planning.md`.

## Machine d'état du plan

| Verdict | Condition d'entrée | Autorité de transition |
|---|---|---|
| `PLAN_DRAFT` | rédaction en cours des deux documents | assistant |
| `READY_FOR_PLAN_APPROVAL` | aucun constat bloquant, `ai-project doctor` sans blocage | assistant |
| `CHANGES_REQUIRED` | correction ou clarification demandée par la personne humaine | personne humaine |
| `PLAN_READY` | `taches/BACKLOG.md` et `docs/agent-strategy.md` tous deux `status: approved`, identité et date valides, aucun lien historique non converti | personne humaine |
| `BLOCKED` | socle non prêt, brief non approuvé, ou blocage `doctor` | atteignable depuis n'importe quel état |

`PLAN_READY` exige d'inscrire `plan_version` dans `PROJECT_STATE.md` avec le `backlog_version` approuvé — c'est ce champ, et non une mention en prose, qui fait foi pour le Doctor.

`PLAN_READY` est également refusé tant qu'un `legacy_work_items` subsiste sans `realizes` correspondant : approuver un plan dont les liens opérationnels sont provisoires reproduirait l'ambiguïté que la migration corrige. La route `legacy-link-conversion` de `project-work` lève ce blocage sans exiger `PLAN_READY` au préalable.

## Obligation selon le mode d'entrée

| Mode | `project-plan` | Effet sur `project-work` |
|---|---|---|
| `idea` | obligatoire après `project-setup` | refuse de démarrer une unité sans `PLAN_READY`, sauf urgence ou conversion de liens historiques |
| `brief` | obligatoire après `project-setup` | idem |
| `existing` | optionnel | aucune exigence nouvelle |
| `maintenance` | optionnel | aucune exigence nouvelle ; une mission bornée reste sa propre autorisation |

## Les quatre catégories de changement

| | Changement substantiel | Préparation de phase | Élaboration opérationnelle | Régénération de vue |
|---|---|---|---|---|
| Exemples | nouveau résultat ; modification du résultat, du périmètre, de la phase, d'une dépendance, de la priorité ou du caractère obligatoire ; nouvelle exigence de sécurité ; changement des critères généraux ; découpage d'un `BLG` ; réouverture d'un résultat accepté ; rendre optionnelle une tâche obligatoire abandonnée | passage de `BLG` de `candidate` à `ready` par ajout de leurs `TSK`, sans toucher résultat, phase, dépendances, priorité, caractère obligatoire ni critères | `TSK` technique découverte pendant un `WORK` approuvé, dans le **même** `BLG`, sans effet sur le résultat, la sécurité, les critères ni le périmètre autorisé | `ai-project backlog sync-view` après l'une des trois |
| `backlog_version` | **incrémentée** | inchangée | inchangée | inchangée |
| Approbation du plan | **effacée, à refaire** | conservée | conservée | conservée |
| Trace | archive v2 dans `docs/internal/backlog-history/` + décision ; `ai-project backlog revise` applique l'incrément de version | `phases[].prepared_by` / `prepared_at` | `origin: discovered`, `source_work`, `origin_reason`, `added_at`, mention dans le rapport d'unité | aucune |
| Autorité | personne humaine | confirmation humaine légère, fusionnable avec l'approbation du premier `WORK` de la phase | exécutant de l'unité approuvée | aucune |

**Régénérer la vue n'est jamais un changement substantiel** et n'affecte jamais `status`, `approved_by`, `approved_at` ni `backlog_version`. Sans cette règle, chaque coche invaliderait l'approbation du plan.

En cas de doute entre substantiel et élaboration, traiter comme substantiel.

## Règles de preuve

Une tâche n'est terminée que par une preuve **actuellement valable** dans son `evidence_log`.

| Règle |
|---|
| Une seule entrée `state: valid` par tâche ; c'est elle, et elle seule, qui rend la tâche terminée. |
| Une entrée `superseded` ou `invalidated` exige un motif (`state_reason`) et une date (`state_at`). |
| Le journal est **append-only dans le workflow géré** : une réouverture écarte l'entrée courante (`superseded` ou `invalidated`), elle ne la supprime jamais, et une nouvelle preuve reçoit un nouvel identifiant `EV-NNN`. |
| Toute date est une date calendaire réelle ; toute identité humaine est réellement renseignée. |
| `kind: observation` exige un `observed_by` nommé. |
| `kind: report`, `document` ou `decision` exige un chemin existant dans le workspace. |
| `kind: commit` exige une empreinte Git. |
| **`category: human` + terminée ⇒ la preuve valable doit être une `observation`.** Aucun agent ne peut cocher une vérification physique. |
| Une tâche `blocked` porte une raison ; une tâche `dropped` porte une décision, une personne et une date. |
| Une tâche obligatoire `dropped` continue de bloquer le résultat jusqu'à une décision substantielle qui la rend optionnelle ou retire l'exigence. |

## Progression

- **Construction** : tâches obligatoires terminées / tâches obligatoires, sur les résultats actifs.
- **Résultats** : résultats obligatoires actifs acceptés / résultats obligatoires actifs.
- `deferred` et `retired` sortent des dénominateurs mais restent affichés avec leur état.
- Aucun pourcentage d'effort n'est jamais calculé : uniquement des comptes d'actions et de résultats.

## États de phase

| État dérivé | Condition |
|---|---|
| `retired` | `disposition: retired` |
| `empty` | aucun résultat actif — avertissement en brouillon, **bloquant à l'approbation** |
| `optional` | des résultats actifs, mais aucun obligatoire — **jamais `complete` à 0/0** |
| `complete` | tous les résultats obligatoires actifs sont acceptés |
| `in_progress` | au moins une tâche terminée, **ou** une unité active sur la phase |
| `not_started` | sinon |

## Travail urgent non planifié

Une personne humaine peut autoriser un `WORK-NNN` hors backlog en cas d'urgence, sans attendre `PLAN_READY`. Conditions :

1. la demande reste actuelle, claire et bornée (même barre qu'un `WORK-NNN` ordinaire) ;
2. l'unité porte `unplanned_urgent: true` — métadonnée structurée, jamais une phrase — et `source_request` documente l'autorité ;
3. `PROJECT_STATE.md` signale l'urgence et le backlog non réconcilié ;
4. **le backlog doit être réconcilié avant l'approbation du prochain travail non urgent** : créer ou rattacher rétroactivement un résultat et ses tâches, avec phase, ordre, priorité réels, puis renseigner `realizes` sur l'unité urgente.

Cette procédure ne suspend jamais l'approbation individuelle de l'unité.

## Ce que le Doctor vérifie, et ce qu'il ne vérifie pas

Il contrôle : schémas et frontmatter ; unicité, format, compteur strictement supérieur au maximum utilisé, références existantes et filiations cohérentes ; ordre unique par phase et dépendances uniquement vers l'amont ; règles de preuve ci-dessus ; cohérence du journal de preuves dans l'état courant ; cohérence des acceptations ; liens `realizes`, lots transversaux et unités orphelines ; fraîcheur du bloc généré ; cohérence des versions entre backlog et stratégie.

Il ne décide jamais : si un résultat mérite `P0`, si le backlog est assez complet, si une tâche est pertinente, si un agent est nécessaire, ni si un résultat est réellement démontré — cette dernière décision appartient à la personne qui l'accepte.

## Modèle de confiance

**Garanti :** cohérence de l'état courant ; atomicité des commandes du starter ; aucune perte silencieuse en migration ; préservation exacte du récit et du frontmatter ; archive avant toute évolution substantielle du workflow officiel ; diagnostics distincts pour absent, illisible, frontmatter invalide, schéma invalide.

**Non garanti :** la résistance à une modification ou suppression volontaire et coordonnée du backlog, de ses archives, de ses compteurs, de ses preuves et de ses fichiers de gouvernance. Tout mécanisme placé dans le workspace reste modifiable par la même autorité.

> **Mode haute intégrité (hors v0.14.0).** Un historique infalsifiable nécessite une frontière externe — dépôt Git local privé ou stockage transactionnel. Il ne fait pas partie de la v0.14.0.

## Évolution substantielle : `ai-project backlog revise`

1. valider intégralement l'état courant ;
2. archiver cet état, en **création exclusive**, dans `docs/internal/backlog-history/BACKLOG-v<N>.md` ;
3. incrémenter `backlog_version`, repasser en `draft`, effacer l'approbation ;
4. régénérer la vue ;
5. valider le résultat.

Récupérable après interruption : archive identique = reprise, archive différente = blocage, jamais d'écrasement. Ces archives sont un **historique de workflow**, pas une preuve infalsifiable.
