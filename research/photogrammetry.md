# Faktiskt fotogrammetriförsök

Kontrollerat 2026-09-05, inklusive oberoende metodgranskning och ett andra COLMAP-försök. Objekt: Avstyckningsvägen 5, Järfälla. Försöken återvann **ingen** 3D-geometri och ska inte beskrivas som en fotogrammetrisk husmodell. Metodgranskningen hittade några trovärdiga **2D-motsvarigheter** mellan två vyer; det är ett annat resultat än en godkänd rekonstruktion.

## Underlag och metod

Tre perspektivvyer hämtades från Google Street View, samtliga med bilddatum oktober 2022. Panoraman har olika ID och dokumenterade positioner i `streetview-camera-positions.json`. Bilderna visar gatufasaden och delar av tak/entrégavel. Baksida och interiör saknas. Träd skymmer stora delar av huset; panoramastygn och upprepade takpannor kan störa geometri och matchning.

Native bildstorlek är 2560 × 1231 px. Manuell polygonmaskering behåller synliga delar av målbyggnaden och utesluter uppenbara grannbyggnader, gränssnitt och stora lövverk. Masker och indata är sparade i `scripts/photogrammetry/streetview-attempt-2026-09-05/`. Maskeringen är en avgränsning av bildbevis, inte ett påstående om att varje kvarvarande pixel föreställer en stabil byggnadsyta.

PyCOLMAP **3.13.0** kördes på CPU med fyra trådar: SIFT, uttömmande matchning, geometrisk parverifiering och inkrementell SfM. Varje vy har separat PINHOLE-kamera med uppskattade, okalibrerade parametrar. Fullständiga inställningar och kommandon finns i `scripts/photogrammetry/reconstruct.py` och dess README.

## Observerat utfall

| Vy | SIFT-särdrag innanför mask | Geometriskt verifierade bildpar |
|---|---:|---:|
| Frontal, panorama `KZQYCThYtHfJkYmDeemB1g` | 724 | 0 |
| Position 2, panorama `kaMdOMVcZiLr7BW5-olmdw` | 360 | 0 |
| Position 3, panorama `jpkHP8P6X6jBUGJ7ZG0uOw` | 265 | 0 |

COLMAP kunde inte initiera någon rekonstruktion. **0 registrerade kameror, 0 triangulerade punkter, ingen PLY/GLB, inget tätt punktmoln och ingen mesh.** Returnerad felkod var `3` (`sfm_failed_no_reconstruction`). Databasen innehåller noll matchningar i de tre paren. Detta är ett negativt resultat för den här bildserien med de dokumenterade maskerna och inställningarna; det bevisar inte att fotogrammetri av huset är omöjligt med bättre material.

Masker, exakta bildhashar och parresultat finns i [kvalitetsrapporten](../scripts/photogrammetry/streetview-attempt-2026-09-05/quality-report.json). [Indatakontrollen](../scripts/photogrammetry/current-input-audit.json) visar att de tre olika panoramapositionerna godkändes som ett försök. Den tidigare ensamvyns `current-feature-diagnostic.json` visar enbart att CPU-extraktion fungerar; dess särdrag är inte 3D-punkter.

## Verifierad körbar väg framåt

`scripts/photogrammetry/reconstruct.py` tar ett manifest med originalfoton, avvisar samma panoramaposition och dubletter, kör CPU-SfM och exporterar en lyckad rekonstruktion som färgsatta PLY- och GLB-punktmoln. Rapporten skiljer gles rekonstruktion från ett arkitektoniskt verifierat resultat. Verktyget skapar inga ersättningspunkter när SfM misslyckas.

Likformighetsanpassning av tre eller fler icke kollineära kontrollpunkter kan sätta meter, läge och Y upp. Funktionen har verifierats med en **separat syntetisk hjälptestfixtur** med känd skala 2 och translation (3, 4, 5), samt PLY/GLB-export. Testfixturen skapades i `/tmp`, raderades och används inte som husunderlag. Den lyckade husrekonstruktionsgrenen har ännu inte kunnat verifieras på husets bilder.

Installerad PyCOLMAP saknar CUDA. Tät PatchMatch/fusion kan köras med flaggan `--dense` i en CUDA-byggd miljö efter en lyckad SfM, men tät bearbetning har inte verifierats här. För arkitektstandard återstår tillräcklig fotografering av alla ytor, aktuell interiör, oberoende kontrollmått, registrerings-/täckningskontroll och granskning av geometri/material. Arkivmåttet 8,15 m får bara användas när rätt fysiska ändpunkter kopplats och måttets giltighet kontrollerats.

