# Carnet de randonnée

Carnet de randonnée est un petit site qui estime la durée d'une randonnée à partir de sa distance et de son dénivelé, pour préparer une sortie à la journée.

**Statut : version 1.2, utilisée en local.** Aucune adresse publique n'est encore ouverte.

## Fonctionnalités

- Estimation de durée : 4 km/h sur le plat et 300 m de dénivelé positif par heure.
- Liste de randonnées favorites conservée dans le navigateur.

## Limites et données

- L'estimation ne tient compte ni des pauses, ni du terrain, ni de la météo.
- Les favoris sont enregistrés dans le `localStorage` du navigateur utilisé ; ils ne sont pas synchronisés entre appareils et disparaissent si les données du site sont effacées.

## Stack et prérequis

- [Vite](https://vite.dev) 7, JavaScript sans framework.
- Node.js 22 ou supérieur, npm.

## Commandes

```bash
npm ci            # installer les dépendances du verrou
npm run dev       # serveur de développement
npm test          # tests de l'estimation
npm run build     # site statique dans dist/
npm run preview   # servir dist/ localement
```

## Architecture et tests

- `src/duree.js` : calcul de l'estimation, testé par `tests/duree.spec.js`.
- `src/main.js` : affichage et favoris.

Détails : [architecture](docs/architecture.md). Voir aussi les [limites](#limites-et-données).

## Crédits et licences

- **Police** : Inter, sous SIL Open Font License 1.1 ; texte de licence dans [`public/fonts/OFL-Inter.txt`](public/fonts/OFL-Inter.txt).
- **Code** : licence MIT, voir [LICENSE](LICENSE).
