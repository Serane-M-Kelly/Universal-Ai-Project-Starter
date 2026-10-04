<?php
/**
 * Plugin Name: Horaires d'ouverture
 * Description: Bloc et shortcode [horaires] affichant les horaires d'un commerce.
 * Version: 2.1.0
 * Requires at least: 6.4
 * Requires PHP: 8.1
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: horaires-ouverture
 */

defined('ABSPATH') || exit;
require_once __DIR__ . '/includes/horaires.php';
add_shortcode('horaires', 'horaires_ouverture_rendu');
