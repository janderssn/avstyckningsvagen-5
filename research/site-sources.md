# Tomt och terräng — Avstyckningsvägen 5, VIKSJÖ 2:573

> **Aktuellt höjdunderlag:** Terrängvisningen har därefter bytts till Lantmäteriets 1 m markhöjdmodell, enligt användarens hänvisning till fjall. Se `site/lantmateriet-source-notes.md`. Kommunens fastighetsgräns och husregistrering nedan används fortfarande. Höjdkurvsdelen dokumenterar den tidigare, arkiverade terrängmetoden.

Kontrollerat 2026-09-05. Detta underlag kommer från Järfälla kommuns publika karta, inte från en konstruerad kulle eller ett generiskt höjdraster.

## Levererade data

| Fil | Innehåll |
|---|---|
| `site/parcel.json` | Fastighetens polygon i EPSG:3011, med WGS84-koordinater och beräknad area. |
| `site/house-registration.json` | Husets registrerade takkant, centrum och orientering för placering av ritningsmodellen. |
| `site/elevation-evidence.json` | 72 höjdkurvor med 15 387 XY-vertex och respektive höjd, samt 9 punkthöjder. RH2000. |
| `site/raw/parcel-point.json` | Oförändrat kommunalt fastighetsobjekt från punktfråga i husets läge. |
| `site/raw/building.dxf` | Kommunens exporterade byggnadsgeometri. |
| `site/raw/building-featureinfo.json` | Attribut för den byggnad som hör till rätt fastighets-UUID. |
| `site/raw/contours.dxf`, `site/raw/heights.dxf` | Oförändrade separata DXF-exporter från kartans höjdkurvs- och punkthöjdslager. |
| `site/raw/elevation-attributes/` | Kartans oförändrade höjdattribut för varje matchad linje/punkt. |
| `site/raw/baskarta.png`, `site/raw/ortho2025.png` | Georefererade kart- och ortofotouttag. Bbox, storlek och exakt begäran i respektive `*-request.json`. |

## Primärkällor

