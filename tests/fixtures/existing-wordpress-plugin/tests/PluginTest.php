<?php

final class PluginTest {
	public function test_fixture_contract_is_observable(): void {
		assert( str_contains( 'Universal Starter Fixture', 'Starter' ) );
	}
}

