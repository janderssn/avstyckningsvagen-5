# Ritningsmodell i GLB-format

`avstyckningsvagen-5-ritningsmodell.glb` innehåller samma husgeometri som Three.js-visaren, exporterad från `src/house.js`. Detta är en **proceduriell rekonstruktion från ritningar och fasadobservationer**, inte fotogrammetri eller en verifierad nutida inmätning. De uppgifterna finns även i filens `asset.extras` och husgruppens metadata.

Kör om exporten efter ändringar i husmodellen:

```bash
node scripts/export-model.mjs
```

En separat rapport sparas som `avstyckningsvagen-5-ritningsmodell.report.json`. Exporten kontrollerar GLB-header, binära koordinater, Three.js-inläsning och oförändrade begränsningsmått. Geometrin använder meter med Y upp och bottenplanets golv vid Y=0. Riktning mot sant norr är inte kalibrerad.

Tak och de tre våningsplanen är egna grupper med `partId` i deras metadata: `roof`, `basement`, `ground` och `upper`. Dölj eller flytta grupperna i Blender/Three.js för att öppna huset. Three.js-visarens beskärning, urval och reglage är funktioner i webbappen och ingår inte som animationer i filen. Grannhus eller grannterräng ingår inte i GLB:n.

Filen är fristående med färgmaterial och inbäddade geometribuffertar; externa texturer behövs inte. Blender kan läsa den via **Import → glTF 2.0**. I Three.js används `GLTFLoader`. Scenen skapas vid export med alla våningsplan och tak synliga.
