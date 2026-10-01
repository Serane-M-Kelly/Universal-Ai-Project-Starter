# Profil Node/API TypeScript

Ce profil couvre un service HTTP Node.js écrit en TypeScript. Il reste indépendant du framework, du fournisseur de base de données et de la plateforme de déploiement.

## Quand l'utiliser

- API REST, RPC ou service HTTP ;
- backend d'une application web ou mobile ;
- webhook, service d'intégration ou petit microservice ;
- dépôt existant qui possède déjà son propre choix de framework.

## Contrat minimal

Le projet doit pouvoir démontrer six commandes : installation, développement, lint, typage, tests et build. Il doit converger vers :

```text
package.json
tsconfig.json
src/
tests/
.env.example
README.md
```

Le champ `engines.node` de `package.json` documente explicitement la ligne Node ciblée. Son absence est un avertissement pendant la création et un blocage pour un dépôt adopté.

Le contrat expose également au skill `project-setup` des résultats sémantiques : démarrage et arrêt propres, endpoint de santé testé, configuration validée, erreurs HTTP stables et contrôles reproductibles. Ces résultats orientent le setup, tandis que `doctor` reste limité aux faits contrôlables mécaniquement.

`package.json`, `tsconfig.json` et `src/` sont des objectifs signalés par avertissement pendant une création encore vide. Ils deviennent bloquants lorsqu'un dépôt existant prétend déjà relever de ce profil. Le dossier de tests, la documentation et le modèle d'environnement restent des avertissements afin de tolérer des conventions équivalentes.

## Commandes

Pour un nouveau projet, le profil inscrit les conventions npm suivantes comme cible de setup :

```text
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
```

Pour une adoption, le CLI lit le `package.json` réel et détecte aussi pnpm, Yarn ou Bun. Une commande obligatoire absente devient `null` et bloque `doctor` au lieu d'être inventée.

## Hors périmètre

Le profil ne choisit pas Express, Fastify, NestJS, Hono, une base de données, un système d'authentification, Docker ou une cible cloud. Ces décisions appartiennent au brief, à l'architecture et au setup du projet.
