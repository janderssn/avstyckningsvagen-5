# Fotogrammetri av Avstyckningsvägen 5

Det här är en körbar CPU-pipeline för verkliga bildobservationer. Den befintliga arkivbaserade Three.js-modellen är **inte** ett fotogrammetriresultat. De tre hämtade Street View-vyerna gav ingen rekonstruktion i försöket 2026-09-05. Se `streetview-attempt-2026-09-05/quality-report.json` och [forskningsanteckningen](../../research/photogrammetry.md).

En andra körning med förbättrad fönstermask och matchkvot 0,85 gav också ingen rekonstruktion. Resultatet finns i `streetview-attempt-revised-ratio085/quality-report.json`. Geometriska kvalitetsgränser behölls; några trovärdiga 2D-träffar ska inte förväxlas med återvunnen 3D-geometri.

## Installera och kör

Python 3.12 testades. Projektets webbberoenden påverkas inte.

```bash
python -m venv /tmp/avstycknings-photogrammetry-venv
/tmp/avstycknings-photogrammetry-venv/bin/pip install -r scripts/photogrammetry/requirements.txt

/tmp/avstycknings-photogrammetry-venv/bin/python scripts/photogrammetry/reconstruct.py audit \
  scripts/photogrammetry/captured-input.json \
  --report /tmp/house-input-audit.json

/tmp/avstycknings-photogrammetry-venv/bin/python scripts/photogrammetry/reconstruct.py run \
  scripts/photogrammetry/captured-input.json \
  --output /tmp/house-sfm-new-run --threads 4 --max-seconds 600
```

Utdata måste ligga i en ny eller tom katalog. Felkod `2` betyder otillräckligt bildmaterial, `3` att SfM inte gav ett användbart glest resultat och `1` ett körfel. Felkod `0` vid rekonstruktion betyder endast att ett glest punktmoln skapades, inte att huset är komplett eller uppmätt. `--max-seconds` begränsar COLMAPs kartläggningssteg; extraktion/matchning har separat körtid.

Bearbetningen är SIFT → uttömmande parmatchning → geometrisk verifiering → inkrementell SfM/bundle adjustment → färgsatt PLY och GLB med punkter. Slumpfrö är fixerat; olika plattformar kan ändå ge små numeriska skillnader. COLMAP-databasen, maskerna, de använda bilderna och kvalitetsrapporten sparas så att resultatet går att granska.

Den andra körningen kan upprepas i en ny katalog:

```bash
/tmp/avstycknings-photogrammetry-venv/bin/python scripts/photogrammetry/reconstruct.py run \
  scripts/photogrammetry/captured-input-revised-masks.json \
  --output /tmp/house-sfm-revised-new --matching-ratio 0.85
```

Den oberoende matchgranskningen ligger i `audit_matching.py` och använder tilläggsberoendena i `audit-requirements.txt`. Den producerar matchtabeller och bilder, aldrig en ersättningsmodell. Se den manuella bedömningen i `method-audit-2026-09-05/manual-match-review.json`.

## Lägg till originalfoton

Skapa exempelvis `photos/exterior/` och ett eget JSON-manifest. Filvägar tolkas relativt manifestets plats. Minst tre **fysiskt skilda** kamerapositioner krävs av verktyget; det är en lägsta gräns för ett försök, inte tillräckligt för ett komplett hus.

```json
{
  "dataset": "Avstyckningsvägen 5 — originalfoton",
  "coverage": "Dokumentera vilka fasader, takytor och rum som faktiskt syns",
  "images": [
    {
      "file": "exterior/IMG_001.jpg",
      "source_type": "original_photo",
      "camera_position_id": "garden-station-001"
    },
    {
      "file": "exterior/IMG_002.jpg",
      "source_type": "original_photo",
      "camera_position_id": "garden-station-002"
    },
    {
      "file": "exterior/IMG_003.jpg",
      "source_type": "original_photo",
      "camera_position_id": "garden-station-003"
    }
  ]
}
```

Flytta kameran runt huset och fotografera varje yta med tydlig överlappning från flera positioner, gärna flera höjder. Behåll full upplösning, original och EXIF. Ta egna sammanhängande serier inne i varje rum, dörröppning och trappa; exteriörbilder kan inte rekonstruera insidan. Dokumentera ändringar sedan arkivritningarna och mät några oberoende kontrollavstånd. Undvik vindrörliga lövverk, reflektioner, oskärpa och förändrad zoom mitt i en serie. Kontrollera i rapporten vilka bilder som registrerats; fyll luckorna med fler bilder.

`source_type: streetview_perspective` kräver `panorama_id` och UI-masker i `exclude_rectangles`. Olika riktningar eller zoom från samma panorama avvisas eftersom de inte skapar någon baslinje. Equirektangulära panoramor kan inte skickas direkt till denna perspektivpipeline. Bildhashar och dHash fångar exakta och närliggande dubletter. Kamerapositionernas metadata är källuppgifter, inte ett självständigt bevis för geometrisk kvalitet.

Valfria `include_polygons` begränsar särdragsextraktionen till huset. `exclude_polygons` och `exclude_rectangles` tar bort lövverk, grannhus och gränssnitt. Koordinater anges i **originalbildens pixlar**, efter EXIF-orientering. Utan `include_polygons` ingår hela bilden. För den sparade Street View-serien används manuellt granskade husmasker; grannbyggnader ingår inte. Maskerna garanterar inte att alla skymmande löv eller felaktiga särdrag försvinner.

