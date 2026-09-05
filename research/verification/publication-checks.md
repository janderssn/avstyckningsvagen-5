# Publiceringskontroll · 2026-09-05

- Ett lokalt Git-repo med huvudgrenen `main` har skapats. Beroenden, byggresultat, autentiseringsfiler, cache, råa webbsessioner och stora fotogrammetrimellanfiler undantas av `.gitignore`.
- README innehåller tre faktiska skärmbilder. Planbilden togs om med aktuella reglage, bottenplanet och ett ortografiskt höjdsnitt vid 1,20 m. Detaljerade modell- och källbeskrivningar finns i `docs/underlag.md`.
- `npm ci` passerade i en tom installationskatalog med projektets paket- och låsfil.
- Projektets Git-index exporterades till en separat katalog. Där passerade alla fem JavaScript-testfiler, sex Python-tester för DEM-sampling, `npm run build` och `npm run check:dist` med de nyinstallerade beroendena.
- Terrängdata återskapades helt offline från filerna i Git-indexet och blev byte för byte identisk med `public/data/site.json`.
- Produktionsbygget kontrollerades i webbläsaren både på domänrot och under `/avstyckningsvagen-5/`. Huset och terrängen laddade utan konsolfel. Källbilderna laddade från projektsökvägen och GLB-länken använde samma bas.
- Byggkontrollen verifierar två JS/CSS-resurser samt oförändrad kopiering av samtliga 14 filer i `public/`, inklusive terrängdata och GLB. Den befintliga Vite-varningen för en bundle över 500 kB kvarstår.
- De indexerade textfilerna granskades för vanliga token-, autentiserings- och privata nyckelmönster utan träffar.
- CI och manuell GitHub Pages-publicering är förberedda. Något fjärrrepo har inte skapats, och ingen push eller extern publicering har utförts.
