# Horaires d'ouverture

Extension WordPress qui affiche les horaires d'un commerce avec le shortcode `[horaires]`, pour les sites vitrines qui veulent une source unique de leurs horaires.

**Statut : version 2.1, utilisée sur des sites de clients.** Non distribuée sur WordPress.org.

## Fonctionnalités

- Shortcode `[horaires]` rendant une liste échappée des horaires enregistrés.
- Horaires lus dans l'option WordPress `horaires_ouverture`.

## Limites et données

- Pas encore d'écran de réglage : l'option se renseigne par WP-CLI ou par code.
- Les horaires sont stockés dans la table des options du site ; aucune donnée n'est envoyée à un service externe.

## Prérequis

- WordPress 6.4 ou supérieur, PHP 8.1 ou supérieur.
- Composer pour les tests uniquement.

## Installation et commandes

Copier le dossier dans `wp-content/plugins/horaires-ouverture`, puis :

```bash
wp plugin activate horaires-ouverture
wp option update horaires_ouverture '["Lun–Ven 9 h–18 h","Sam 9 h–12 h"]' --format=json
composer install   # dépendances de test
composer test      # PHPUnit
```

## Architecture et tests

- `horaires-ouverture.php` : en-tête de l'extension et enregistrement du shortcode.
- `includes/horaires.php` : rendu.
- `tests/` : tests PHPUnit.

## Licence

GPL-2.0-or-later, comme WordPress ; texte dans [LICENSE](LICENSE).
