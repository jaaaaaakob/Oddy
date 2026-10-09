# Oddy-opslag

En lille webapp til museer og konservatorer: Indtast data om et materiale, og sammenlign det med resultater af Oddy-test. Er materialet testet, vises resultatet direkte. Er det ikke testet, finder appen de testede materialer, der ligger tættest på, med en lighedsscore og en opdeling pr. felt.

## Kom i gang

Appen er ren HTML, CSS og JavaScript uden build-trin.

- **Lokalt:** Åbn `index.html` i en browser. Du kan også køre `npm start` og gå til <http://localhost:8000>.
- **Online:** Slå GitHub Pages til for repoet (Settings → Pages → branch `main`, mappe `/`).

Første gang indlæses **eksempeldata**. Posterne er illustrative og **ikke rigtige testresultater**. Erstat dem med jeres egne data under *Import og eksport*.

## Adgangskode

Siderne låses med en fælles adgangskode, der tjekkes i browseren. Det virker på alle webhoteller, men er **en forhindring og ikke rigtig sikkerhed**: Indholdet ligger stadig på serveren, og den, der kan læse kildekoden eller kender adressen på en fil, kan hente den uden login. Brug den ikke til følsomme oplysninger.

1. Åbn `lav-adgangskode.html` på din egen computer (dobbeltklik), skriv en adgangskode og tryk *Lav kode*. Koden forlader ikke din computer.
2. Åbn `adgang.js` i en teksteditor og indsæt resultatet ved `HASH` øverst i filen. Her kan du også ændre sitets navn.
3. Sæt denne linje som den første i `<head>` på hver side, der skal låses (`index.html` har den allerede):

   ```html
   <script src="adgang.js"></script>
   ```

   Ligger siden i en undermappe, så ret stien, f.eks. `../adgang.js`.
4. Upload `adgang.js` og siderne til serveren. Åbn adressen i et privat vindue og tjek, at login-siden vises.

Man bliver logget ind, til fanen lukkes, eller i 30 dage, hvis man vælger *Husk mig på denne enhed*. Et link med `data-adgang-logud` logger ud (se *Log ud* øverst i `index.html`). Skifter du adgangskode, bliver alle logget ud. Siden skal åbnes via https (eller localhost).

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
adgang.js             Adgangskode til siderne (indstillinger øverst)
lav-adgangskode.html  Laver adgangskode-kode til adgang.js
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
