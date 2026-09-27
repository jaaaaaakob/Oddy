# Oddy-opslag

En lille webapp til museer og konservatorer: Indtast data om et materiale, og sammenlign det med resultater af Oddy-test. Er materialet testet, vises resultatet direkte. Er det ikke testet, finder appen de testede materialer, der ligger tættest på, med en lighedsscore og en opdeling pr. felt.

## Kom i gang

Appen er ren HTML, CSS og JavaScript uden build-trin.

- **Lokalt:** Åbn `index.html` i en browser. Du kan også køre `npm start` og gå til <http://localhost:8000>.
- **Online:** Slå GitHub Pages til for repoet (Settings → Pages → branch `main`, mappe `/`).

Første gang indlæses **eksempeldata**. Posterne er illustrative og **ikke rigtige testresultater**. Erstat dem med jeres egne data under *Import og eksport*.

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
