# Kontroll av Three.js-visaren

Kontrollerat 2026-09-05 i ansluten Chrome på `http://127.0.0.1:5173/`, normal vy 2560×1231 px. Modellversionen har 685 meshobjekt. Kontrollen avser programmet och ritningsrekonstruktionen; den verifierar inte dagens fysiska hus.

| Funktion | Kontroll och resultat |
|---|---|
| Startvy | Tak, fasader och källare renderas; kamerans grundinramning omfattar även förstukvist och skorsten. |
| Planvy | Bottenplan isoleras i ortografisk projektion. Rumsindelningen jämfördes visuellt med 2007-bladet. |
| Höjdsnitt | Reglaget styrdes med Home, Page Up och piltangenter till 34 %, vilket visar cirka +1,20 m. Dörr-/fönsteröppningar och fyllda snitt i massiva väggdelar syns. |
| Vertikalt snitt | Breddsnitt vid cirka −0,57 m visade genomskurna delar på samtliga våningar. Vändning växlade vilken halva som behölls. |
| Taköppning | Yttertak och överplanets innertak tas bort; gavelväggar och rum finns kvar. |
| Mätning | Två klick på motstående väggars centrala delar i bottenplanets snitt gav **7,86 m**, förenligt med cirka 7,85 m mellan väggcentrum. Det är inte samma ändpunkter som ytterbredden 8,15 m. Skärmbild: `ground-plan-measure.png`. |
| Våningsseparering | Reglaget ändrar avståndsstatus till 1,2 m; programmet flyttar våningsgrupper och anpassar kameran. Kameraberäkningen kontrollerades separat mot modellens åtta hörn och flera bildförhållanden. |
| Källpanel | Visar fastighetens fyra arkivblad, sektion, daterad fasadkälla, antaganden och GLB-länk. Refererade bildfiler finns lokalt. |
| Rumsnamn | Genomsynliga etiketter upptäcktes och rättades. Etiketter skyms nu av opaka väggar och bjälklag; genomskinliga glas och bortklippta ytor behandlas separat. Synlig ändring kontrollerad i webbläsaren. |
| JavaScript-fel | Inga nya fel i webbläsarloggen efter 15:35 UTC. Tidigare fel under en mellanliggande kodredigering var avhjälpta före denna kontroll. |
| Bygg och GLB | `npm run build` passerar. Exportens Three.js-inläsning och bounds/grupper kontrolleras av `scripts/export-model.mjs`; se separat exportprotokoll. |

PNG-knappen och GLB-importen finns i gränssnittet. En faktisk nedladdad PNG och filväljarens importflöde har inte slutverifierats här. GLB-inläsningens geometri är däremot verifierad i Node med samma Three.js-version. Ingen separat mobiltestning gjordes.

Kvarstående geometriska begränsningar är redovisade i `research/geometry-evidence.md`.

## Andra kontrollen: generella snittytor och ritningsrättelser

Samma dag kontrollerades den uppdaterade modellen med **717 meshobjekt** i en separat Chrome-flik. De fem rättelserna mot källritningarna finns dokumenterade i `research/geometry-evidence.md`.

`src/section.js` ersätter den tidigare begränsningen till boxar. Den bygger slutna snittkonturer och triangulerar dem med hål och inneslutna solida delar. Öppna eller tvetydiga konturer får fortsatt konturlinjer utan påhittade förslutningar.

- `npm test`: **12 av 12 tester passerar**. Förväntade areor och öppningarnas tomrum kontrolleras för axelraka, sneda och transformerade snitt, L-formade trapphål, separata kroppar, cylindrar, ett solitt område inne i ett hål, tangeringar samt husets faktiska bjälklag, gavel och överplansvägg.
- I webbläsaren visar ett snitt vid **−0,13 m** ett fyllt bottenbjälklag med det **L-formade trapphålet bevarat**: `slab-section-stair-hole.png`.
- Överplanets snitt vid **+4,14 m** visar dörr-/fönsteröppningar och den tillagda avskiljningen mot vinden: `upper-plan-revised.png`.
- Den separata kontrollflikens fellogg är tom.
- GLB har återskapats från den rättade modellen och återinläsningen passerar.
