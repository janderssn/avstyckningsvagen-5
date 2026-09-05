#!/usr/bin/env node
/** Export the drawing-based house, preserving floor groups and evidence metadata. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// GLTFExporter only needs Blob -> ArrayBuffer here; the house has no bitmap textures.
globalThis.FileReader ??= class NodeFileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => {
      this.result = result;
      this.onload?.({ target: this });
      this.onloadend?.({ target: this });
    }).catch(error => { this.error = error; this.onerror?.({ target: this }); });
  }
};

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(project, 'src/house.js');
const sourceCode = await readFile(sourcePath);
const sourceHash = createHash('sha256').update(sourceCode).digest('hex');
const { buildHouse } = await import('../src/house.js');
const house = buildHouse();
const modelPath = resolve(project, process.argv[2] || 'public/models/avstyckningsvagen-5-ritningsmodell.glb');
const reportPath = modelPath.replace(/\.glb$/i, '') + '.report.json';

const provenance = {
  title: house.metadata.title,
  modelType: 'procedural_drawing_reconstruction',
  description: 'Ritningsmodell från arkivhandlingar och visuella fasadobservationer. Inte fotogrammetri eller en verifierad nutida inmätning.',
  photogrammetry: false,
  surveyVerified: false,
  units: 'metres',
  metersPerUnit: 1,
  upAxis: 'Y',
  northCalibrated: false,
  groundFloorElevationM: 0,
  footprintM: house.metadata.footprint,
  sourceCode: 'src/house.js',
  sourceSha256: sourceHash,
  sourceDescription: house.metadata.sourceDescription,
  assumptions: house.metadata.assumptions,
};
house.group.userData = { ...house.group.userData, ...provenance, sources: house.metadata.sources };
house.roof.userData = { ...house.roof.userData, partId: 'roof', label: 'Tak', independentlyVisible: true };
for (const floor of house.floors) {
  floor.group.userData = { ...floor.group.userData, partId: floor.id, label: floor.label,
    elevationM: floor.elevation, roomHeightM: floor.height, independentlyVisible: true };
}
house.group.updateMatrixWorld(true);
const sourceBounds = new THREE.Box3().setFromObject(house.group);
let sourceMeshes = 0, sourceVertices = 0;
house.group.traverse(object => {
  assert(object.matrixWorld.elements.every(Number.isFinite), `Nonfinite transform: ${object.name}`);
  if (!object.isMesh) return;
  sourceMeshes++;
  sourceVertices += object.geometry.attributes.position.count;
  for (const [name, attribute] of Object.entries(object.geometry.attributes)) {
    assert(Array.from(attribute.array).every(Number.isFinite), `Nonfinite ${name}: ${object.name}`);
  }
  for (const material of [].concat(object.material)) {
    for (const value of Object.values(material)) assert(!value?.isTexture, 'This exporter expects an untextured drawing model');
  }
});
assert(sourceMeshes > 0, 'Source house is empty');

const exporter = new GLTFExporter();
exporter.register(writer => ({ afterParse() { writer.json.asset.extras = provenance; } }));
const binary = await exporter.parseAsync(house.group, { binary: true, onlyVisible: false, includeCustomExtensions: false });
assert(binary instanceof ArrayBuffer, 'Expected binary GLB');
const buffer = Buffer.from(binary);
assert.equal(buffer.toString('ascii', 0, 4), 'glTF');
assert.equal(buffer.readUInt32LE(4), 2);
assert.equal(buffer.readUInt32LE(8), buffer.length);
const chunks = [];
let offset = 12;
while (offset < buffer.length) {
  const length = buffer.readUInt32LE(offset);
  const type = buffer.readUInt32LE(offset + 4);
  assert.equal(length % 4, 0, 'GLB chunks must have four-byte alignment');
  assert(offset + 8 + length <= buffer.length, 'GLB chunk exceeds file');
  chunks.push({ type, body: buffer.subarray(offset + 8, offset + 8 + length) });
  offset += 8 + length;
}
assert.equal(offset, buffer.length);
assert.deepEqual(chunks.map(chunk => chunk.type), [0x4E4F534A, 0x004E4942]);
const gltf = JSON.parse(chunks[0].body.toString('utf8').trim());
assert.equal(gltf.asset.version, '2.0');
assert.equal(gltf.asset.extras.units, 'metres');
assert.equal(gltf.asset.extras.photogrammetry, false);
assert((gltf.meshes?.length || 0) > 0);
assert.equal(gltf.images?.length || 0, 0);
assert.equal(gltf.textures?.length || 0, 0);
assert(gltf.buffers.every(item => !item.uri), 'GLB must contain all mesh buffers');

// Inspect the encoded binary accessors, not just their declared JSON bounds.
const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
let checkedFloatValues = 0;
for (const accessor of gltf.accessors || []) {
  if (accessor.componentType !== 5126) continue;
  assert(!accessor.sparse, 'Sparse accessor validation is not implemented');
  const view = gltf.bufferViews[accessor.bufferView];
  const componentCount = components[accessor.type];
  const stride = view.byteStride || componentCount * 4;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  assert(start + (accessor.count - 1) * stride + componentCount * 4 <= chunks[1].body.length);
  for (let i = 0; i < accessor.count; i++) {
    for (let component = 0; component < componentCount; component++) {
      assert(Number.isFinite(chunks[1].body.readFloatLE(start + i * stride + component * 4)), 'Nonfinite encoded float');
      checkedFloatValues++;
    }
  }
}

// Load the exact GLB bytes with Three.js and compare the hierarchy and world bounds.
const imported = await new GLTFLoader().parseAsync(binary, '');
imported.scene.updateMatrixWorld(true);
const importedBounds = new THREE.Box3().setFromObject(imported.scene);
assert(importedBounds.min.distanceTo(sourceBounds.min) < 0.0001, 'Roundtrip minimum bound changed');
assert(importedBounds.max.distanceTo(sourceBounds.max) < 0.0001, 'Roundtrip maximum bound changed');
const groups = [];
imported.scene.traverse(object => {
  if (object.userData.partId) groups.push({ id: object.userData.partId, name: object.name, children: object.children.length,
    elevationM: object.userData.elevationM ?? null });
});
assert.deepEqual(groups.map(group => group.id).sort(), ['basement', 'ground', 'roof', 'upper']);
assert(groups.every(group => group.children > 0), 'An exported floor/roof group is empty');
assert.equal(createHash('sha256').update(await readFile(sourcePath)).digest('hex'), sourceHash,
  'src/house.js changed during export; rerun after editing finishes');

const report = {
  generatedUtc: new Date().toISOString(),
  artifact: modelPath.slice(project.length + 1),
  sha256: createHash('sha256').update(buffer).digest('hex'),
  bytes: buffer.length,
  glbVersion: 2,
  provenance,
  sourceMeshes,
  sourceVertices,
  gltfMeshes: gltf.meshes.length,
  gltfNodes: gltf.nodes.length,
  gltfMaterials: gltf.materials.length,
  gltfImages: 0,
  checkedFloatValues,
  nonfiniteValues: 0,
  units: 'metres',
  boundsM: { min: importedBounds.min.toArray(), max: importedBounds.max.toArray(), size: importedBounds.getSize(new THREE.Vector3()).toArray() },
  groups,
  checks: ['GLB header and length', 'JSON and BIN chunks', 'Embedded buffers', 'Source and encoded numeric values finite',
    'Meter/Y-up metadata', 'Three.js GLTFLoader roundtrip', 'World bounds preserved within 0.1 mm', 'Three floors and independent roof preserved'],
  limitations: ['Procedural drawing reconstruction, not photogrammetry', 'Current interior and architectural survey accuracy unverified',
    'Window framing, fittings and some construction details are illustrative', 'Cutting and exploded-view controls belong to the viewer and are not GLB animations'],
};
await mkdir(dirname(modelPath), { recursive: true });
await writeFile(modelPath, buffer);
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ artifact: report.artifact, bytes: report.bytes, meshes: report.gltfMeshes,
  groups: groups.map(group => group.id), boundsM: report.boundsM, verification: 'passed', report: reportPath }, null, 2));
