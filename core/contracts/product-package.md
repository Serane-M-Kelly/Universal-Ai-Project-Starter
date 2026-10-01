# Contrat d'import d'un product-package

## Objectif

Recevoir un dossier de recherche et de conception produit sans confondre son import, son interprétation et son approbation. Le product-package reste la preuve source ; le brief du workspace reste la source de vérité du produit après revue humaine.

Le CLI prend en charge `project-architect-product-package` version 1, validé par `core/schemas/product-package.schema.json`.

## Conditions d'import

- le manifeste porte `package_status: ready_for_intake` ;
- le nom du projet correspond au workspace ;
- les fichiers canoniques existent et aucun lien symbolique ou secret évident n'est présent ;
- le package n'annonce pas `changes_requested` comme verdict de revue ;
- le brief existant est encore un brouillon ;
- la même identité et version n'ont pas déjà été importées avec un contenu différent.

La commande explicite d'import et le statut du package autorisent la copie dans le workspace. Ils n'autorisent ni l'approbation du brief, ni l'implémentation, ni une action externe.

## Conservation

Chaque version est archivée sans modification dans :

```text
intake/product-package/<package-id>/v<version>/
```

`intake/product-package/registry.yaml` conserve l'identité, la version, l'empreinte, la date et le chemin de chaque import. Une réimportation identique est idempotente. Une version déjà enregistrée avec un contenu différent est bloquée ; il faut produire une nouvelle `package_version`.

## Projections

Le CLI crée des références privées vers les documents propriétaires :

- recherche dans `intake/research/product-package/` ;
- prototype dans `prototype/product-package/` ;
- décisions proposées dans `docs/internal/product-package/` ;
- rapport d'import dans `reports/intake/`.

Ces fichiers de projection ne recopient pas les conclusions. Project Discover lit l'archive canonique, détecte les lacunes et remplit `PROJECT_BRIEF.md` en statut `draft`.

## Conflits et autorité

- Ne jamais fusionner automatiquement `DECISION_LOG.md` avec `docs/decisions.md`.
- Ne jamais modifier un brief approuvé pendant un import.
- Ne jamais présenter une simulation IA comme une validation réelle.
- Signaler une revue absente, une revue avec limites, du matériel synthétique ou une validation réelle absente comme limites visibles.
- Exiger `project-handoff` et une approbation humaine après la consolidation du brief.