Teknisk metodkälla: [officiell PyCOLMAP-pipeline](https://github.com/colmap/colmap/blob/main/python/README.md), [versionsbunden 3.13-dokumentation](https://colmap.github.io/legacy/3.13/pycolmap/pycolmap.html).

## Oberoende metodgranskning och andra försöket

Maskernas positioner kontrollerades genom överlagringar på de oförändrade originalbilderna. De träffar rätt byggnad och utesluter grannhus. Den första masken var onödigt snäv kring ett synligt vänsterfönster. `captured-input-revised-masks.json` återinför den klara fönsterytan; det ökade antalet COLMAP-särdrag i vy 1 från 724 till **765**. [Granskad originalmask](photogrammetry-audit/original-mask.jpg) och [reviderad mask](photogrammetry-audit/revised-mask.jpg) visar ändringen. Varken källpixlar eller grannavgränsning ändrades.

OpenCV **4.13.0** användes dels för oberoende brute-force-matchning av sparade COLMAP-deskriptorer, dels för ny SIFT-extraktion med RootSIFT, kontrastgräns 0,02 och högst 12 000 särdrag. Den senare gav **2038 / 1013 / 530** särdrag med originalmaskerna. Matchning undersöktes vid kvotgränser 0,70, 0,80, 0,85 och 0,90, följt av USAC/MAGSAC för fundamentalmatris och homografi med 3 px tröskel. 0,90 användes enbart som känslighetsdiagnostik.

| Metod, originalmasker | Bildpar | Kvot | Ömsesidigt närmaste kandidater, ensidigt kvottest | Kandidater efter båda kvottesten och avståndsgräns 0,7 | Fundamentalmatrisens inliers |
|---|---|---:|---:|---:|---:|
| COLMAP-deskriptorer, oberoende BF | 1–2 | 0,80 | 15 | 8 | 14 |
| COLMAP-deskriptorer, oberoende BF | 1–2 | 0,85 | 23 | 11 | 17 |
| OpenCV RootSIFT | 1–2 | 0,80 | 18 | 13 | 13 |
| OpenCV RootSIFT | 1–2 | 0,85 | 36 | 20 | 19 |
| OpenCV RootSIFT | 1–3 | 0,85 | 17 | 5 | 9 |
| OpenCV RootSIFT | 2–3 | 0,85 | 13 | 5 | 9 |

**Tabellens sista kolumn beräknas på den friare kandidatlistan, inte på listan efter båda kvottesten.** Flera orienteringar på samma bildläge kan dessutom ge flera deskriptorer; rapporten särredovisar antal inlierpar efter avrundning av bildkoordinater till en pixel. De matematiska inlierantalen bevisar därför varken lika många oberoende fysiska punkter eller en korrekt 3D-modell.

COLMAPs publicerade SIFT-kod kontrollerar både riktningarnas kvottest och ett maximalt deskriptoravstånd när `cross_check` är på. Den installerade geometriverifieringen kräver minst 15 inliers. De första bildparens **8 respektive 11** kandidater efter motsvarande filter är förenliga med att COLMAP inte behöll något par; databasvärdet noll får inte tolkas som att bilderna helt saknar motsvarande detaljer. Inget fel i maskernas koordinatsystem eller anropet till matcharen hittades. [Versionsbunden SIFT-kod](https://github.com/colmap/colmap/blob/3.13.0/src/colmap/feature/sift.cc), [OpenCVs matchningsmetod](https://docs.opencv.org/4.10.0/dc/dc3/tutorial_py_matcher.html).

Visuell kontroll av [par 1–2](photogrammetry-audit/matches-1-2.png) ger trovärdiga motsvarigheter för vägglampan, husnummer 5 och några detaljer på högra fönstrets foder. Exakta automatiska matchindex och bildkoordinater finns i [den manuella granskningen](../scripts/photogrammetry/method-audit-2026-09-05/manual-match-review.json). De är inte inmätta kontrollpunkter. Däremot kopplar de matematiska inlierförslagen i [par 1–3](photogrammetry-audit/matches-1-3.png) och [par 2–3](photogrammetry-audit/matches-2-3.png) bland annat gatufasadens fönsterhörn till andra detaljer på entrégaveln, samt felaktiga takpannor. Dessa förslag avvisas som bevis för en gemensam fysisk punkt.

Ett faktiskt andra COLMAP-försök kördes med reviderad mask och kvotgräns **0,85**. Det gav **765 / 360 / 265** särdrag men fortfarande **0 geometriskt verifierade par, 0 registrerade kameror och 0 triangulerade punkter**, felkod 3. Alla geometriska standardkrav behölls: minst 15 parinliers, minst 100 initiala parinliers, 16° initial trianguleringsvinkel, 1,5° punktfilter och 4 px reprojektionsgräns; rena tvåbildsspår används inte för att fylla ut modellen. Kameraposer tvingades inte in. Cheiralitet, faktisk parallax, flerbildsspår och reprojektionsfel kan **inte verifieras som godkända** när någon giltig rekonstruktion inte finns. [Andra kvalitetsrapporten](../scripts/photogrammetry/streetview-attempt-revised-ratio085/quality-report.json).

Granskningen stöder ett avgränsat negativt resultat: de prövade metoderna och rimliga kvotvariationerna gav ingen verifierbar fasadrekonstruktion från dessa tre bilder. Fler osäkra matchningar skapar inte den saknade gemensamma sikten i vy 3. Det rimliga nästa underlaget är överlappande originalbilder från fler kamerastationer med mindre lövskymning, dokumenterade kamerauppgifter och oberoende mått. Detta utesluter inte att andra metoder kan hitta ytterligare bildmotsvarigheter; det motiverar inte att kalla nuvarande underlag arkitektstandard. Ingen tät rekonstruktion eller ytterligare mesh skapades under granskningen.

Reproducerbart underlag:

- [Andra körningens rapport](../scripts/photogrammetry/streetview-attempt-revised-ratio085/quality-report.json)
- [Reviderat bildmanifest](../scripts/photogrammetry/captured-input-revised-masks.json)
- [Oberoende matchrapport](../scripts/photogrammetry/method-audit-2026-09-05/matching-audit.json)
- [Manuellt granskade bildträffar med pixelkoordinater](../scripts/photogrammetry/method-audit-2026-09-05/manual-match-review.json)
- [Matchgranskning efter maskrättelsen](../scripts/photogrammetry/method-audit-revised-ratio085/matching-audit.json)


Kompakta rapporter och de fem illustrerade granskningsexemplen versionshanteras. Fullständiga genererade mellanbilder, masker och COLMAP-databaser behålls lokalt och undantas av `.gitignore`. Körkommandon för att återskapa dem finns i fotogrammetriverktygets README.
