# Garageinfart och stödmurar · kontroll 2026-09-05

Den jämna DEM-sluttningen framför garageporten har ersatts lokalt av en nedsänkt hårdgjord infart. Den har planteringsmur på vänster sida med retur mot gatan, samt stödmur med vita horisontella brädor på höger sida. Infarten lutar mot gatan och ansluter till källhöjderna vid tomtgränsen. Markytan bakom murarna ansluter till murkrönen. Se `research/site/driveway-evidence.md` för observerade detaljer och osäkra mått, samt `research/site/earthworks.json` för kontrollpunkterna.

## Automatiska kontroller

- `npm test`: samtliga fyra testfiler passerar, inklusive åtta tester för markarbetena.
- `npm run build`: passerar. Vites befintliga varning för paket över 500 kB kvarstår; ingen byggvarning om geometri eller saknade resurser.
- Geometritesterna kontrollerar att gräset inte överlappar infarten, att markens area täcks exakt en gång, att husets hål bevaras, att murar ligger inom tomten samt att koordinater och murhöjder är ändliga.
- Murar och återfyllning delar geringshörn. Testet för ett 90-gradershörn jämför både höjdfunktionen och de renderade ytornas gemensamma kant. Även verkliga högermurens knäck har jämförts numeriskt på båda sidor.
- `python scripts/build-site-data.py --without-earthworks --output /tmp/avstycknings-unmodified-dem.json`: jämförelse mot aktuell data visar identiska 3 944 DEM-höjder, identisk tomtpolygon och identiskt hushål. Källrastret och dess höjdproveniens är oförändrade.

## Webbläsarkontroll

- Ortografisk gatufasad och fritt roterad ortografisk 3D: garageport och gångdörr har fri markanslutning, båda murarna syns och inga vita glipor eller uppstickande hörnfenor finns kvar.
- Perspektiv med hela tomten och höjdkurvor: infart och murar syns inom den riktiga fastighetsgränsen; omgivningen består av linjer.
- Av- och påslagning av tomtläget döljer respektive återställer även infarten och murarna.
- Mätverktyget gav en giltig tvåpunktsmätning på den nya infartsytan, 2,28 m mellan de valda bildpunkterna. Det är en funktionskontroll, inte ett kontrollmått på plats.
- Den nya bildkällan öppnades via appens lokala URL och laddades korrekt i 2560×1231 pixlar.
- Inga konsolfel under slutkontrollen.

Kontrollbilder: `driveway-orthographic.png` och `driveway-whole-plot.png` i denna katalog. Mått, murarnas skymda ändpunkter och lutningar är fototolkade. Någon ytterligare utgrävning längs hela entrégaveln är inte belagd av de granskade bilderna och har inte lagts in.
