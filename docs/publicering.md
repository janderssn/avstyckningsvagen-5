# Publicering

Projektet bygger en statisk webbplats i `dist/`. Den behöver ingen serverkod, databas eller Lantmäteriet-inloggning vid körning: terrängdata, ritningsbilder och GLB-filen ingår i bygget.

## Bygg och kontrollera lokalt

Använd Node.js 24, samma huvudversion som i `.nvmrc` och GitHub Actions. Projektet kräver minst Node 22.12.

```sh
npm ci
npm test
npm run build
npm run check:dist
npm run preview
```

Öppna adressen som Vite visar, normalt `http://localhost:4173`. `check:dist` kontrollerar att HTML laddar byggda JS/CSS-filer och att alla filer i `public/` har kopierats oförändrade, inklusive terrängdata, källbilder och en giltig GLB-fil.

Vite använder relativ bas (`./`). Samma `dist/` fungerar därför både på en domänrot och i en underkatalog, exempelvis `https://namn.github.io/repo-namn/`. Terrängförfrågan, nedladdningslänken och källbilderna följer samma bas. Publicera hela innehållet i `dist/` med bibehållen katalogstruktur och låt värden servera `index.html` för katalogens URL.

En fast bas kan väljas när värden behöver det:

```sh
npm run build -- --base=/repo-namn/
```

## GitHub Pages

Workflows är förberedda; projektet skapar inget fjärrrepo och publicerar inget automatiskt.

1. Lägg projektet i ett GitHub-repo och pusha `main`.
2. Välj **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Öppna **Actions → Publish GitHub Pages → Run workflow** och välj `main`.
4. När jobbet är klart visas webbplatsens URL i jobbets `github-pages`-miljö och under Settings → Pages.

`CI` kör installation, tester, produktionsbygge och kontroll av byggda filer vid push och pull requests. `Publish GitHub Pages` gör samma kontroller och skickar därefter endast `dist/` till Pages. Publicering startas enbart manuellt; en vanlig push uppdaterar inte den publicerade sidan. Ingen personlig access-token behövs. GitHubs `GITHUB_TOKEN` och OIDC används för själva Pages-jobbet.

`public/` är webbplatsens publika innehåll. Källdokumentens attribution och återanvändningsvillkor beskrivs i [underlaget](underlag.md). Forskningsarkivet, utvecklingsverktygen och eventuella lokala autentiseringsfiler ingår inte i Vite-bygget.

## Referenser

- [Vite: Deploying a Static Site](https://vite.dev/guide/static-deploy.html)
- [GitHub: Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub: actions/setup-node](https://github.com/actions/setup-node)

Konfigurationen följer GitHubs dokumenterade Pages-actions: `configure-pages@v5`, `upload-pages-artifact@v4` och `deploy-pages@v4`. Referenserna kontrollerades 2026-09-05.
