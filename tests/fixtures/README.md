# Fixtures

Ces dossiers représentent des entrées stables et réalistes pour la suite de tests :

- `existing-node-app` : petite application Node autonome avec toutes les commandes détectables ;
- `existing-monorepo` : application web imbriquée dans un dépôt à workspaces ;
- `existing-node-api` : service HTTP TypeScript sans framework conforme au profil `node-api` ;
- `existing-nextjs-app` : application Next.js TypeScript App Router conforme au profil `nextjs` et utilisée aussi pour vérifier Pages Router ;
- `existing-swiftui-xcode` : application SwiftUI dans un projet Xcode au nom variable ;
- `existing-swiftui-package` : application SwiftUI macOS décrite par `Package.swift` ;
- `existing-wordpress-site` : site WordPress sans `wp-config.php` versionné ;
- `existing-wordpress-plugin` : extension WordPress avec outils Composer et Node combinés ;
- `existing-wordpress-theme` : thème bloc WordPress avec chaîne Node ;
- `domain-expert-agent` : agent personnel valide, non technique et en lecture seule ;
- `invalid-agent` : manifeste volontairement dangereux que le schéma doit refuser.
- `product-package-ready` : dossier Project Architect v1 complet, relu et prêt pour un import déterministe ;
- `codex-native-023` : fichiers Codex générés par la 0.23.0 (`{{CODE_ROOT}}` à la place du chemin), référence octet par octet de la 0.24.
- `workspace-v024` : extrait d'un workspace produit par le runtime 0.24.0 d'origine (brief, plan, contrôle et observation synthétiques, sans inventaire détaillé) et le schéma 0.24 correspondant, pour la compatibilité de la 0.25 ; `.starter/runtime` ne contient que son `package.json`.
- `runtime-v024/` : runtime 0.24.0 d'origine (JavaScript compilé, `core`, `profiles`, `adapters`, `package.json`, sans dépendances) ; les tests de `runtime-upgrade` lui ajoutent ajv et yaml puis l'utilisent pour créer de vrais workspaces 0.24.
- `readme/` : trois produits (site statique, API avec variables d'environnement, extension WordPress sous GPL) et leur README rédigé selon `core/contracts/product-readme.md`, utilisés par `readme-check`.

Les tests copient toujours les fixtures dans un dossier temporaire avant de les modifier. Les originaux restent immuables.
