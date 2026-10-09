<?php
// Indstillinger for adgangskodebeskyttelsen.
// Filen kan ikke hentes udefra (se .htaccess i denne mappe).

return [
    // Vises på login-siden.
    'site_navn' => 'Oddy-opslag',

    // Din adgangskode som hash. Lav den med lav-adgangskode.html (åbnes på
    // din egen computer), og indsæt resultatet mellem citationstegnene.
    // Er feltet tomt, kan ingen logge ind.
    'adgangskode_hash' => '',

    // Automatisk logud efter så mange minutters inaktivitet.
    'timeout_minutter' => 120,

    // Spærring mod gætteri: så mange forkerte forsøg fra samme IP-adresse ...
    'max_forsog' => 5,
    // ... giver så mange minutters pause.
    'laas_minutter' => 15,
];
