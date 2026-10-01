# Contrat des agents universels

## Objectif

Un agent porte une responsabilité isolée dans un contexte séparé. Il ne remplace ni le workflow d'un skill, ni l'autorité humaine, ni un contrôle déterministe.

Le projet conserve une seule source modifiable :

```text
ai-workspace/agents/<agent-id>/
├── agent.yaml
└── instructions.md
```

Le CLI la traduit vers `.codex/agents/<agent-id>.toml` et `.claude/agents/<agent-id>.md`. Ces copies sont générées et ne doivent pas être modifiées directement.

## Activation

Aucun agent n'est installé par défaut. `agent add` active explicitement un agent du starter. `agent create` prépare une source personnelle désactivée ; l'utilisatrice la rédige puis passe `enabled: true` avant `agent sync`.

## Autorité

Un agent ne peut jamais :

- approuver un brief ;
- accepter une unité de travail ;
- autoriser une livraison ;
- élargir son propre périmètre ou ses outils ;
- recevoir plus d'autorité que la conversation principale et `project.yaml`.

Les restrictions natives complètent les instructions mais ne remplacent pas les politiques du projet. Les permissions du parent ou de la plateforme peuvent rester prioritaires ; toute action sensible doit donc aussi être interdite ou bornée dans le contrat et les instructions.

## Agents du noyau

- Builder : écrit dans le code pour une unité approuvée et s'arrête à `ready_for_review`.
- Independent Reviewer : travaille en lecture seule depuis un contexte frais et produit des constats sans correction.

Les deux fonctions restent séparées. Le résultat du Builder n'est pas transmis comme conclusion au Reviewer ; seules les matières premières nécessaires lui sont données.

## Agents personnels

La source d'un agent créé par l'utilisatrice est `user-owned`. Une mise à jour du starter ne la remplace jamais. La synchronisation refuse d'écraser une copie native modifiée séparément sauf demande `--force` explicite.

## Granularité des recommandations

Une recommandation d'agent se formule au niveau d'une **phase** (`PH-N`) ou d'un **résultat** (`BLG-NNN`), jamais d'une tâche : le schéma de `docs/agent-strategy.md` n'admet pas le motif `TSK-`. Recommander un agent par micro-tâche est donc structurellement impossible.

Le Builder intervient sur une unité `WORK-NNN` déjà approuvée, dans le périmètre exact de ses `realizes`. L'Independent Reviewer n'intervient que lorsque le risque, la sécurité ou l'importance du résultat le justifient.

Aucun agent ne peut valider une tâche `category: human` : le Doctor exige une preuve `observation` portant le nom d'une personne. Les vérifications physiques et les décisions produit restent humaines, et doivent figurer dans la section « Responsabilités volontairement sans agent ».
