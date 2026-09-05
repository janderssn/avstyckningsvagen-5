# Geometriskt underlag och tolkning

Avstyckningsvägen 5, Järfälla. Kontrollerat 2026-09-05.

## Arkivhandlingar

- Kommunens offentliga ritningsarkiv, ärende **LOV50-005623**, hittat via **VIKSJÖ 2:573** (hämtning och identifiering utförd av huvudagenten).
- Ritning **51165**, dokument **53506.pdf**, originalhandling från **1971**. Typ **502 N1S**, produktionsnummer **122–133 och 137–152** enligt titelrutan, avläst av huvudagenten.
- Lokalt observationsunderlag: `captures/archive-plan-51165-overview.png`.
- Adress/produktionskarta: `captures/archive-address-map-detail.png`.

Detta är en rekonstruktion av ett **ursprungligt typhus i bygglovshandling**, inte en uppmätning av dagens hus. Reviderade planlösningar, material och nuvarande detaljutformning är inte verifierade.

## Adresskoppling och senare fastighetsspecifikt underlag

**Det senare underlaget identifierar rätt fastighet.** Ärende **LOV50-017475**, ritningar inkomna **2007-10-12**, innehåller bottenplansritning **1533721.pdf** med uttrycklig handskriven adress **Avstyckningsvägen 5**, **17550 Järfälla**, samt **Järfälla 2:573**. Planen har samma yttermått och grundindelning som typritning 51165 och en särskild anteckning om placering av eldstad. Detta är starkare evidens för husets plan än den äldre adresskartan.

- `captures/2007-ground-1533721.png` och `2007-ground-detail.png`: bottenplan med adress, mått och eldstad.
- `captures/2007-upper-basement-1533711.png`: överplan, källarplan och skorstensplacering.
- `captures/2007-facades-a-1533691.png`: entrégavel och motsatt gavel.
- `captures/2007-facades-b-1533701.png`: gatu- och trädgårdsfasad.

Den historiska kartavvikelsen nedan är fortfarande oförklarad men hindrar inte längre identifikationen av 2007-ritningarna.

Adresskartan visar en böjd rad med produktionsnummer. Den läsbara följden är:

| Gatuadress på kartan | Produktionsnummer | Handskriven beteckning, bildtolkning |
|---|---:|---|
| 7 | 149 | ser ut som 2:571 |
| **5** | **150** | ser ut som **2:572** |
| **3** | **151** | ser ut som **2:573** |
| 1 | 152 | svåravläst, förefaller följande nummer |

Detta avviker från nutida registerkoppling och från fastighetens egen handling 2007. Handtext, äldre adressnumrering eller fastighetsändring kan förklara skillnaden; ingen förklaring är ännu belagd. Båda produktionsnummer **150 och 151** omfattas av samma ritning **51165**. Kartan ensam avgör inte om ett av husen är spegelvänt eller ändrat efter uppförandet.

## Avläst från översiktsbilden

- Rektangulär byggnad, yttermått **8,15 × 10,65 m**. Båda måtten är tydligt läsbara också på 2007 års bottenplan.
- Tre nivåer: **källarplan, bottenplan, överplan**.
- Källarplan: ett större garage längs ritningens högra sida; en vänster del märkt **DISPONIBELT**; trappa i vänster del.
- Bottenplan: kök och matrum i ritningens övre del; bad/tvätt vid vänster sida; hall och trappzon i mitten; vardagsrum i nedre högra delen; sovrum i nedre vänstra delen.
- Överplan: två rum längs övre delen; central hall och badrum; ytterligare sovrum i nedre högra delen; trappa i nedre vänstra delen; markerade vindsutrymmen vid ritningens övre och nedre ytterkanter.
- Sadeltak. Gatu- och trädgårdsfasaderna är långsidor med takfall i bild; entréfasad och motsatt gavel är triangulära gavelfasader.
- Garageport finns i gatufasadens källarnivå. Huvudentré finns på ena gaveln.

## Modellens koordinater och tillförlitlighet

Three.js använder meter och Y upp. Planritningens horisontella axel är X (8,15 m); vertikala axeln är Z (10,65 m), med ritningens ovansida vid negativ Z. Bottenplanets färdiga golv blir Y=0. Planen är ännu inte geografiskt orienterad mot sant norr.

