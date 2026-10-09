# Oddy-opslag

En lille webapp til museer og konservatorer: Indtast data om et materiale, og sammenlign det med resultater af Oddy-test. Er materialet testet, vises resultatet direkte. Er det ikke testet, finder appen de testede materialer, der ligger tættest på, med en lighedsscore og en opdeling pr. felt.

## Kom i gang

Appen er ren HTML, CSS og JavaScript uden build-trin.

- **Lokalt:** Åbn `index.html` i en browser. Du kan også køre `npm start` og gå til <http://localhost:8000>.
- **Online:** Slå GitHub Pages til for repoet (Settings → Pages → branch `main`, mappe `/`).

Første gang indlæses **eksempeldata**. Posterne er illustrative og **ikke rigtige testresultater**. Erstat dem med jeres egne data under *Import og eksport*.

## Adgangskodebeskyttelse

Hele sitet kan låses med en fælles adgangskode. Beskyttelsen kører på serveren, så ingen kan komme uden om den ved at se kildekoden. Den kræver en **Apache-server med PHP 8 og mod_rewrite**, som de fleste danske webhoteller har.

1. Åbn `lav-adgangskode.html` på din egen computer (dobbeltklik), skriv en adgangskode og tryk *Lav kode*. Koden forlader ikke din computer.
2. Indsæt resultatet i `_auth/config.php` ved `adgangskode_hash`. Her kan du også ændre sitets navn og hvor længe man bliver logget ind.
3. Upload hele mappen til serveren, **inklusive den skjulte fil** `.htaccess`.
4. **Test:** Åbn adressen i et privat vindue. Du skal se login-siden. Prøv også `din-adresse/css/style.css` og `din-adresse/_auth/config.php`. Begge skal sende dig til login eller give en fejl. Hvis du kan se indholdet, bliver `.htaccess` ikke læst. Bed så webhotellet slå `AllowOverride All` til.

Skift adgangskode ved at lave en ny kode og erstatte linjen i `config.php`. Efter 5 forkerte forsøg spærres IP-adressen i 15 minutter (ændres i `config.php`). Man logger ud via *Log ud* øverst på siden. Ligger sitet i en undermappe og virker det ikke, så følg kommentaren om `RewriteBase` i `.htaccess`.

`lav-adgangskode.html` indeholder ingen hemmeligheder, men behøver ikke ligge på serveren. Slet den gerne derfra.

## Funktioner

- **Tjek materiale:** Beskrivelse, kategori, sammensætning, producent, produktnavn og nøgleord.
- **Direkte match:** Samme produktnavn, og samme producent hvis den er angivet begge steder. Store og små bogstaver, tegnsætning og accenter ignoreres.
- **Nærmeste materiale:** En vægtet lighedsscore på de felter, du har udfyldt:

  | Felt | Vægt | Metode |
  |---|---|---|
  | Produktnavn | 30 % | Tegn-trigrammer (tåler stavevarianter og varenumre) |
  | Sammensætning | 25 % | Ord-overlap med synonymer (PE = polyethylen = polyethylene) |
  | Kategori | 20 % | Eksakt, ellers delvis ord-lighed |
  | Producent | 15 % | Tegn-trigrammer |
  | Nøgleord og beskrivelse | 10 % | Andel af ordene, der findes i materialets tekst |

  Materialer under 15 % lighed vises ikke.
- **Mine materialer:** Gem indtastede materialer. Deres bedste match beregnes igen, når databasen ændres. Listen kan eksporteres som CSV.
- **Testdatabase:** Tilføj, redigér, slet og filtrér testresultater med P/T/U for sølv, kobber og bly. Mangler en samlet vurdering, bruges den dårligste kupon.
- **Import og eksport:** CSV (komma, semikolon eller tab) eller JSON, med danske eller engelske kolonnenavne. Eksporten bruger semikolon, så filen åbner direkte i dansk Excel.

Alle data gemmes i browserens `localStorage` og forlader aldrig computeren. Eksportér jævnligt, hvis I vil sikre eller dele data.

## CSV-format

```
materiale;kategori;sammensaetning;producent;produkt;soelv;kobber;bly;samlet;kilde;dato;noter;noegleord
Polyesterfilt;Tekstil;polyester;Firma;Produkt X;P;P;P;;Eget lab;2025-03-01;;montre
```

Kolonnerne genkendes også på engelsk (`material`, `manufacturer`, `product`, `silver`, `copper`, `lead`, `overall` …). Værdier som `pass`, `temporary` og `fail` oversættes til P, T og U.

## Filer

```
index.html            Brugerflade
.htaccess             Sender alle forespørgsler gennem adgangskontrollen
_auth/                Login, adgangskontrol og indstillinger (PHP)
lav-adgangskode.html  Laver adgangskode-hash til _auth/config.php
css/style.css         Styling (lyst og mørkt tema)
js/matcher.js         Matching og lighedsscore (ingen DOM, testbar)
js/data.js            CSV/JSON-import og -eksport (ingen DOM, testbar)
js/app.js             Brugerflade-logik og lagring
data/eksempeldata.js  Illustrative eksempeldata
test/                 Tests (node --test)
```

## Tests

```
npm test
```

## Forbehold

Et nærmeste match er en indikation, ikke et testresultat. Tilsætningsstoffer, farve, hærdning og produktionsparti kan ændre resultatet. Test altid selv et materiale, før det bruges tæt på genstande.
