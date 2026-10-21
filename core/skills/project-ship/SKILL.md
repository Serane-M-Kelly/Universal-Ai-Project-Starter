---
name: project-ship
description: "Préparer un commit ou une livraison précise après vérification, fournir les commandes pour exécution manuelle puis distinguer les actions préparées des faits constatés."
---

# project-ship

Sans `.starter/workflow.json`, suivre uniquement [la procédure historique](references/legacy-v014.md).
Avec un suivi v3, appliquer la suite ci-dessous.

Lire `.starter/WORKFLOW.md` et `.starter/runtime/core/contracts/action-authority.md`.
Distinguer la demande de commit d'une publication ou d'un déploiement. Une revue ou
acceptation ne donne pas implicitement mandat pour Ship ; une demande de préparation
n'autorise ni `git commit`, ni `push`, ni déploiement. Si la portée est indécidable,
proposer les opérations sans les exécuter.
Pour un commit, prendre la phase acceptée et le diff actuel ; vérifier les fichiers préexistants,
l'index Git, les preuves et la revue sur cette révision. Choisir explicitement les seuls fichiers
concernés. `workflow prepare-commit NUMERO --path FICHIER --path AUTRE --message TEXTE` génère
les commandes et reports/COMMIT.md. Les transmettre à la propriétaire sans les exécuter.
Après son retour, `workflow verify-commit` constate les fichiers et le contenu du commit réel.
Pour un push/déploiement, définir cible exacte, version acceptée, paramètres, contrôles de régression,
risques restants et retour arrière applicable. Préparer seulement les commandes nécessaires à cette
cible ; les permissions et secrets restent dans leur environnement dédié. Réutiliser une autorisation
antérieure applicable sans la demander à nouveau. Fournir les commandes pour exécution manuelle.
Après exécution, examiner le remote/la cible via les accès autorisés, ou demander la sortie nécessaire.
Enregistrer la preuve externe dans un rapport de livraison : cible, version, observation et limites.
Ne pas annoncer poussé ou déployé si seuls les fichiers ou les commandes sont prêts. Un commit
vérifié ne prouve pas une publication. Ne pas imposer une procédure de déploiement à chaque commit.

## Architecture, données et sécurité selon le risque

Pour une publication ou migration affectant données, accès, secrets ou disponibilité, appliquer
Ship dans `.starter/runtime/core/contracts/architecture-data-security.md`. Préparer les contrôles
sur la cible réelle, les décisions de sauvegarde/migration et le retour arrière approprié ; ne
consigner que les observations effectuées. Un simple commit ne déclenche pas cet audit.

## README du produit, selon la livraison

Avant une publication, vérifier que le README ne décrit pas une fonction, une commande ou un statut démentis par la version livrée ; ajouter l'URL publiée seulement après son observation (`.starter/runtime/core/contracts/product-readme.md`). Un simple commit n'exige pas ce contrôle.

## Visibilité dans la recherche, selon le périmètre

Pour une publication de pages publiques concernées par la recherche, appliquer Ship dans `.starter/runtime/core/contracts/search-visibility.md` : vérifier la configuration sur la cible réellement publiée et consigner les limites dans le rapport de livraison. Prévoir le suivi avec responsable et période d’observation dans le plan existant. Aucun audit SEO complet pour un simple commit, aucune configuration Search Console ni automatisation déclarée faite sans exécution réelle.
