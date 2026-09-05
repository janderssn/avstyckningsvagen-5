import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const html = await readFile(path.join(dist, 'index.html'), 'utf8');
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
const bundles = references.filter(reference => /\.(js|css)(?:[?#]|$)/.test(reference));
assert.ok(bundles.some(reference => reference.endsWith('.js')), 'Built HTML must load a JavaScript bundle');

for (const reference of bundles) {
  const pathname = new URL(reference, 'https://build.invalid/').pathname;
  const assetsStart = pathname.indexOf('/assets/');
  assert.ok(assetsStart >= 0, `Unexpected unbundled entry: ${reference}`);
  assert.ok((await stat(path.join(dist, pathname.slice(assetsStart + 1)))).size > 0, reference);
}

let copiedAssets = 0;
async function checkPublic(directory, relative = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      await checkPublic(path.join(directory, entry.name), name);
      continue;
    }
    assert.ok(entry.isFile(), `Public asset must be a regular file: ${name}`);
    const [source, built] = await Promise.all([
      readFile(path.join(root, 'public', name)),
      readFile(path.join(dist, name)),
    ]);
    const digest = bytes => createHash('sha256').update(bytes).digest('hex');
    assert.equal(digest(built), digest(source), `Built asset differs from public/: ${name}`);
    copiedAssets++;
  }
}
await checkPublic(path.join(root, 'public'));
const glb = await readFile(path.join(dist, 'models', 'avstyckningsvagen-5-ritningsmodell.glb'));
assert.equal(glb.toString('ascii', 0, 4), 'glTF', 'Download must contain a binary glTF model');
assert.equal(glb.readUInt32LE(8), glb.length, 'GLB header must match the downloaded file size');
JSON.parse(await readFile(path.join(dist, 'data', 'site.json'), 'utf8'));
console.log(`Static build verified: ${bundles.length} bundles and ${copiedAssets} public assets, including terrain and GLB.`);
