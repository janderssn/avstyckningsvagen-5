import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { appAssetUrl } from '../src/asset-url.js';
import { buildHouse } from '../src/house.js';

const site = JSON.parse(await readFile(new URL('../public/data/site.json', import.meta.url)));
const sources = [...buildHouse().metadata.sources, ...site.metadata.sources];
const assetPaths = [...new Set([
  '/data/site.json',
  '/models/avstyckningsvagen-5-ritningsmodell.glb',
  ...sources.flatMap(source => [source.url, source.image]).filter(path => path?.startsWith('/sources/')),
])];

test('all bundled source images, terrain data and GLB exist in public/', async () => {
  for (const path of assetPaths) await access(new URL(`../public${path}`, import.meta.url));
});

for (const [base, mount] of [['./', '/'], ['./', '/house-viewer/'], ['/', '/'], ['/house-viewer/', '/house-viewer/']]) {
  test(`public assets resolve within ${mount} with base ${base}`, () => {
    for (const path of assetPaths) {
      const url = new URL(appAssetUrl(path, base), `https://example.test${mount}`);
      assert.equal(url.pathname, `${mount}${path.slice(1)}`, path);
      assert.equal(url.origin, 'https://example.test');
    }
  });
}

test('external source links remain unchanged', () => {
  for (const path of ['https://example.test/document', '//example.test/image.png', undefined]) {
    assert.equal(appAssetUrl(path, '/house-viewer/'), path);
  }
});
