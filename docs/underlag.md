# Underlag och modellbeskrivning

[Till projektets README](../README.md)

Modellen av Avstyckningsvägen 5 är en proceduriell ritningsrekonstruktion. Den bygger på fastighetsspecifika kommunala ritningar från 2007, en måttsatt typritning från 1971 och fasadobservationer i Google Street View från oktober 2022. Historiska ritningar beskriver inte säkert dagens interiör eller senare ändringar.

## Hus och användning

Källare, bottenplan, överplan och tak är separata grupper. De kan visas tillsammans, isoleras eller separeras i höjd. Återställ separationen innan du mäter mellan våningsplan. Bottenplanets golv är modellens höjdnollpunkt, 0,00 m; ett höjdsnitt vid cirka 1,20 m visar bottenplanets dörr- och fönsteröppningar.

Mätverktyget mäter mellan de synliga ytor som du klickar på. Det har inget automatiskt hörnsnäpp. Avståndet påverkas av modellens tolkningar och var punkterna placeras. **Underlag & källor** i appen visar ritningsbilder, antaganden och GLB-export.

## Tomt och höjddata

Kommunens publika kartlager ger VIKSJÖ 2:573 en area på 577,957 m². Husets centrum och riktning följer kartans takkant. Tomtgränsen är kartunderlag och har inte gränsbestämts på plats.

Terrängen använder Lantmäteriets markhöjdmodell med 1 m upplösning. Det sparade utsnittet innehåller 143 × 133 höjdpixlar utan luckor i EPSG:5845, SWEREF99 TM tillsammans med RH2000. Höjderna resamplas till husets vridna koordinatsystem. Utanför tomten visas marken enbart som rutnät eller höjdkurvor.

Mätningen över just tomten gjordes **23 mars 2021**. Rasterfilen uppdaterades 27 februari 2026; det är inte ett nytt skanningsdatum. Bottenplanets höjdläge antas vara **20,10 m RH2000**, utifrån markhöjden 17,648 m framför garageporten och modellens 2,45 m från källare till bottenplan. Höjdpassningen är uppskattad och färdig golvhöjd saknar kontrollmätning.

Se [Lantmäteriets data och proveniens](../research/site/lantmateriet-source-notes.md) och [kommunens tomt- och byggnadsgeometri](../research/site-sources.md).

### Infart och stödmurar

Garageinfarten är lokalt utschaktad med separat beläggning, planteringsmur till vänster och stödmur med vita brädor till höger. Planteringsmuren viker runt mot gatan. Markytorna klipps vid murarnas kanter och ansluter till höjdmodellen mot gatan och bakom murarna.

Geometrin styrs av [markanpassningarna](../research/site/earthworks.json) utifrån [bildgranskningen](../research/site/driveway-evidence.md). Murarnas mått, skymda ändpunkter och marklutningar är fototolkade. Lantmäteriets sparade höjdraster är oförändrat.

### Återskapa terrängen

Appen läser [public/data/site.json](../public/data/site.json), som innehåller lokala meterkoordinater, höjdgrid och källmetadata. Python behövs bara för att bearbeta eller hämta nya data, inte för att köra webbappen. Kör från projektets rot:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r scripts/terrain-requirements.txt
python scripts/build-site-data.py
```

Bygget använder det sparade rasterutsnittet och dess metadata i `research/site/lantmateriet/` och behöver ingen nätanslutning. Skriptet avbryter om DEM-täckning saknas; det byter inte höjdkälla automatiskt. `--without-earthworks` återskapar terrängen utan de lokala infarts- och muranpassningarna. Den tidigare terrängen från kommunens höjdkurvor finns som ett uttryckligt alternativ via `--elevation-source municipal-contours`.

För att hämta ett nytt utsnitt från Lantmäteriet:

```bash
python scripts/fetch-lantmateriet-dem.py --env-file /sökväg/till/.env
```

Miljöfilen ska innehålla `LANTMATERIET_USERNAME` och `LANTMATERIET_PASSWORD` för tjänsten. Anslutningen använder STAC och HTTP-intervall för att läsa det lilla utsnittet och sparar inga inloggningsuppgifter i appen eller källfilerna. Samlingen `dtm-cog` prioriteras framför det äldre `mhm-*`-formatet.

Markhöjdmodell Nedladdning: **© Lantmäteriet**, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Bearbetning: geografiskt utsnitt, koordinattransformation och resampling till modellens rutnät.

## GLB-export

[GLB-modellen](../public/models/avstyckningsvagen-5-ritningsmodell.glb) kan importeras i Blender eller en annan glTF-läsare. Den innehåller hela huset med separata grupper för källare, bottenplan, överplan och tak. Enheten är meter, Y är uppåt och bottenplanets golv ligger vid Y=0. Filens egna modellaxlar är inte orienterade mot sant norr. Tomtterrängen och webbappens vyreglage ingår inte i husfilen.

Efter en ändring av husgeometrin:

```bash
node scripts/export-model.mjs
npm test
npm run build
```

Exporten innehåller källmetadata och kodens SHA-256. Exportskriptet läser tillbaka GLB med Three.js och kontrollerar ändliga koordinater, grupper, begränsningsmått och metadata. Se [exportbeskrivningen](../public/models/README.md) och [exportkontrollen](../public/models/avstyckningsvagen-5-ritningsmodell.report.json).

## Verifiering och begränsningar

Geometritesterna kontrollerar snittarea och bevarade öppningar, bland annat bjälklagets L-formade trapphål, gavelns fönster och överplanets dörröppningar. Terrängtesterna kontrollerar polygonfyllning, hålet för huset, höjdinterpolation, markanpassningar och att omgivningens linjer ligger utanför tomten. Datatesterna kontrollerar den faktiska tomtens area, registrering och höjdtäckning. Testerna verifierar modellgeometrin och beräkningarna.

Arkivets originalhandlingar visades i kommunens dokumentläsare. De lokala PNG-filerna är skärmbilder av handlingarna, inte nedladdade original-PDF:er. Google-bilderna är daterade observationskällor med attribution och används inte som modelltexturer.

Två PyCOLMAP-försök med tre Street View-positioner gav **0 verifierade bildpar och 0 3D-punkter**, även efter förbättrad maskering och oberoende granskning. Husmodellen är därför rekonstruerad från ritningar och observationer. [Fotogrammetripipelinen](../scripts/photogrammetry/README.md) finns kvar för nya originalfoton.

För en kontrollerad modell av dagens hus behövs överlappande originalfoton av fasader och rum, aktuella planändringar och oberoende kontrollmått. Material, fönster, dörrar, trappor och terräng behöver stämmas av. Bärande konstruktion och installationssystem är inte verifierade eller fullständigt modellerade.

### Fördjupning

- [Källförteckning](../research/sources.md)
- [Geometri, mått och tolkningar](../research/geometry-evidence.md)
- [Geometrikontroll](../research/geometry-validation.json)
- [Webbläsarkontroll](../research/verification/browser-checks.md)
- [Kontroll av Lantmäteriets terräng](../research/verification/lantmateriet-checks.md)
- [Kontroll av infart och stödmurar](../research/verification/driveway-checks.md)
- [Fotogrammetrins resultat](../research/photogrammetry.md)
- [Historisk avstämning mot beställningen](../research/completion-audit.md)
