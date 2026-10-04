# Relais de rendez-vous

Relais de rendez-vous est une API HTTP qui expose les créneaux libres d'un cabinet pour qu'un site de réservation les affiche.

**Statut : version 0.4, en test interne.** Aucune instance publique n'est annoncée.

## Fonctionnalités

- Liste des créneaux libres au format JSON, protégée par un jeton.
- Référence des routes : [docs/api.md](docs/api.md).

## Limites et données

- Les rendez-vous sont conservés dans une base PostgreSQL désignée par `DATABASE_URL` ; l'API ne gère pas encore la création de rendez-vous.
- Un seul jeton partagé (`API_TOKEN`) : pas de comptes individuels.

## Stack et prérequis

- Node.js 22 ou supérieur, sans framework HTTP.
- pnpm 10 (voir `packageManager`), PostgreSQL accessible.

## Configuration

Copier l'exemple puis renseigner les valeurs, sans les versionner :

```bash
cp .env.example .env
```

| Variable | Rôle |
|---|---|
| `PORT` | Port HTTP local (3000 par défaut). |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL. |
| `API_TOKEN` | Jeton attendu dans `Authorization: Bearer`. |

## Commandes

```bash
pnpm install
pnpm dev          # redémarre à chaque modification
pnpm test         # tests du calcul des créneaux
pnpm start
```

## Architecture et tests

- `src/server.js` : serveur HTTP et contrôle du jeton.
- `src/creneaux.js` : calcul des créneaux, testé dans `tests/`.

## Sécurité

Signalement confidentiel : voir [SECURITY.md](SECURITY.md).

## Licence

Apache License 2.0, voir [LICENSE](LICENSE).
