# Underlag: Avstyckningsvägen 5, Viksjö, Järfälla

Kontrollerat 2026-09-05. Avser byggnaden och fastigheten; inga personuppgifter om boende har samlats in.

## Senaste fynd: fastighetens egna ritningar och identifierad fasad

Kommunens arkiv har nu gett **fyra fastighetsspecifika handlingar från 2007**, samt originaltypritning och måttsatt sektion från 1971. Bottenplansbladet från 2007 anger uttryckligen Avstyckningsvägen 5 och fastighet 2:573. Även husets gatufasad har identifierats genom fysiskt husnummer **5** i Google Street View från oktober 2022. Tidigare negativa sökresultat för mäklarbilder nedan avser endast de källorna.

| Dokument | Identifikation och innehåll | Lokal kopia |
|---|---|---|
| Bottenplan | LOV50-017475, 1533721.pdf, inkom 2007-10-12; adress, yttermått, rum, eldstad | `captures/2007-ground-1533721.png` |
| Överplan + källare | Samma ärende, 1533711.pdf; rum, garage, trappa, skorstensplacering | `captures/2007-upper-basement-1533711.png` |
| Gavelfasader | Samma ärende, 1533691.pdf; entrégavel, motsatt gavel, skorsten | `captures/2007-facades-a-1533691.png` |
| Gatu- och trädgårdsfasad | Samma ärende, 1533701.pdf | `captures/2007-facades-b-1533701.png` |
| Originaltypritning | LOV50-005623, 53506.pdf, blad 51165, hustyp 502 N1S, 1971 | `captures/archive-plan-51165-large.png` |
| Måttsatt sektion | Originalbladets sektion A–A; rumshöjder och yttervägg | `captures/1971-section-detail.png` |
| Identifierad gatufasad | Google Street View, oktober 2022, fysiskt husnummer 5 synligt | `captures/google-streetview-2022-number5-front.png` |

Arkivets officiella ingång: https://e-tjanster.jarfalla.se/oversikt/overview/787 . Sök på **VIKSJÖ 2:573**. De lokala bildfilerna är skärmfångster av visade handlingar, inte nedladdade original-PDF:er.

Street View-källa: https://www.google.com/maps/@59.4210658,17.800986,20a,60y,153.01h,90t/data=!3m7!1e1!3m5!1sKZQYCThYtHfJkYmDeemB1g!2e0!7i16384!8i8192 . © Google. Panoramats platsetikett kan avse kamerans position; byggnaden identifierades genom sitt synliga nummer.

Full spårning av geometri, historisk adressavvikelse och antaganden finns i `geometry-evidence.md`.

## Verifierade byggnadsuppgifter

| Uppgift | Underlag | Säkerhet |
|---|---|---|
| Avstyckningsvägen 5, Viksjö, Järfälla kommun | Hemnets ursprungliga annons och slutprisannons | Verifierat |
| Villa, äganderätt, byggår 1972 | Hemnet | Verifierad annonsuppgift, inte byggnadsarkiv |
| 123 m² boarea + 80 m² biarea, 7 rum | Hemnet och Booli | Samstämmiga annonsuppgifter; säger inte hur ytorna är fördelade |
| Tomt 578 m² | Hemnet och Booli | Samstämmiga annonsuppgifter |
| Såld 20 oktober 2017 genom HusmanHagberg Järfälla | Hemnet | Verifierat |
| VIKSJÖ 2:573 | Hitta, kontrollerat separat av huvudagenten | Fastighetsbeteckning att använda i kommunens arkiv |

## Exakta källor

1. **Hemnet, ursprunglig försäljningsannons, nu borttagen:** https://www.hemnet.se/bostad/villa-7rum-viksjo-jarfalla-kommun-avstyckningsvagen-5-12582236
   - Hämtad med webbverktyget. Sidan anger borttagen 20 oktober 2017 och ovanstående byggnadsuppgifter.
   - Nuvarande sida exponerar inte byggnadsfotografier eller planritningar i läsbart sidinnehåll; endast mäklarporträtt och logotyp syns.
2. **Hemnet, slutprisannons:** https://www.hemnet.se/salda/villa-7rum-viksjo-jarfalla-kommun-avstyckningsvagen-5-749397
   - Indexerad som såld 20 oktober 2017. Direktöppning gav webbverktygets cachefel, inte bevis för att sidan saknas.
