# Ortografisk kamera och tomtläge

Verifierat 2026-09-05 i en separat Chrome-flik på `http://127.0.0.1:5173/`, 2560×1231 px. Husets accepterade geometri är oförändrad.

## Webbläsarkontroll

- Perspektiv och ortografisk projektion kan väljas oberoende av kamerans riktning. Ortografisk gatufasad har raka vertikaler och parallella tak-/fasadlinjer.
- Gata, Trädgård, Entré och Gavel väljer respektive sida och visar korrekt aktivt knappval. Ovanifrån visar hela tomtpolygonen. 3D / Iso återgår till en sned vy.
- Faktisk musdragning i ortografisk 3D ändrar riktningen och lämnar projektionen ortografisk; inget sidförval är därefter felaktigt markerat.
- Tomtläget visar hela fastigheten och huset. Marken är fylld inom gränsen. Omgivningen har endast höjdföljande rutnät eller höjdkurvor beroende på val; inga grannhus renderas.
- Vyn ovanifrån visar den fulla, avsmalnande tomtpolygonen och husets läge nära gatan. Norrpilen följer kommunens georeferering.
- Ett breddsnitt vid −0,97 m med ortografisk gavelvy visar alla tre genomskurna våningar. Terrängen klipps med samma plan och täcker inte snittets rum. Skärmbild: `terrain-section.png`.
- Avstängning av terrängen återanpassar kameran till huset. Knappen Visa hela tomten aktiverar och passar in tomten igen.
- Källpanelen innehåller kommunens karta, lokalt baskarteutdrag och uttrycklig upplysning om interpolerade höjder och uppskattat golvhöjdläge.
- Inga JavaScript-fel i testflikens logg efter kontrollen.

Slutlig vy: ortografisk 3D med tomt och höjdkurvor. Skärmbild: `terrain-orthographic.png`.

## Beräkningskontroller

`npm test` passerar tre testfiler: 12 tidigare snittfall, sex generella terrängfall och kontrollen av den faktiska kommunala tomtens registrering/täckning. Det faktiska datatestet kontrollerar 577,957 m² area, koordinatomvandling med mindre än 1 mm avrundningsfel, att hela tomten utanför huset fylls exakt en gång, att husets fotavtryck förblir öppet och att garagegolvet ligger vid den uppskattade anslutningen till marken. Samtliga 3 944 visningspunkter ligger inom höjdobservationernas konvexa hölje.

En separat granskning av kamerans faktiska `fitView`-funktion kontrollerade 108 kombinationer av perspektiv/ortografisk kamera, bildförhållande, storlek och riktning. Alla åtta hörn låg inom det avsedda 80-procentiga synfältet och kamerans klippavstånd. Stora importer och kraftig zoom föranledde också korrigering av klippavstånd vid projektionsbyte.

`npm run build` passerar. Vites storleksnotis för Three.js-paketet kvarstår; inga byggfel.

## Datans precision

Tomtgräns, takkant, 72 höjdkurvor och nio markpunkter kommer från kommunens publika karta. Höjdkurvor/punkter härrör från laserskanning 2023. Höjdrutnätet i appen är interpolerat, inte en separat inmätt terrängmodell. Bottenplanets registrering på 20,55 m RH2000 är uppskattad från den interpolerade marken vid garageporten. Stödmurar, detaljerad markplanering och exakt golvhöjd är inte inmätta. Se `../site-sources.md` och `../../scripts/build-site-data.py`.
