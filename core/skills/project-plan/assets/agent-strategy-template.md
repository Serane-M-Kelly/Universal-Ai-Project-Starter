---
schema_version: 1
strategy_version: 1
status: draft
approved_by: null
approved_at: null
source_backlog_version: 1
entries:
  - id: STR-001
    covers: [PH-1]
    mode: main_conversation
    agent_id: null
---

# Stratégie d'agents — [Nom du projet]

Ce document recommande un mode d'exécution par responsabilité. Il n'installe, ne crée ni n'active aucun agent : `project.yaml.agents` reste la seule source des agents réellement installés. Les champs mutables (couverture, mode, identifiant proposé) sont propriétaires du frontmatter ci-dessus.

`covers` désigne des **phases** (`PH-N`) ou des **résultats** (`BLG-NNN`). Couvrir une phase est le choix par défaut ; ne descendre au résultat que lorsqu'un résultat précis mérite un mode différent. Le schéma n'admet pas les identifiants `TSK-NNN` : aucun agent ne peut être recommandé pour une micro-tâche.

Le niveau `WORK` n'est pas une valeur de `covers` : il s'exprime dans le champ « Moment d'intervention » — un Builder intervient sur une unité déjà approuvée, jamais sur un résultat en général.

## STR-001 — [Titre de la responsabilité]

- **Compétence nécessaire :** [connaissance ou capacité requise]
- **Justification :** [pourquoi ce mode plutôt qu'un autre]
- **Moment d'intervention :** [sur un WORK-NNN approuvé couvrant ces phases ou résultats]
- **Entrées autorisées :** [WORK-NNN approuvé, chemins précis]
- **Capacité :** [lecture seule / modification bornée au périmètre transmis]
- **Livrable attendu :** [ce que produit cette responsabilité]
- **Condition d'arrêt :** [ce qui met fin à l'intervention]
- **Limites d'autorité :** [ne peut ni approuver, ni accepter, ni livrer]
- **Rôle humain indispensable :** [décision ou vérification qu'aucun agent ne remplace]

## Responsabilités volontairement sans agent

Cette table doit couvrir explicitement **toutes les tâches de catégorie `human`** du backlog : une vérification physique ou un jugement humain n'est jamais délégué, et le Doctor refuse mécaniquement de les valider autrement que par une preuve `observation` avec observateur nommé.

| Responsabilité | Pourquoi aucun agent | Où vit la connaissance |
|---|---|---|
| Tâches `category: human` ([TSK-NNN, …]) | vérification physique ou jugement réservé à une personne | personne nommée, preuve `observation` |
| Acceptation du résultat de chaque `BLG` | acte humain par définition | `outcome_accepted_by` / `outcome_accepted_at` |
| [responsabilité] | [connaissance réutilisable, non isolable ou non récurrente] | [skill ou profil concerné] |
