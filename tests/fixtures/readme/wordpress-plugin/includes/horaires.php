<?php
function horaires_ouverture_rendu(): string {
    $horaires = get_option('horaires_ouverture', []);
    return '<ul class="horaires">' . implode('', array_map(fn($l) => '<li>' . esc_html($l) . '</li>', $horaires)) . '</ul>';
}
