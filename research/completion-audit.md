# Avstämning mot det beställda slutresultatet

> **Ny avstämning 2026-09-05:** Beställaren har accepterat husets nuvarande kvalitet och bett om ortografisk 3D, sidval och ett tomt-/terrängläge. Dessa tillägg är genomförda och verifierade, se `verification/terrain-camera-checks.md`. Nedanstående avser den tidigare, bredare beställningen och dess dåvarande status.

Mål: en komplett modell av Avstyckningsvägen 5 med arkitektstandard, bildbaserad fotogrammetri, interiör från planritningar, Three.js-visning i användarens webbläsare, öppningsbart tak och snitt samt endast rutnät för omgivande grannfastigheter. Målet är **inte uppnått ännu**.

Avstämningen skiljer utförd programkontroll från kontroll mot den verkliga byggnaden. Att en modell går att bygga, exportera och visa bevisar inte geometrisk noggrannhet eller fullständig täckning.

| Krav | Auktoritativt underlag som behövs | Nuvarande evidens | Status |
|---|---|---|---|
| Rätt hus | Identifierad adress/fastighet, ritningskoppling och visuella kännetecken | 2007-bladet anger Avstyckningsvägen 5 och 2:573; gatubilden visar husnummer 5; sammanhanget pekar på Järfälla | Underlaget identifierar Järfällahuset |
| Utforska med Maps/Earth | Daterade observationer av målbyggnaden | Tre olika Street View-panoramor från oktober 2022, med kamera-ID och positioner | Utfört med Google Maps |
| Fotogrammetrisk geometri | Registrerade kameror, verifierade bildspår, triangulerade punkter och rimliga residualer/täckning | Två PyCOLMAP-körningar gav ingen rekonstruktion. Oberoende matchgranskning fann några riktiga bildträffar men ingen användbar rekonstruktion; se metodgranskningen | Inte uppnått |
| Planritningar för insidan | Fastighetsspecifika planer och sektioner | Fyra kommunala arkivblad från 2007, måttsatt sektion från 1971; synliga handlingar sparade som PNG | Historiskt underlag hittat |
| Komplett exteriör | Aktuell täckning av alla fasader/tak, öppningar, material och terränganslutning | Gatu- och entréfasad delvis observerade 2022; resterande form från arkivritningar; detaljer förenklade | Inte uppnått för dagens hus |
| Komplett detaljerad interiör | Aktuella planer/foton och mått i alla rum, trappor och fasta installationer | Tre plan med rum och schematisk fast inredning från ritningar; nutida ändringar och detaljform saknar verifiering | Inte uppnått för dagens hus |
| Arkitektstandard | Överenskommen användning och noggrannhet, mätkontroll med oberoende kontrollpunkter, dokumenterad täckning och geometrigranskning | Ytterväggarnas modellerade gräns är 8,15×10,65 m enligt ritning; flera andra mått är tolkade och omätta | Inte uppnått |
| Three.js i användarens webbläsare | Körande sida med faktisk rendering | Lokal app visad och kontrollerad i ansluten Chrome; produktionens bygge passerar | Uppnått för underlagsmodellen |
| Öppna och beskära för att se insidan | Fungerande lager, borttaget tak och snitt som bevarar verkliga öppningar | Taköppning, våningsvis visning, separation, horisontella och vertikala snitt provade. Generell snittfyllning verifierad med 12 tester och renderade snitt i bjälklag och överplan | Uppnått för underlagsmodellen |
| Grannar som rutnät utan modellerade hus | Sceninnehåll utan grannbyggnader | Omgivningen består av GridHelper-linjer och en skuggmottagande yta; inga grannhus ingår i byggnadsmodellen | Representationen uppfylld; fastighetsgränser är inte inmätta |
| Granskningsbar modellfil | Reproducerbar fil med meterskala och källmetadata | GLB med separata våningar och tak, exporterad från koden och återinläst med Three.js | Uppnått för underlagsmodellen |

## Andra granskningen med befintliga källor

Den andra granskningen rättade fem konkreta avvikelser mot planbladen: dusch, vindavskiljning, köksdörr, garderober och källarens trappinhägnad. Generella snittytor har verifierats med areor och bevarade hål. Fotogrammetrins maskering och matchning granskades oberoende och en ny körning med förbättrad mask samt högre matchkvot gav fortfarande ingen rekonstruktion. Modellens GLB har återskapats. Underlaget nedan behövs fortfarande för att hela det ursprungliga målet ska kunna verifieras.

## Underlag som fortfarande behövs för hela målet

Aktuella överlappande originalfoton av alla fasader, takets synliga delar, samtliga rum och trappor; redovisning av ändringar sedan 2007; oberoende kontrollmått med tydliga ändpunkter. Dessa behövs för att kontrollera verklig skala, täckning, vägg- och öppningslägen samt dagens fasta inredning. Fotogrammetri kan inte återge en insida som saknas i bilderna. Okända detaljer får inte fyllas i och sedan redovisas som verifierade.

Att inspektera ytterligare generiska grannhusplaner eller skapa plausibla men omätta detaljer skulle inte verifiera det beställda huset. Den befintliga 2007-planen förblir historiskt underlag tills senare källor eller en aktuell uppmätning visar dagens utförande.
