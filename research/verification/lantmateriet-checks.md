# Lantmäteriets höjdraster i tomtmodellen

Genomfört 2026-09-05 efter användarens hänvisning till `/home/joel/dev/fun/fjall`. Anslutningsexemplet i `tools/jord/jord/sources/dem.py` användes för STAC och befintlig Geotorget-autentisering. Den aktuella samlingen `dtm-cog` valdes efter kontroll av katalogen.

## Hämtning och registrering

- Källa: Lantmäteriet Markhöjdmodell Nedladdning 1 m, `dtm-cog/659_65`, ursprungsfil `m659_65.tif`.
- HTTP-intervall hämtade nödvändiga COG-block. Arkiverat utsnitt: **143×133** pixlar, **63 895 byte**, native 1 m raster, EPSG:5845 / RH2000. Inga saknade pixlar.
- Alla **19 019 pixelcentrum**, huscentrum, sju tomthörn och fyra kontexthörn ligger i ursprungspolygon **23**. Dess inre hål har beaktats. Mättid **2021-03-23**, filändring **2026-02-27**. Filändringen är inte ett nytt skanningsdatum.
- Kommunens tomtpolygon och takkantens centrum/orientering behålls. Samtliga **3 944** punkter i visningens roterade 58×68 rutnät har full täckning i rastret.
- Byggskriptet använder bilinjär sampling kring rasterpixelcentrum efter horisontell EPSG:3011→3006-transformation. RH2000-värden bevaras tills modellens uppskattade golvhöjd subtraheras. Positiv vikt från nodata eller en punkt utanför rastertäckningen stoppar bygget.
- DEM-prov vid infarten, lokalt `(2,7; 5,6)`, är **17,64761 m RH2000**. Med arkivets 2,45 m till bottenplan ger det uppskattningen **20,10 m RH2000**. Visningsrutnätets ytterligare interpolation ger cirka 8 cm skillnad vid samma punkt. Detta är en höjdpassning, inte en inmätt porttröskel eller färdig golvhöjd.
- Höjdkurvorna använder hela meter i RH2000. `contourOffset` håller nivåerna rätt när modellens lokala Y=0 ligger på 20,10 m.

## Kontroller

- `python tests/site-dem.test.py`: sex analytiska rasterfall passerar för pixelcentrum, vriden rastertransform, compound-CRS, E/N-axelordning, nodata/masker, utanför-täckning samt skala/offset. Syntetiska testdata publiceras inte som terräng.
- `npm test`: samtliga tre testfiler passerar, inklusive sju generella terrängfall, faktisk tomtgeometri/proveniens samt tidigare snittfall.
- Den uttryckliga äldre vägen `--elevation-source municipal-contours` reproducerar det tidigare höjdrutnätet med golvhöjd 20,55 m. Den används inte automatiskt om Lantmäteriets raster saknas.
- `npm run build` passerar. Den byggda appens höjddata överensstämmer med `public/data/site.json`.
- Inga inloggningsvärden förekommer i de genererade källfilerna eller webbappens höjddata.

## Webbläsare

Separat Chrome-flik, 2560×1231 px. Hela tomten renderas i ortografisk 3D. Båda alternativen för omgivningen fungerar. Gatufasaden kontrollerades mot markens läge; terrängens 1 m upplösning återger inte en exakt plan garageplatta. Källpanelen visar Lantmäteriet, mättid, CC BY 4.0, bearbetning och uppskattad golvhöjd. Inga JavaScript-fel i testflikens logg.

Skärmbilder: `lantmateriet-grid.png`, `lantmateriet-street.png`, `lantmateriet-contours.png`.

Full proveniens finns i `../site/lantmateriet/source.json` och `../site/lantmateriet-source-notes.md`. Skillnader mot den tidigare kurvinterpolationen finns i `../site/lantmateriet/comparison.json`; eftersom mätåren skiljer sig är dessa skillnader inte ett mått på den ena källans noggrannhet.