3. **Booli, bostadsregister:** https://www.booli.se/bostad/3669237
   - Sökresultat återger 123+80 m², 7 rum, 578 m² tomt, byggår 1972.
   - Direktöppning gav webbverktygets cachefel. Ej verifierad bildkälla.
4. **Hitta, geografisk områdessida:** https://www.hitta.se/område/59.4209400759528%3A17.801135149011454
   - Fastighetsbeteckning VIKSJÖ 2:573 verifierad av huvudagenten. Koordinat i sidans URL är en geografisk sidreferens och får inte utan vidare användas som exakt byggnadsmitt.
5. **Järfälla kommun, Ritningsarkivet:** https://e-tjanster.jarfalla.se/oversikt/overview/787
   - Kommunen anger att fastighetsritningar kan tas fram genom sökning på fastighetsbeteckning.
   - Arkivets äldre direktlänk: https://ritningsarkiv.jarfalla.se/ags_pro/#
   - Huvudagenten har nu hämtat ovanstående handlingar i arkivets visare och sparat skärmfångster.
6. **HusmanHagbergs egen sökning:** https://www.husmanhagberg.se/sok/?q=Avstyckningsv%C3%A4gen%205
   - Direkt HTTP-hämtning lyckades (200). Sidans publicerade JSON-data anger sökordet `Avstyckningsvägen 5` och en tom lista `estates`.
   - Bredare sökning på gatan https://www.husmanhagberg.se/sok/?q=Avstyckningsv%C3%A4gen gav endast **Avstyckningsvägen 74**, alltså en annan fastighet. Dess bilder och planer har inte använts.
   - Lokal evidens: `broker-search-evidence.json`; rå HTML: `raw/husmanhagberg-search.html` och `raw/hh-street-search.html`.
7. **Internet Archive, CDX-index:** https://web.archive.org/cdx/search/cdx?url=www.hemnet.se%2Fbostad%2Fvilla-7rum-viksjo-jarfalla-kommun-avstyckningsvagen-5-12582236&output=json&filter=statuscode:200&filter=mimetype:text/html
   - Exakt HTTP-förfrågan lyckades (200) och returnerade en tom lista. Det bevisar endast att denna sökning inte gav en sparad HTML-sida; det utesluter inte andra URL-varianter eller externa arkiv.
   - Även `husmanhagberg.se/*avstyckningsvagen*5*` gav tom lista. Bredare subdomänsökning för HusmanHagberg fick nätverkstimeout och är inte ett negativt arkivresultat.

## Sökutfall för fotografier och planritningar

Exakta webbsökningar på adressen tillsammans med Järfälla/Viksjö, fastighetsbeteckningen, planritning/planlösning, ursprungligt Hemnet-ID och mäklarens namn gav inga identifierbara originalbilder eller planritningar för denna fastighet. Bildsökning gav andra hus och har därför inte använts som geometriskt underlag. Hemnet och Booli svarade 403 på direkt HTTP-hämtning; vanlig webbsökningsindexering kunde återge grunduppgifterna. Inga sådana åtkomstkontroller har kringgåtts.

## Ej verifierat / återstående

- Dagens relation till planritningarna från 2007: senare förändringar och aktuell detaljinredning.
- Exakt taklutning, bjälklagstjocklekar, innerväggstjocklekar, trappmått, konstruktion och terränganslutning. Yttermått 8,15×10,65 m och fria rumshöjder 2,20/2,40/2,40 m finns på de hämtade handlingarna.
- Nuvarande planlösning och eventuella ändringar efter försäljningen 2017.
- Aktuella detaljfoton från alla fasader och rum.
- En överlappande fotografiserie lämplig för fotogrammetri. Enstaka gatu- eller mäklarbilder räcker inte för en verifierad fullständig rekonstruktion.

## Viktig adressavgränsning

En annan Avstyckningsvägen 5 finns i Norsborg/Botkyrka: Hammarskiftet 18, radhus från 1973, 136 m², 195 m² tomt. Bilder och planer för den adressen får **inte** användas för Järfällahuset. Offentlig mäklaraggregator för denna annan fastighet: https://www.boneo.se/bostad/id-3568186-radhus-5rum-norsborg-alby-norsborg-avstyckningsvagen-5

Grannhusens annonsritningar kan visa områdets byggnadstyper men är inte bevis för detta hus och ska inte överföras till modellen.
