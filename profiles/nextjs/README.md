# Profil Next.js TypeScript

Ce profil transforme le starter universel en cible de travail pour une application Next.js écrite en TypeScript, sans générer arbitrairement une version du framework ou une architecture métier.

## Ce qu'il reconnaît

- App Router : `app/` ou `src/app/` ;
- Pages Router : `pages/` ou `src/pages/` ;
- `next`, `react` et `react-dom` dans `dependencies` ou `devDependencies` ;
- les commandes réellement déclarées dans un projet adopté ;
- l'absence volontaire de `next.config.*`, puisque Next.js n'exige aucun fichier de configuration lorsque les valeurs par défaut suffisent.

Pour un projet neuf, les absences structurelles restent des avertissements : le skill `project-setup` doit d'abord confirmer le routeur, le gestionnaire de paquets, les besoins de rendu, de données et de déploiement avant de créer le produit. Pour un projet existant ou en maintenance, l'absence d'un manifeste TypeScript, d'un arbre de routes, des dépendances Next.js ou d'une commande obligatoire bloque le diagnostic.

Le profil impose des commandes séparées pour le lint, le typage, les tests et le build. Elles constituent le contrat de qualité du starter, même lorsque le générateur officiel de Next.js n'installe pas encore tout ce socle par défaut.

## Sources de conception

- [Installation de Next.js](https://nextjs.org/docs/app/getting-started/installation)
- [Structure d'un projet App Router](https://nextjs.org/docs/app/getting-started/project-structure)
- [Structure d'un projet Pages Router](https://nextjs.org/docs/pages/getting-started/project-structure)
- [Configuration TypeScript](https://nextjs.org/docs/app/api-reference/config/typescript)
- [Configuration Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js)
- [Checklist de production](https://nextjs.org/docs/app/guides/production-checklist)
