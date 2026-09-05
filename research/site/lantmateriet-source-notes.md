# Lantmäteriet — verifierade källnoter

Kontrollerat 2026-09-05. Endast officiella publika metadata hämtades; inga privata autentiseringsuppgifter användes och ingen DEM-fil laddades ned av denna researchuppgift.

## Produkt och licens

**Markhöjdmodell Nedladdning** är en terrängmodell med **1 m grid**. Planreferensen är **SWEREF99 TM**, höjderna **RH2000**. STAC anger det sammansatta systemet **EPSG:5845**; den horisontella delen motsvarar EPSG:3006. Kommunens tomtdata ligger däremot i EPSG:3011, så XY måste transformeras. [Aktuell produktdokumentation](https://geotorget.lantmateriet.se/dokument/projects/markhoejdmodell-nedladdning/released/1/), [produktsida](https://www.lantmateriet.se/sv/geodata/vara-produkter/produktlista/markhojdmodell-nedladdning/).

Produkten är avgiftsfri med **CC BY 4.0**. Vid spridning ska produktnamnet, **©Lantmäteriet**, licensen och eventuell bearbetning anges. Detta får ligga i medföljande metadata om direkt placering är opraktisk. Förslag för denna modell: **“Markhöjdmodell Nedladdning, ©Lantmäteriet, CC BY 4.0. Bearbetad: geografiskt utsnitt, koordinattransformation och resampling till modellens rutnät.”** [Officiella användningsvillkor, 2025-02-01, §3.1](https://www.lantmateriet.se/globalassets/geodata/geodataprodukter/anvandningsvillkor_for_vardefulla_datamangder.pdf).

Publik katalog: [STAC-höjd v1](https://api.lantmateriet.se/stac-hojd/v1/). Produktens åtkomst kan använda Basic eller OAuth2; huvudagenten hanterar befintlig behörighet.

## Faktiska rutor vid Avstyckningsvägen 5

En anonym STAC-sökning vid huset returnerade följande relevanta terrängmodeller. [Exakt sökning](https://api.lantmateriet.se/stac-hojd/v1/search?bbox=17.8009,59.4207,17.8014,59.4212&limit=5).

| Metadata | Äldre fjall-standard | Nyare katalogruta |
|---|---|---|
| Collection | `mhm-65_6` | `dtm-cog` |
| Item | `659_65_0075` | `659_65` |
| Storlek | 2500×2500 pixlar, 2.5×2.5 km | 10000×10000 pixlar, 10×10 km |
| Upplösning | 1 m | 1 m |
| CRS | EPSG:5845 | EPSG:5845 |
| Filändring | 2023-11-22 | 2026-02-27 |
| Mätperiod för hela rutan | 2021-03-23–2023-05-09 | 2020-11-06–2025-06-14 |
| Filstorlek | 10 156 059 byte | 220 122 019 byte |

Äldre fil: [65900_6575_25.tif](https://dl1.lantmateriet.se/hojd/data/grid1m/65_6/55/65900_6575_25.tif).

Nyare fil: [m659_65.tif](https://dl1.lantmateriet.se/hojd/data/grid/mhm/65_6/m659_65.tif). Katalogobjektet anger även `brytgeometri:true` och en separat GPKG-resurs. Den nya filen är COG, float32, en kanal, nodata **−9999**, block512×512, höjdenhet meter. Bbox i SWEREF99 TM är `[650000,6590000,660000,6600000]`. Rastertransformen är `[1,0,650000,0,-1,6600000,0,0,1]`. [Officiell rastermetadata](https://dl1.lantmateriet.se/hojd/pub/grid/mhm/65_6/m659_65_info.json).

`fjall`-exemplet lästes i `/home/joel/dev/fun/fjall/tools/jord/jord/sources/dem.py` efter dess `AGENTS.md`. Det använder samma STAC-bas, men standardfiltreringen behåller bara `mhm-*` och hoppar över `dtm-cog`. Kommentaren om länsstora gigabytefiler beskriver inte den aktuella rutan på 10×10 km ovan. Det är därför ett kodexempel för autentisering och rasterläsning, inte en garanti att standardvalet ger den senaste katalogversionen.

## Mättid just på tomten

Den nyare rutans [ursprungs-GeoJSON](https://dl1.lantmateriet.se/hojd/pub/grid/mhm/65_6/m659_65_ursprung.json) innehåller 58 polygoner i EPSG:3006. Huscentrum, samtliga 7 tomthörn och kontextens 4 hörn testades mot polygonerna efter transformation från EPSG:3011. Alla dessa kontrollpunkter ligger entydigt i **polygon id 23**:

```json
{
  "matdatum": "2021-03-23",
  "lagesbestamningsmetod": "Luftburen laserskanning",
  "lagesosakerhetplan": 0.3,
  "lagesosakerhethojd": 0.1,
  "geodataproducent": "Lantmateriet"
}
```

Transformerat huscentrum: **E658932.569, N6590271.895**. Rimlig källtext är **“Lantmäteriet, 1 m markhöjdmodell; laserskanning 23 mars 2021. Fil uppdaterad 27 februari 2026.”** Filuppdatering 2026 innebär alltså inte att själva tomten skannades 2026. Den kommunala kurvkällans skanning 2023 är nyare i mättid, men kurvinterpolationen har lägre detaljupplösning än detta faktiska raster med 1 m upplösning.

Efter huvudagentens nedladdning verifierades även **samtliga 19 019 pixelcentrum** i `lantmateriet/dem.tif` (143×133 pixlar). Alla ligger i ursprungspolygon 23; dess 12 inre hål exkluderades i beräkningen. Rasteruttaget har inga nodata-celler. Endast den avtalade extra nyckeln `acquisition` lades till i `lantmateriet/source.json` med dessa resultat.

I STAC beskriver `created` publiceringen av item och `andringsdatum` filändringen. `start_datetime`/`end_datetime` beskriver rutans mätperiod; `matdatum` i ursprungspolygonerna preciserar lokalt ursprung. [Fältdefinitioner](https://geotorget.lantmateriet.se/dokument/projects/markhoejdmodell-nedladdning/released/1/).

## Praktisk användning i husmodellen

Behåll RH2000 under rasterläsning och geografisk transformation. Subtrahera husmodellens valda, tydligt markerade uppskattning av färdigt golv först när höjden uttrycks som lokalt Y. Det saknas fortfarande en inmätt absolut FFL för huset. En produkt med 1 m upplösning betyder inte att trappsteg, stödmurar, grundkanter och mark under byggnaden är återgivna med samma säkerhet. Publicera uppgift om resampling om rastervärden interpoleras till husets vridna koordinatram.