- [Järfällakartan](https://jarfallakartan.jarfalla.se/spatialmap?profile=jarfallakartan): kommunens publika SpatialMap-karta. Lagermetadata lästes med en anonym session som webbplatsen utfärdade. `site/raw/themes-all.json` bevarar de exponerade lagren och deras publicerade WMS-adresser.
- [Kommunens kartor och mättjänster](https://www.jarfalla.se/byggaboochmiljo/byggaochbo/kartorochmattjanster.4.7a0ff1cc1326d53eaee8000622.html): anger kommunens geodetiska referenser SWEREF99 18 00 och RH2000, årliga ortofoton/laserskanning samt tillgänglig markmodell med 1 m grid.
- [Öppna stompunktstabellen](https://dokument.jarfalla.se/Stompunkter/Stompunkter.xlsx): hämtad och sparad som `site/raw/stompunkter.xlsx`. Närbelägna planpunkter saknar höjd; närmaste höjdbestämda stompunkt ligger drygt225 m från huset. Dessa användes därför inte för att skapa lokal terräng.

Exakta WMS-begäranden finns i `site/raw/dxf-requests.json`, `wms-extra-requests.json` och kartuttagens request-filer. Kartans egna publicerade åtkomstparametrar behövs för samma anonyma visning; de är inte en inloggning till ett privat konto.

## Fastighetsgräns: direkt geometri

Publikt kartlager `theme-fastighetsgranser`, datakälla `ds_fastytor`. Kartans dokumenterade punktfråga `spatialserver.datasource.execute-wkt-filter` kördes vid E138710.28, N6589578.15.

Svaret identifierar `VIKSJÖ 2:573>1`, objekttyp `FASTIGHET`, kommun JÄRFÄLLA och UUID `909a6a45-2a89-90ec-e040-ed8f66444c3f`. Polygonens plana area är **577.957 m²**, i överensstämmelse med tidigare fastighetsuppgift578 m². Det finns sju distinkta gränsvertex. Den böjda gatufronten representeras i kommunens data av flera raka segment.

Detta är kommunens kartgeometri. Den är inte en ny gränsbestämning eller en kontroll av fysiska gränsmarkeringar. Den historiska adresskartans motstridiga handskrift används inte för denna polygon.

## Husplacering: kommunal takkant

WMS-lager `td22.2_publ_bal_byggnad_y`. Objekt9776, UUID `5bfca77f-2e12-4cc7-95fc-1f855fb50321`, anger samma fastighets-UUID. Attributen anger byggår1972, `Bostad: Småhus friliggande (123kvm)`, `Insamlingsläge: Takkant` och area97.58095 m². Planreferens SWEREF99 18 00. Objektets lägsta/högsta tak, entrénivå och färdigt golv saknar värden.

- Centrum från den rektangulära takkantens fyra hörn: **E138710.064650, N6589578.842171**.
- Takkant: **8.818773 ×11.064872 m**. Dessa mått ska inte ersätta ritningarnas yttre väggmått8.15×10.65 m.
- Lokal +Z, gatufasadens utåtriktning: EN`[-0.612977698, +0.790100210]`, kompassriktning **322.194877°**.
- Lokal +X: EN`[-0.790100210, -0.612977698]`.
- Omvandling för punkt(E,N): subtrahera centrum och ta skalärprodukt med respektive enhetsvektor.

Orienteringen är beräknad från faktisk kartgeometri. Kopplingen mellan takkantens centrum och ritningsmodellens väggcentrum är fortfarande en registrering: taksprången kan vara asymmetriska. Den ersätter inte en mätning av fasadhörn på plats.

## Höjder: kommunala lasermätta kurvor och punkter

Kartan exponerar `td22.2_publ_hk_hojddjupkurva_1m_upp_l` och `td22.2_publ_ho_hojddjuppunkt_p`. WMS GetMap stöder formatet`application/dxf`. DXF-filerna är tvådimensionella och har inte användbara Z-värden. För varje linje/punkt gjordes därför en separat GetFeatureInfo-fråga vid en exakt exporterad vertex, med en mycket liten kartpixel. Samtliga72 linjer matchade entydigt till72 olika feature-ID; samtliga9 punkter matchade också entydigt. Varje resultat innehåller källfil och exakt frågevertex.

Höjdattributen anger:

- Geoidmodell **SWEN17_RH2000**, alltså RH2000-höjder i meter.
- Höjdkurvor: flygburen laserskanning **22–23 april2023**, angiven lägesosäkerhet höjd **0.25 m**.
- Punkthöjder: flygburen laserskanning **23 april2023**, verksamhetskod `markhöjd bilväg`, angiven lägesosäkerhet höjd **0.05 m**.
- Kurvans höjd finns i `Höjd/Djup-värde`; punktens i `Höjd/Djup värde`. Attributet `Ekvidistans` anger2.0 i undersökta kurvobjekt trots att lagret innehåller både udda och jämna heltalshöjder. Terrängen ska använda varje objekts faktiskt returnerade höjd, inte härleda en nivå från lagernamn eller kurvindex.

Kartuttaget är E138650–138780, N6589520–6589640, **130×120 m**. DXF-exporten returnerar hela kartobjekt som korsar uttaget, inte klippta linjesegment. Därför kan vissa vertex ligga utanför bbox. Välj kontextens utsträckning uttryckligen vid rendering.

Gatupunkten närmast husets infart ligger vid **E138690.095, N6589580.134, h17.105 m RH2000**. Andra dokumenterade gatunivåer är16.770 m åt nordost och17.901 m åt sydväst. Nära huset finns kurvor18,19 och20 m. Högre nivåer upp till28 m i hela exporten ligger längre bort från tomten.

## Vad terrängmodellen får och inte får hävda

Underlaget ger fastighetens riktiga kontur, husets kartlagda orientering och faktisk omgivande relief. En yta som interpoleras mellan dessa kurvor och punkthöjder ska beskrivas som **interpolation av kommunala höjdkurvor och punkthöjder från2023**. Ett renderingsgrid med1 m steg innebär inte att kommunens råa1 m markmodell har hämtats. Den råa markmodellen har inte hämtats i detta arbete.

Färdigt golv saknas i kartobjektet. Talet ungefär72.65 på2007 års plan är inte entydigt en höjd och får inte användas som absolut datum. Höjdregistreringen mellan RH2000 och modellens bottenplanY0 behöver därför vara markerad som ungefärlig och justerbar, med stöd av garageplanetY−2.45, den dokumenterade gatan och fotonas synliga markanslutningar. Interpolerad mark under huset och vid stödmurar/trappor är särskilt osäker; kartkurvor återger inte alla sådana brottlinjer.

Ortofotolagrets metadata anger **8 cm upplösning, juni–juli2025**, ©Järfälla kommun. Det kan stödja planlägen och nutida markytor, men ger inga egna höjdvärden. Varken växtlighet, möbler eller privata detaljer behöver återges i omgivningens rutnät/konturer.