Valfria `camera_params` följer COLMAP-modellen: `[fx, fy, cx, cy]` för Street View (`PINHOLE`) eller `[f, cx, cy, k]` för originalfoto (`SIMPLE_RADIAL`). Lämna fältet tomt när värden saknas; de uppskattas då och får inte kallas kalibrerade. Kameror hanteras separat per bild. Full bild och separat mask bevarar huvudpunktens koordinatsystem; beskärning utan uppdaterade kameraparametrar ska undvikas.

## Meterskala och orientering

SfM ger först godtyckliga längdenheter och godtycklig orientering. En arkivbredd på **8,15 m** är en möjlig skalkontroll om båda motsvarande byggnadshörn identifieras korrekt och måttet fortfarande gäller; den är inte automatiskt en nutida inmätning. Bredden ensam bestämmer inte lutning och läge.

Öppna punktmolnet i exempelvis Blender, identifiera minst tre icke kollineära kontrollpunkter och koppla varje `sfm_xyz` till samma fysiska punkt i modellens koordinatsystem med meter och Y upp. `point-identities.json` listar punkternas ID, koordinater, spårlängd och reprojektionsfel. Kontrollpunkterna kan ha avlästa SfM-koordinater; dessa får inte hittas på.

Formatet för `controls.json` är:

```text
{
  "source": "Beskriv uppmätning/arkivmått, datum, punktdefinitioner och osäkerhet",
  "control_points": [
    {"sfm_xyz": [verkligt x, verkligt y, verkligt z], "model_xyz_m": [meter x, meter y, meter z]},
    ... minst tre motsvarande icke kollineära punkter ...
  ]
}
```

```bash
/tmp/avstycknings-photogrammetry-venv/bin/python scripts/photogrammetry/reconstruct.py align \
  /tmp/house-sfm-new-run/export \
  --alignment photos/controls.json --output /tmp/house-sfm-metric
```

Detta anpassar en likformighetstransformation och exporterar modeller/kameror/punkter i samma system. `alignment-report.json` redovisar skala, transformationsmatris och kontrollpunkternas residualer. Använd andra, oberoende kontrollmått för att bedöma noggrannhet; små residualer för de anpassade punkterna bevisar inte arkitektstandard.

## Three.js och tät rekonstruktion

`export/sparse.ply` och `export/sparse.glb` innehåller **glesa observerade punkter**, inga påhittade väggytor eller texturer. GLB kan läsas med Three.js `GLTFLoader`; PLY med `PLYLoader` och `THREE.Points`. Kontrollera `alignment.unit` före inläsning intill arkivmodellen. Oskalade, oorienterade punkter får inte placeras som om de vore inmätta.

`--dense` begär COLMAPs bildavdistorsion, PatchMatch och fusion till `dense/dense.ply` när den installerade PyCOLMAP-miljön har CUDA-stöd. Den här datorns verifierade installation har **inte** CUDA. Rapporten anger därför `unavailable_no_cuda` om tät bearbetning begärs efter en lyckad SfM. Tät rekonstruktion har inte körts eller verifierats här. Inte heller ett tätt punktmoln är ett komplett, texturerat och byggnadstekniskt verifierat hus; meshing, texturering och kontroll av saknade ytor återstår då.

API och pipelinesekvens följer [COLMAPs officiella Python-dokumentation](https://github.com/colmap/colmap/blob/main/python/README.md) och [PyCOLMAP 3.13 API](https://colmap.github.io/legacy/3.13/pycolmap/pycolmap.html). Funktionerna och deras signaturer har också kontrollerats mot den installerade versionen.

## Reproducera metodgranskningen

Den oberoende OpenCV-granskningen jämför nya RootSIFT-deskriptorer med COLMAPs sparade deskriptorer. Den sparar matchkoordinater, parmodeller och granskningsbilder, men skapar inga 3D-punkter. Matematiska inliers måste granskas visuellt; exempel med falska fönster-/takmatchningar finns dokumenterade i `research/photogrammetry.md`.

```bash
/tmp/avstycknings-photogrammetry-venv/bin/pip install -r scripts/photogrammetry/audit-requirements.txt
/tmp/avstycknings-photogrammetry-venv/bin/python scripts/photogrammetry/audit_matching.py \
  scripts/photogrammetry/streetview-attempt-2026-09-05 \
  --output /tmp/house-matching-audit

/tmp/avstycknings-photogrammetry-venv/bin/python scripts/photogrammetry/reconstruct.py run \
  scripts/photogrammetry/captured-input-revised-masks.json \
  --output /tmp/house-revised-ratio085 --threads 4 --max-seconds 180 --matching-ratio 0.85

/tmp/avstycknings-photogrammetry-venv/bin/python scripts/photogrammetry/audit_matching.py \
  /tmp/house-revised-ratio085 --output /tmp/house-revised-matching-audit
```

`--matching-ratio` ändrar endast deskriptormatchningens kvotgräns. Alla COLMAP-krav på geometriverifiering och rekonstruktion är kvar. Det dokumenterade reviderade försöket ökade första vyn till 765 särdrag men gav fortfarande ingen giltig rekonstruktion. Rapporten anger oanvändbara bildpar och noll punkter; den anpassar inte kvalitetskraven för att nå ett positivt resultat.