Numerisk uppmätning av ritningens raster ger **tolkade** lägen för innerväggar och öppningar. Dessa får inte presenteras med samma noggrannhet som uttryckligen utsatta mått. Ytor som anges i rumstext är originalritningens värden och får inte blandas ihop med nutida mäklaruppgifter. Inredningsobjekt får endast illustrera fast inredning som syns på originalritningen; lös nutida möblering modelleras inte.

## Explicit måttsättning och rumstexter

Detaljbild `captures/1971-section-detail.png` visar:

| Mått | Avläsning | Modell |
|---|---|---|
| Källarens fria rumshöjd | 2,20 m | 2,20 m |
| Bottenplanets fria rumshöjd | 2,40 m | 2,40 m |
| Överplanets högsta fria rumshöjd | 2,40 m | Innerväggar högst 2,40 m, följer lägre takfall |
| Yttervägg | 0,30 m | 0,30 m, centrumlinje indragen 0,15 m från yttermått |
| Knävägg | 1,45 m | 1,45 m |
| Fönsterbröstning + fönsterhöjd | 0,80 + 1,30 m | Standardfönster 0,80 + 1,30 m |
| Bjälklagstjocklek | Ej säkert avläst; en 0,10-markering vid källaren kan avse annan detalj | **Antagande 0,25 m**, öppet redovisat |
| Taklutning / nockhöjd | Vinkel och nockhöjd saknar explicit mått; profilen kan avläsas relativt husbredden | **Tolkning cirka 43°**, nock Y=7,65 m relativt bottenplan |

Rumstexterna på 2007-planerna: matrum **12,7 m²**, vardagsrum **22,0 m²**, bottenplanets sovrum **10,4 m²**; överplanets rum **10,5 m²**, sovrum **12,0 m²**, sovrum **9,3 m²**. Dessa är redovisade ritningsvärden, inte beräknade modellareor. Dusch/WC, hall, kök, tvätt, garage och disponibelt utrymme saknar säkert avlästa areamått.

## Digitalisering och modellbeslut

- Bottenplanets vägglägen är spårade relativt byggnadens rasterram i `2007-ground-detail.png`: ungefär x=1142–1388, y=331–652, kalibrerat till 8,15×10,65 m.
- Källaren har längsgående garage i ritningens högra halva och disponibelt utrymme i vänstra halvan. En dörr förbinder delarna.
- Källartrappan visar en kvartsväng med kort första lopp och längre tvärgående lopp. Modellen använder två lopp och mellanplan; exakta stegmått, vändsteg och riktning måste uppmätas. Trapporna är inte verifierade konstruktionsdetaljer.
- Innerväggar 0,12 m, karmdimensioner, inredningshöjder och beslag är illustrativa. Planlägena följer handlingarna.
- Eldstad vid vardagsrummets högra yttervägg och rökkanal genom överplanets garderobsrad följer anteckningarna från 2007. Ugnens och skorstenens form är schematisk.
- Dusch, WC, tvättställ, köks- och tvättinredning samt garderober är schematiska tolkningar av ritningssymboler, utan påstående om nuvarande inredning. Rumsnamnet BAD betyder här badrum; ritningen anger DUSCH och ger inte stöd för ett badkar.
- Golvbjälklagen har geometriska trappöppningar. Dörr- och fönsteröppningar är verkliga öppningar i väggmesherna.
- Modellens Y-nivåer: källargolv **−2,45**, bottenplan **0,00**, överplan **+2,65 m**. Nivåerna mellan våningarna inkluderar det uttryckligen redovisade antagandet om bjälklag.
- Separata våningsgrupper och takgrupp stöder borttaget tak, våningsvis visning och snitt i Three.js.

## Visuellt observerad exteriör 2022

`captures/google-streetview-2022-number5-front.png` visar det fysiska husnumret **5** till höger om garageporten, vilket identifierar huset trots att panoramats platsetikett anger en annan gatuposition.

- Grågrön/taupe horisontell träpanel, breda vita fönsterfoder och hörnbrädor.
- Ljus putsad eller målad sockelfasad; vit garageport med gångdörr omedelbart till vänster.
- Svart profilerad taktäckning.
- `google-streetview-2022-position3.png` visar en mindre förstukvist med sadeltak och vita stolpar på entrégaveln. Modellens storlek är ungefärligt fototolkad.

