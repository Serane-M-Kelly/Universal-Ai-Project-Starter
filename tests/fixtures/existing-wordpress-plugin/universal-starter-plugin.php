<?php
/**
 * Plugin Name: Universal Starter Fixture
 * Description: Extension minimale utilisée par les tests d'adoption.
 * Version: 1.0.0
 * Requires at least: 6.8
 * Requires PHP: 8.2
 * Text Domain: universal-starter-fixture
 */

defined( 'ABSPATH' ) || exit;

function universal_starter_fixture_title( string $title ): string {
	return sanitize_text_field( $title );
}

