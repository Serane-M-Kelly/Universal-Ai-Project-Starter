# Schémas

Les schémas définissent les données que le CLI peut valider de manière déterministe.

## `project.schema.json`

Valide la configuration mécanique `project.yaml`.

Règles importantes :

- propriétés inconnues refusées ;
- slug normalisé ;
- chemins obligatoires ;
- commandes absentes représentées par `null` ;
- autorité explicite ;
- secrets interdits par contrat ;
- versions présentes pour permettre les migrations.

Les schémas de frontmatter du brief et de l'état seront ajoutés avec le validateur du CLI si leur contrôle ne peut pas rester lisible et simple.

## `profile.schema.json`

Valide le manifeste d'un profil technique : identité, compatibilité, stratégie de commandes, conseils de setup et exigences déterministes. Le schéma v2 permet de limiter un chemin ou un champ JSON à certains modes d'entrée, afin qu'une cible encore vide produise un avertissement tandis qu'un dépôt existant incomplet soit bloqué. Le CLI refuse tout manifeste inconnu ou incohérent avant de créer un projet.

## `adapter.schema.json`

Valide le manifeste d'un adaptateur d'assistant : identité, compatibilité, lancement, destinations natives des skills et agents, dossiers et sorties. Les références d'adaptateurs inscrites dans `project.yaml` sont versionnées.

## `skill-catalog.schema.json`

Valide le catalogue des skills universels : identité, version, source et compatibilité avec les modes d'entrée et profils. Le contenu procédural reste la propriété de `SKILL.md` et n'est pas dupliqué dans le catalogue.

## `agent-catalog.schema.json` et `agent.schema.json`

Valident le catalogue conditionnel et chaque contrat d'agent : identité, activation, compatibilité, accès techniques et limites d'autorité. Les instructions longues restent dans `instructions.md` afin que l'utilisatrice puisse les rédiger sans dupliquer le manifeste.

## `product-package.schema.json`

Valide le manifeste versionné transmis par Project Architect : identité, stade, preuve, prototype, revue, confidentialité et noms canoniques des documents. Les fichiers Markdown restent lisibles et modifiables dans l'environnement de recherche ; le CLI vérifie leur présence, les archive sans les réécrire et refuse les liens symboliques, secrets évidents ou versions conflictuelles.
