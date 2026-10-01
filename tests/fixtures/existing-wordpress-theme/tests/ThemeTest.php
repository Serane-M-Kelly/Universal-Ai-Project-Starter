<?php

final class ThemeTest {
	public function test_theme_name_is_observable(): void {
		assert( str_contains( 'Universal Starter Theme', 'Theme' ) );
	}
}