Källa: Google Street View, **oktober 2022**, © Google. Foto är observationsunderlag och inte en metrisk 3D-skanning. Den aktuella vyn: https://www.google.com/maps/@59.4210658,17.800986,20a,60y,153.01h,90t/data=!3m7!1e1!3m5!1sKZQYCThYtHfJkYmDeemB1g!2e0!7i16384!8i8192

## Genomförd geometrikontroll

`buildHouse()` konstrueras i Node utan renderingsberoende. Väggmeshernas samlade yttergränser för bottenplanet kontrolleras med Three.js `Box3` mot **8,15×10,65 m**, inklusive väggtjockleken. Alla vertexpositioner kontrolleras som ändliga tal. Detta verifierar den implementerade geometrin, inte dagens verkliga hus eller ritningarnas samtliga detaljer.

## Oberoende jämförelse mot källbilder, 2026-09-05

För läsbarhet granskades lokala utsnitt av befintliga skärmfångster, utan att ersätta originalfilerna. PNG-filerna är **2560×1231 pixlar**. Rasterkoordinater angivna tidigare i dokumentet och nedan är normaliserade till bildbredd **2048 pixlar**; multiplicera med **1,25** för originalfilens pixelkoordinater. Skalningen ändrar inte måttkalibreringens proportioner.

Följande konkreta skillnader identifierades och rättades:

| Källobservation | Modell före granskning | Rättelse |
|---|---|---|
| `2007-ground-detail.png`, text **DUSCH** i BAD, cirka x1146–1176 / y416–424 | Ett långt badkar hade modellerats | Badkaret borttaget; duschplats och tvättställ följer de synliga symbolerna. Exakt duschavskärmning är okänd och modelleras inte. |
| `2007-upper-basement-1533711.png`, överplan: linje vid cirka y319 från x1055 till1184 med dörr mellan HALL10 och VIND15 | Hall/trappzon var helt öppen mot vinden | Skiljevägg och dörr tillagda. |
| `2007-ground-detail.png`, kök/matrum: dörrbåge vid cirka x1261–1290 / y379–407, gångjärn vid öppningens nedre ände | En öppning utan dörrblad vid väggens slut | Väggöppning med dörrblad och rätt gångjärnsände tillagd. |
| Samma bottenplan: två **G**-märkta skåp direkt söder om kök/matrumsdörren, cirka x1269–1290 / y410–459 | Skåpen saknades | Två schematiska garderobsskåp tillagda på matrumssidan. |
| `2007-upper-basement-1533711.png`, källare: vänstra ytterlinjen är obruten; dörr vid ELC ligger i en invändig, trappad inhägnad | En dörr hade felaktigt lagts i entrégavelns källaryttervägg | Ytterväggen gjord obruten; trappinhägnadens synliga vägglinjer och invändiga dörrar spårade. 2007 års gavelfasad stöder också frånvaron av denna ytterdörr. |

Överplanets centrala innertak kontrollerades geometriskt: undersidan ligger vid **Y=5,05 m**, vilket tillsammans med överplansgolvet **Y=2,65 m** ger ritningens **2,40 m** fria höjd. Innertakets övergång till snedtaket är sammanhängande i modellen. Den exakta takvinkeln och skiktuppbyggnaden är fortfarande tolkade.

Trappans två lopp kontrollerades numeriskt mot våningsnivåerna och har rätt total stigning i modellen. **Stegantal, stegform, höjdfördelning mellan loppen, dörrarnas relation till utrymmet under trappan och alla mått i trappinhägnaden saknar måttsatt detaljritning.** De har därför fortsatt lägre säkerhet än husets uttryckliga yttermått och rumshöjder.

Återstående begränsningar som denna granskning inte löser: senare invändiga förändringar efter 2007, nutida möbler/inredning, exakt fönster- och dörrbredd, samtliga karmdjup och öppningslägen, geografisk orientering, tomtens verkliga höjder och terränganslutning. Numerisk modellkontroll ersätter inte uppmätning av dessa detaljer.
