# Profil WordPress

Ce profil couvre trois unités de travail distinctes : un site WordPress complet, une extension et un thème classique ou bloc. `project-setup` doit choisir l'une de ces formes avant de générer une structure.

## Reconnaissance

- site complet : présence de `wp-includes/version.php` et de la déclaration interne de version ;
- extension : fichier PHP principal contenant au minimum `Plugin Name:` ;
- thème : `style.css` contenant au minimum `Theme Name:` ;
- outillage : scripts Composer et Node détectés, combinés lorsqu'ils couvrent tous deux une même porte qualité ;
- tests : configuration PHPUnit ou fichiers `*Test.php` et `*Tests.php`.

Les dossiers générés ou tiers comme `vendor`, `node_modules`, `build`, `dist`, `coverage` et `.cache` ne constituent jamais une preuve. Les liens symboliques ne sont pas suivis.

`wp-config.php` n'est volontairement pas obligatoire. Un dépôt peut le générer par environnement, le conserver hors de la racine web ou utiliser une autre composition. S'il existe, il ne doit contenir aucun secret versionné.

## Commandes

Pour une création, aucune commande n'est inventée avant le choix de l'environnement local. Pour une adoption ou une maintenance, lint et tests sont exigés. Le CLI détecte les scripts correspondants dans `composer.json` et `package.json` ; lorsqu'un projet possède les deux chaînes d'outils, les contrôles courts sont combinés avec arrêt au premier échec.

`project-setup` peut retenir `@wordpress/env`, WordPress Playground, Docker ou l'outil déjà utilisé par le projet. Le choix doit préciser les versions de WordPress et PHP, la base de données, la persistance, les ports, les données de test et la politique de destruction de l'environnement.

## Sources de conception

- [En-tête principal d'une extension](https://developer.wordpress.org/plugins/plugin-basics/header-requirements/)
- [Feuille de style principale d'un thème](https://developer.wordpress.org/themes/core-concepts/main-stylesheet/)
- [Principe de non-modification du cœur](https://developer.wordpress.org/plugins/intro/)
- [Sécurité des API WordPress](https://developer.wordpress.org/apis/security/)
- [Standards PHP WordPress](https://developer.wordpress.org/coding-standards/wordpress-coding-standards/php/)
- [Environnement local wp-env](https://developer.wordpress.org/block-editor/reference-guides/packages/packages-env/)
- [Durcissement et wp-config.php](https://developer.wordpress.org/advanced-administration/security/hardening/)
